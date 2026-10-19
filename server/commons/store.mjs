import { randomUUID } from "node:crypto";
import { httpError } from "../../services/base.mjs";
import { hash } from "../lab/store.mjs";

export const actors = {
  operator: "Local operator",
  builder: "Builder",
  reviewer: "Reviewer",
  system: "Workspace",
};
export function record(state, type, actor, repoId, text, details = {}) {
  const event = {
    id: randomUUID(),
    sequence: state.events.length + 1,
    at: new Date().toISOString(),
    type,
    actor,
    repoId,
    text,
    ...details,
  };
  state.events.push(event);
  return event;
}
export class CommonsStore {
  constructor(db, workspace) {
    this.db = db;
    this.workspace = workspace;
    this.cached = null;
  }
  async initial(runId) {
    const source = await this.workspace.read(runId);
    return {
      runId: source.runId,
      sourceRevision: source.version,
      version: 0,
      projects: source.repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        kind: repo.game
          ? "game"
          : repo.topics?.includes("library")
            ? "library"
            : "project",
        description: repo.desc || "",
        files: repo.files,
        revision: 0,
        stars: [],
        forks: [],
        prs: [],
      })),
      events: [],
      jobs: [],
    };
  }
  async hydrate(tx, row) {
    if (
      this.cached?.runId === row.run_id &&
      this.cached.version === row.revision
    )
      return structuredClone(this.cached);
    const collections = {};
    for (const [key, table, order] of [
      ["projects", "commons_projects", "position"],
      ["jobs", "commons_jobs", "position"],
      ["events", "commons_events", "sequence"],
    ]) {
      collections[key] = (
        await tx.query(
          `SELECT document FROM ${table} WHERE run_id=$1 ORDER BY ${order}`,
          [row.run_id],
        )
      ).rows.map((item) => item.document);
    }
    const issues = (
      await tx.query(
        "SELECT repo_id,document FROM commons_issues WHERE run_id=$1 ORDER BY repo_id,number",
        [row.run_id],
      )
    ).rows;
    for (const item of issues) {
      const p = collections.projects.find((p) => p.id === item.repo_id);
      (p.issues ||= []).push(item.document);
    }
    return { ...row.document, version: row.revision, ...collections };
  }
  async read(runId, knownVersion) {
    const state = await this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT run_id,revision,document FROM commons WHERE run_id=$1 FOR SHARE",
          [runId],
        )
      ).rows[0];
      if (!row) return undefined;
      if (knownVersion === row.revision) return null;
      return this.hydrate(tx, row);
    });
    // Uninitialized snapshots can follow scenario changes at the same commons
    // revision. Do not cache them or return 304 until commons has its own row.
    if (state === undefined) return this.initial(runId);
    if (state) this.cached = structuredClone(state);
    return state;
  }
  async change(runId, version, update) {
    const exists = (
      await this.db.query("SELECT 1 FROM commons WHERE run_id=$1", [runId])
    ).rows.length;
    const initial = exists ? null : await this.initial(runId);
    const result = await this.db.transaction(async (tx) => {
      if (initial) {
        const {
          projects,
          jobs: _jobs,
          events: _events,
          version: _version,
          ...metadata
        } = initial;
        const inserted = await tx.query(
          "INSERT INTO commons(run_id,document) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING run_id",
          [runId, JSON.stringify(metadata)],
        );
        if (inserted.rows.length)
          await writeDocuments(
            tx,
            "commons_projects",
            runId,
            projects.map((document, position) => ({
              id: document.id,
              position,
              document,
            })),
          );
      }
      const row = (
        await tx.query(
          "SELECT run_id,revision,document FROM commons WHERE run_id=$1 FOR UPDATE",
          [runId],
        )
      ).rows[0];
      if (version !== null && version !== row.revision)
        throw httpError(
          409,
          "Workspace changed. Refresh and try again; your draft is retained.",
        );
      const state = await this.hydrate(tx, row);
      const before = Object.fromEntries(
        ["projects", "jobs", "events"].map((key) => [
          key,
          state[key].map((item) =>
            JSON.stringify(key === "projects" ? projectDocument(item) : item),
          ),
        ]),
      );
      const previousIssues = new Map(
        state.projects.flatMap((p) =>
          (p.issues || []).map((issue) => [
            issue.id,
            { repoId: p.id, number: issue.number, json: JSON.stringify(issue) },
          ]),
        ),
      );
      await update(state);
      if (
        state.runId !== runId ||
        state.sourceRevision !== row.document.sourceRevision ||
        state.version !== row.revision
      )
        throw new Error("Workspace identity and revision are host-owned.");
      for (let i = 0; i < before.events.length; i++) {
        if (JSON.stringify(state.events[i]) !== before.events[i])
          throw new Error("Recorded events are append-only.");
      }
      for (const [key, table] of [
        ["projects", "commons_projects"],
        ["jobs", "commons_jobs"],
      ]) {
        if (state[key].length < before[key].length)
          throw new Error("Retained records cannot be removed.");
        const changed = [];
        for (const [position, document] of state[key].entries()) {
          const prior = before[key][position];
          if (prior && JSON.parse(prior).id !== document.id)
            throw new Error(
              "Retained record order and identity cannot change.",
            );
          const stored =
            key === "projects" ? projectDocument(document) : document;
          if (JSON.stringify(stored) !== prior)
            changed.push({ id: document.id, position, document: stored });
        }
        if (changed.length) await writeDocuments(tx, table, runId, changed);
      }
      const issueWrites = [],
        retainedIssues = new Set();
      for (const p of state.projects)
        for (const issue of p.issues || []) {
          if (retainedIssues.has(issue.id))
            throw new Error("Issue identity cannot be duplicated.");
          retainedIssues.add(issue.id);
          const prior = previousIssues.get(issue.id);
          if (prior && (prior.repoId !== p.id || prior.number !== issue.number))
            throw new Error("Issue identity and project cannot change.");
          if (JSON.stringify(issue) !== prior?.json)
            issueWrites.push({
              repo_id: p.id,
              id: issue.id,
              number: issue.number,
              document: issue,
            });
        }
      if ([...previousIssues.keys()].some((id) => !retainedIssues.has(id)))
        throw new Error("Retained issues cannot be removed.");
      if (issueWrites.length)
        await tx.query(
          "INSERT INTO commons_issues(run_id,repo_id,id,number,document) SELECT $1,x.repo_id,x.id,x.number,x.document FROM jsonb_to_recordset($2::jsonb) AS x(repo_id text,id uuid,number integer,document jsonb) ON CONFLICT(run_id,id) DO UPDATE SET document=excluded.document",
          [runId, JSON.stringify(issueWrites)],
        );
      const appended = state.events.slice(before.events.length);
      if (
        appended.some(
          (event, i) => event.sequence !== before.events.length + i + 1,
        )
      )
        throw new Error("Event sequence must remain contiguous.");
      if (appended.length)
        await tx.query(
          "INSERT INTO commons_events(run_id,sequence,id,document) SELECT $1,(e->>'sequence')::integer,(e->>'id')::uuid,e FROM jsonb_array_elements($2::jsonb) e",
          [runId, JSON.stringify(appended)],
        );
      state.version = row.revision + 1;
      await tx.query(
        "UPDATE commons SET revision=$2,updated_at=now() WHERE run_id=$1",
        [runId, state.version],
      );
      return state;
    });
    // Publish only after commit. Returned snapshots cannot mutate the cache.
    this.cached = structuredClone(result);
    return result;
  }
  async events(runId, after = 0, limit = 50) {
    const page = await this.db.transaction(async (tx) => {
      const head = (
        await tx.query(
          "SELECT revision FROM commons WHERE run_id=$1 FOR SHARE",
          [runId],
        )
      ).rows[0];
      if (!head) return undefined;
      const rows = (
        await tx.query(
          "SELECT document FROM commons_events WHERE run_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3",
          [runId, after, limit + 1],
        )
      ).rows;
      const events = rows.slice(0, limit).map((row) => row.document);
      return {
        runId,
        version: head.revision,
        events,
        nextAfter: events.at(-1)?.sequence ?? after,
        hasMore: rows.length > limit,
      };
    });
    if (page) return page;
    await this.initial(runId); // Validate the run without creating a commons row.
    return { runId, version: 0, events: [], nextAfter: after, hasMore: false };
  }
  async recover() {
    const rows = (
      await this.db.query(
        "SELECT DISTINCT run_id FROM commons_jobs WHERE status='running'",
      )
    ).rows;
    for (const row of rows) {
      const state = await this.read(row.run_id);
      if (!state.jobs.some((j) => j.status === "running")) continue;
      await this.change(row.run_id, null, (s) => {
        for (const job of s.jobs.filter((j) => j.status === "running")) {
          job.status = "interrupted";
          record(
            s,
            "stopped",
            "system",
            job.repoId,
            "Server restarted. Work retained; no automatic retry.",
            { jobId: job.id },
          );
        }
      });
    }
  }
}
export function project(state, id) {
  const result = state.projects.find((p) => p.id === id);
  if (!result) throw httpError(404, "Project not found in this workspace.");
  return result;
}
export function capacity(state) {
  if (state.events.length > 1900 || state.jobs.length >= 100)
    throw httpError(
      409,
      "This workspace has reached its retained history limit. Export it before opening a new scenario run.",
    );
}
export function activeJob(state, id) {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || job.status !== "running")
    throw httpError(409, "Collaboration is no longer running.");
  return job;
}
export const contentHash = hash;
function projectDocument(project) {
  return Object.hasOwn(project, "issues")
    ? { ...project, issues: [] }
    : project;
}

async function writeDocuments(tx, table, runId, records) {
  // Table names are internal constants, never request parameters.
  await tx.query(
    `INSERT INTO ${table}(run_id,id,position,document) SELECT $1,x.id,x.position,x.document FROM jsonb_to_recordset($2::jsonb) AS x(id ${table === "commons_jobs" ? "uuid" : "text"},position integer,document jsonb) ON CONFLICT(run_id,id) DO UPDATE SET document=excluded.document WHERE ${table}.document IS DISTINCT FROM excluded.document`,
    [runId, JSON.stringify(records)],
  );
}
