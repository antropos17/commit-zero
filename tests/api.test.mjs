import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDatabase } from "../server/database.mjs";
import { createApp } from "../server/app.mjs";

test("API persists the full scenario, enforces conflicts and preserves earlier runs", async (t) => {
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({ db });
  t.after(() => app.close());
  const call = (method, url, payload, extra = {}) =>
    app.inject({
      method,
      url,
      payload,
      headers: {
        host: "127.0.0.1:4173",
        "x-commit-zero": "local-demo",
        ...extra,
      },
    });
  let response = await call("GET", "/api/state");
  assert.equal(response.statusCode, 200);
  let state = response.json();
  const original = state.runId;
  assert.equal(state.repos.length, 5);
  assert.equal(state.databaseMode, "pglite");
  const expected = { runId: state.runId, version: state.version };
  const concurrent = await Promise.all([
    call("POST", "/api/advance", expected),
    call("POST", "/api/advance", expected),
  ]);
  assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 409]);
  state = (await call("GET", "/api/state")).json();
  assert.equal(state.step, 1);
  for (let i = 1; i < 10; i++) {
    response = await call("POST", "/api/advance", {
      runId: state.runId,
      version: state.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    state = response.json();
  }
  assert.equal(state.step, 10);
  assert.equal(state.repos.length, 7);
  assert.equal(state.prs.find((p) => p.id === 12).status, "merged");
  assert.equal(state.issues[0].status, "closed");
  assert.equal(state.agents.find((a) => a.id === "gemini").memory[0].pr, 12);
  assert.ok(
    state.repos
      .find((r) => r.id === "orbit")
      .files["orbit.js"].includes("Math.max"),
  );
  const persisted = (await call("GET", "/api/state")).json();
  assert.equal(persisted.version, 10);
  response = await call("POST", "/api/runs", {
    runId: state.runId,
    version: state.version,
  });
  assert.equal(response.statusCode, 200, response.body);
  state = response.json();
  assert.equal(state.step, 0);
  assert.notEqual(state.runId, original);
  assert.equal(state.runs.length, 2);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM events WHERE run_id=$1",
        [original],
      )
    ).rows[0].count,
    14,
  );
  assert.equal((await call("GET", "/api/export")).json().format, 1);
  assert.equal(
    (await call("GET", `/api/runs/${original}/export`)).json().state.step,
    10,
  );
  assert.equal(
    (await call("GET", "/api/runs/00000000-0000-0000-0000-000000000000/export"))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/advance",
        { runId: state.runId, version: 0 },
        { origin: "https://evil.example" },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/api/advance",
        { runId: state.runId, version: 0 },
        { "x-commit-zero": "" },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await call("GET", "/api/state", undefined, { host: "evil.example" }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call("POST", "/api/advance", {
        runId: "';DROP TABLE runs;--",
        version: -1,
      })
    ).statusCode,
    400,
  );
  await assert.rejects(
    () =>
      db.query(
        "UPDATE pull_requests SET status='merged' WHERE run_id=$1 AND id=12",
        [state.runId],
      ),
    /check constraint/i,
  );
  await assert.rejects(
    () =>
      db.query("INSERT INTO stars VALUES($1,$2,$3)", [
        state.runId,
        "orbit",
        "missing",
      ]),
    /foreign key/i,
  );
});
