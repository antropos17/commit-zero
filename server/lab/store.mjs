import { randomUUID, createHash } from "node:crypto";
import { httpError } from "../../services/base.mjs";
// JSONB may reorder keys. Hash UTF-8 JSON with recursively sorted object keys.
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
export class ExperimentStore {
  constructor(db) {
    this.db = db;
  }
  async recover() {
    for (const row of (
      await this.db.query(
        "SELECT id FROM experiment_runs WHERE status='running'",
      )
    ).rows)
      await this.event(
        row.id,
        "runner",
        "interrupted",
        "Process restarted before completion. Prior artifacts are retained.",
        {},
        { status: "interrupted" },
      );
  }
  async create(model, provenance, configuration = {}) {
    try {
      return await this.db.transaction(async (tx) => {
        const count = await tx.query(
          "SELECT count(*)::int AS count FROM experiment_runs",
        );
        if (count.rows[0].count >= 200)
          throw httpError(
            409,
            "Experiment history is full (200 runs). Export and archive it before adding more.",
          );
        const row = (
          await tx.query(
            "INSERT INTO experiment_runs(id,status,model,provenance,summary) VALUES($1,'running',$2,$3,$4) RETURNING *",
            [randomUUID(), model, provenance, JSON.stringify(configuration)],
          )
        ).rows[0];
        return row;
      });
    } catch (error) {
      if (error.code === "23505")
        throw httpError(409, "An experiment is already running.");
      throw error;
    }
  }
  async event(id, actor, kind, message, data = {}, options = {}) {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query("SELECT * FROM experiment_runs WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!row) throw httpError(404, "Experiment not found.");
      if (row.status !== "running") return row;
      if (options.expected !== undefined && row.version !== options.expected)
        throw httpError(409, "Experiment changed; refresh before retrying.");
      const version = row.version + 1;
      await tx.query(
        "INSERT INTO experiment_events(run_id,sequence,actor,kind,message,data) VALUES($1,$2,$3,$4,$5,$6)",
        [id, version, actor, kind, message, JSON.stringify(data)],
      );
      if (options.artifact) {
        const { name, content } = options.artifact;
        await tx.query(
          "INSERT INTO experiment_artifacts(run_id,name,sha256,content) VALUES($1,$2,$3,$4)",
          [id, name, hash(content), JSON.stringify(content)],
        );
      }
      return (
        await tx.query(
          "UPDATE experiment_runs SET version=$2,status=$3,summary=$4,updated_at=now() WHERE id=$1 RETURNING *",
          [
            id,
            version,
            options.status || row.status,
            JSON.stringify(options.summary || row.summary),
          ],
        )
      ).rows[0];
    });
  }
  async list() {
    return (
      await this.db.query(
        "SELECT * FROM experiment_runs ORDER BY created_at DESC,id LIMIT 200",
      )
    ).rows;
  }
  async read(id, includeContents = false, knownVersion) {
    return this.db.transaction(async (tx) => {
      const run = (
        await tx.query("SELECT * FROM experiment_runs WHERE id=$1 FOR SHARE", [
          id,
        ])
      ).rows[0];
      if (!run) throw httpError(404, "Experiment not found.");
      if (!includeContents && run.version === knownVersion) return null;
      const events = (
        await tx.query(
          "SELECT * FROM experiment_events WHERE run_id=$1 ORDER BY sequence",
          [id],
        )
      ).rows;
      const artifacts = (
        await tx.query(
          `SELECT name,sha256,created_at${includeContents ? ",content" : ""} FROM experiment_artifacts WHERE run_id=$1 ORDER BY created_at,name`,
          [id],
        )
      ).rows;
      if (!includeContents) return { ...run, events, artifacts };
      return {
        ...run,
        events,
        artifacts: artifacts.map(({ name, sha256, created_at }) => ({
          name,
          sha256,
          created_at,
        })),
        artifactContents: artifacts,
      };
    });
  }
  async artifact(id, name) {
    const row = (
      await this.db.query(
        "SELECT * FROM experiment_artifacts WHERE run_id=$1 AND name=$2",
        [id, name],
      )
    ).rows[0];
    if (!row) throw httpError(404, "Artifact not found.");
    return row;
  }
}
