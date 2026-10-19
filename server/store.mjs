import { randomUUID } from "node:crypto";
import { createState, advance } from "./domain/scenario.mjs";

export class Conflict extends Error {
  constructor() {
    super("State changed in another tab. Refresh and try again.");
    this.statusCode = 409;
  }
}
export class WorkspaceStore {
  constructor(db) {
    this.db = db;
    this.cached = null;
  }
  async initialize() {
    return this.db.transaction(async (tx) => {
      const head = (
        await tx.query(
          "SELECT active_run FROM workspace WHERE id=true FOR UPDATE",
        )
      ).rows[0];
      if (!head.active_run) await this.createRun(tx);
    });
  }
  async createRun(tx) {
    const id = randomUUID(),
      state = createState();
    await tx.query("INSERT INTO runs(id) VALUES($1)", [id]);
    await persist(tx, id, state);
    await tx.query("UPDATE workspace SET active_run=$1 WHERE id=true", [id]);
    return id;
  }
  async read(runId) {
    return this.db.transaction(async (tx) => {
      if (!runId) {
        const head = (
          await tx.query(
            "SELECT r.id,r.revision FROM runs r JOIN workspace w ON w.active_run=r.id WHERE w.id=true FOR SHARE OF w",
          )
        ).rows[0];
        if (
          this.cached?.runId === head.id &&
          this.cached.version === head.revision
        )
          return structuredClone(this.cached);
      }
      const state = await readState(tx, runId);
      if (!runId) this.cached = structuredClone(state);
      return state;
    });
  }
  async change(expected, fresh = false) {
    this.cached = null;
    return this.db.transaction(async (tx) => {
      await tx.query(
        "SELECT active_run FROM workspace WHERE id=true FOR UPDATE",
      );
      const state = await readState(tx);
      if (state.runId !== expected.runId || state.version !== expected.version)
        throw new Conflict();
      if (fresh) {
        await this.createRun(tx);
      } else if (advance(state)) {
        await persist(tx, state.runId, state);
        await tx.query(
          "UPDATE runs SET step=$2,revision=revision+1,updated_at=now() WHERE id=$1",
          [state.runId, state.step],
        );
      }
      return readState(tx);
    });
  }
}

async function persist(tx, run, state) {
  for (const [position, a] of state.agents.entries()) {
    const { id, follows: _follows, memory: _memory, ...profile } = a;
    await tx.query(
      "INSERT INTO agents VALUES($1,$2,$3,$4) ON CONFLICT(run_id,id) DO UPDATE SET profile=excluded.profile WHERE agents.profile IS DISTINCT FROM excluded.profile",
      [run, id, position, JSON.stringify(profile)],
    );
  }
  for (const a of state.agents)
    for (const target of a.follows)
      await tx.query(
        "INSERT INTO follows VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [run, a.id, target],
      );
  for (const [position, r] of state.repos.entries()) {
    const {
      id,
      owner,
      files: _files,
      stars: _stars,
      parents: _parents,
      ...metadata
    } = r;
    await tx.query(
      "INSERT INTO repositories VALUES($1,$2,$3,$4,$5) ON CONFLICT(run_id,id) DO UPDATE SET metadata=excluded.metadata WHERE repositories.metadata IS DISTINCT FROM excluded.metadata",
      [run, id, owner, position, JSON.stringify(metadata)],
    );
  }
  for (const r of state.repos) {
    for (const [position, [file, content]] of Object.entries(r.files).entries())
      await tx.query(
        "INSERT INTO files VALUES($1,$2,$3,$4,$5) ON CONFLICT(run_id,repo_id,path) DO UPDATE SET content=excluded.content WHERE files.content IS DISTINCT FROM excluded.content",
        [run, r.id, file, position, content],
      );
    for (const agent of r.stars)
      await tx.query(
        "INSERT INTO stars VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [run, r.id, agent],
      );
    for (const source of r.parents)
      await tx.query(
        "INSERT INTO lineage VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [run, r.id, source, r.forkOf === source ? "fork" : "reuse"],
      );
  }
  for (const [position, p] of state.prs.entries()) {
    const { id, repo, author, status, checks, approved, ...details } = p;
    await tx.query(
      "INSERT INTO pull_requests VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(run_id,id) DO UPDATE SET status=excluded.status,checks=excluded.checks,approved=excluded.approved,details=excluded.details WHERE (pull_requests.status,pull_requests.checks,pull_requests.approved,pull_requests.details) IS DISTINCT FROM (excluded.status,excluded.checks,excluded.approved,excluded.details)",
      [
        run,
        id,
        repo,
        author,
        status,
        checks,
        approved,
        position,
        JSON.stringify(details),
      ],
    );
  }
  for (const i of state.issues) {
    const { id, repo, author, pr, ...details } = i;
    await tx.query(
      "INSERT INTO issues VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(run_id,id) DO UPDATE SET details=excluded.details",
      [run, id, repo, author, pr, JSON.stringify(details)],
    );
  }
  for (const a of state.agents)
    for (const [position, m] of a.memory.entries()) {
      const { from, pr, ...content } = m;
      await tx.query(
        "INSERT INTO memories VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [run, a.id, position, from, pr ?? null, JSON.stringify(content)],
      );
    }
  for (const [sequence, e] of [...state.events].reverse().entries()) {
    const { actor, repo, pr, type, ...data } = e;
    await tx.query(
      "INSERT INTO events(run_id,sequence,actor_id,repo_id,pr_id,kind,data) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [run, sequence, actor, repo, pr ?? null, type, JSON.stringify(data)],
    );
  }
}

