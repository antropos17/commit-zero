import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { connectDatabase } from "../server/database.mjs";
import { WorkspaceStore } from "../server/store.mjs";
import { CommonsStore, record } from "../server/commons/store.mjs";

// Disposable embedded DB only. This benchmark never opens the user's stores or
// calls a model. The legacy path preserves the previous four-query write pattern.
const db = await connectDatabase({ memory: true, url: null });
let bytes = 0,
  statements = 0;
const measured = {
  ...db,
  query: query(db),
  transaction: (fn) => db.transaction((tx) => fn({ query: query(tx) })),
};
function query(target) {
  return async (sql, params = []) => {
    statements++;
    bytes += Buffer.byteLength(JSON.stringify(params));
    return target.query(sql, params);
  };
}
try {
  const workspace = new WorkspaceStore(db);
  await workspace.initialize();
  const id = (await workspace.read()).runId;
  const store = new CommonsStore(measured, workspace);
  await store.change(id, 0, (state) => {
    for (const project of state.projects)
      project.files["benchmark.txt"] = "source fixture ".repeat(3000);
    for (let i = 0; i < 1000; i++)
      record(
        state,
        "message",
        "operator",
        "",
        `Fixture ${i}: ${"context ".repeat(100)}`,
      );
  });
  const seed = await store.read(id);
  await db.query(
    "CREATE TABLE legacy_commons (run_id uuid PRIMARY KEY, document jsonb NOT NULL)",
  );
  await db.query("INSERT INTO legacy_commons VALUES($1,$2)", [
    id,
    JSON.stringify(seed),
  ]);
  async function legacyChange() {
    const initial = (
      await measured.query(
        "SELECT document FROM legacy_commons WHERE run_id=$1",
        [id],
      )
    ).rows[0].document;
    return measured.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO legacy_commons VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, JSON.stringify(initial)],
      );
      const state = (
        await tx.query(
          "SELECT document FROM legacy_commons WHERE run_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0].document;
      record(state, "message", "operator", "", "Measured message");
      state.version++;
      await tx.query("UPDATE legacy_commons SET document=$2 WHERE run_id=$1", [
        id,
        JSON.stringify(state),
      ]);
    });
  }
  async function sample(operation) {
    const times = [];
    bytes = 0;
    statements = 0;
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await operation();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
      samples: times.length,
      p50Ms: times[9],
      p95Ms: times[18],
      parameterBytes: bytes,
      statements,
    };
  }
  const legacy = await sample(legacyChange);
  const normalized = await sample(() =>
    store.change(id, null, (state) =>
      record(state, "message", "operator", "", "Measured message"),
    ),
  );
  const current = await store.read(id);
  const unchanged = await sample(() => store.read(id, current.version));
  const warmRead = await sample(() => store.read(id));
  await db.query("ANALYZE commons_events");
  const plan = (
    await db.query(
      "EXPLAIN (ANALYZE, FORMAT JSON) SELECT document FROM commons_events WHERE run_id=$1 AND sequence>990 ORDER BY sequence LIMIT 20",
      [id],
    )
  ).rows[0];
  const report = {
    at: new Date().toISOString(),
    environment: { node: process.version, database: db.mode, synthetic: true },
    seed: {
      projects: seed.projects.length,
      events: seed.events.length,
      snapshotBytes: Buffer.byteLength(JSON.stringify(seed)),
    },
    legacy,
    normalized,
    unchanged,
    warmRead,
    writeParameterReductionPercent:
      100 * (1 - normalized.parameterBytes / legacy.parameterBytes),
    unchangedResponseBodyBytes: 0,
    plan,
    limits:
      "Local synthetic PGlite timings, not network PostgreSQL or production throughput. Parameter bytes are SQL inputs, not WAL or disk write bytes. Full changed snapshots remain bounded by product limits.",
  };
  await mkdir(".cache/verification", { recursive: true });
  await writeFile(
    ".cache/verification/latest-backend-benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