async function readState(tx, runId) {
  // The same lock as writers makes the multi-table view a consistent snapshot on PostgreSQL READ COMMITTED.
  const current = (
    await tx.query(
      "SELECT r.* FROM runs r JOIN workspace w ON w.active_run=r.id WHERE w.id=true FOR SHARE OF w",
    )
  ).rows[0];
  const run = runId
    ? (await tx.query("SELECT * FROM runs WHERE id=$1", [runId])).rows[0]
    : current;
  if (!run) {
    const error = new Error("Run not found.");
    error.statusCode = 404;
    throw error;
  }
  const rows = async (table, order = "") =>
    (
      await tx.query(`SELECT * FROM ${table} WHERE run_id=$1 ${order}`, [
        run.id,
      ])
    ).rows;
  const agents = await rows("agents", "ORDER BY position"),
    follows = await rows("follows", "ORDER BY target_id"),
    memories = await rows("memories", "ORDER BY position");
  const repos = await rows("repositories", "ORDER BY position"),
    files = await rows("files", "ORDER BY position"),
    stars = await rows("stars", "ORDER BY agent_id"),
    lineage = await rows("lineage", "ORDER BY source_id");
  const prs = await rows("pull_requests", "ORDER BY position"),
    issues = await rows("issues", "ORDER BY id"),
    events = await rows("events", "ORDER BY sequence DESC");
  return {
    runId: run.id,
    version: run.revision,
    step: run.step,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    databaseMode: undefined,
    agents: agents.map((a) => ({
      id: a.id,
      ...a.profile,
      follows: follows
        .filter((f) => f.agent_id === a.id)
        .map((f) => f.target_id),
      memory: memories
        .filter((m) => m.agent_id === a.id)
        .map((m) => ({
          ...m.content,
          from: m.source_repo,
          ...(m.source_pr ? { pr: m.source_pr } : {}),
        })),
    })),
    repos: repos.map((r) => ({
      id: r.id,
      owner: r.owner_id,
      ...r.metadata,
      files: Object.fromEntries(
        files.filter((f) => f.repo_id === r.id).map((f) => [f.path, f.content]),
      ),
      stars: stars.filter((s) => s.repo_id === r.id).map((s) => s.agent_id),
      parents: lineage
        .filter((l) => l.repo_id === r.id)
        .map((l) => l.source_id),
    })),
    prs: prs.map((p) => ({
      id: p.id,
      repo: p.repo_id,
      author: p.author_id,
      status: p.status,
      checks: p.checks,
      approved: p.approved,
      ...p.details,
    })),
    issues: issues.map((i) => ({
      id: i.id,
      repo: i.repo_id,
      author: i.author_id,
      pr: i.pr_id,
      ...i.details,
    })),
    events: events.map((e) => ({
      actor: e.actor_id,
      repo: e.repo_id,
      type: e.kind,
      ...(e.pr_id ? { pr: e.pr_id } : {}),
      ...e.data,
      recordedAt: e.recorded_at,
      sequence: e.sequence,
    })),
    runs: (
      await tx.query(
        "SELECT id,step,created_at FROM runs ORDER BY created_at DESC LIMIT 20",
      )
    ).rows,
  };
}
