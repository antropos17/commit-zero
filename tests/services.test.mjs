import test from "node:test";
import assert from "node:assert/strict";
import { createTestSystem } from "./harness.mjs";
import { connectDatabase } from "../server/database.mjs";
import { WorkspaceStore } from "../server/store.mjs";
import { startServices } from "../scripts/services.mjs";
import { english } from "../shared/english.mjs";
import { createGateway } from "../services/gateway.mjs";

test("Identity service persists profiles, rejects invalid sessions, and revokes cookies", async (t) => {
  const system = await createTestSystem();
  t.after(() => system.close());
  let sessionCookie = "";
  const call = async (method, url, payload, cookie = sessionCookie) => {
    const result = await system.gateway.inject({
      method,
      url,
      payload,
      headers: { host: "localhost", "x-commit-zero": "local-demo", cookie },
    });
    if (result.headers["set-cookie"])
      sessionCookie = String(result.headers["set-cookie"]).split(";")[0];
    return result;
  };
  assert.equal((await call("GET", "/api/account")).statusCode, 401);
  assert.equal(
    (
      await call("POST", "/api/auth/register", {
        username: "qa_observer",
        displayName: "QA Observer",
        password: "short",
      })
    ).statusCode,
    400,
  );
  const credentials = {
    username: "qa_observer",
    password: "A-local-test-password-2026",
  };
  const created = await call("POST", "/api/auth/register", {
    ...credentials,
    displayName: "QA Observer",
  });
  assert.equal(created.statusCode, 200, created.body);
  assert.match(
    String(created.headers["set-cookie"]),
    /HttpOnly; SameSite=Strict/,
  );
  assert.equal(created.json().user.username, "qa_observer");
  assert.equal(created.json().user.password_hash, undefined);
  const originalCookie = sessionCookie;
  assert.equal(
    (await call("GET", "/api/auth/session")).json().user.username,
    "qa_observer",
  );
  assert.equal(
    (
      await call("POST", "/api/auth/register", {
        ...credentials,
        displayName: "Duplicate",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call("POST", "/api/auth/login", {
        ...credentials,
        password: "incorrect-password",
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await call("PATCH", "/api/account", {
        displayName: "Updated Observer",
        biography: "Learning from repositories.",
      })
    ).json().user.displayName,
    "Updated Observer",
  );
  assert.deepEqual(
    (await call("PUT", "/api/account/bookmarks/orbit", { saved: true })).json()
      .bookmarks,
    ["orbit"],
  );
  assert.deepEqual((await call("GET", "/api/account")).json().bookmarks, [
    "orbit",
  ]);
  assert.equal((await call("POST", "/api/auth/logout")).statusCode, 200);
  assert.equal(
    (await call("GET", "/api/auth/session", undefined, originalCookie)).json()
      .user,
    null,
  );
  assert.equal(
    (await call("POST", "/api/auth/login", credentials)).statusCode,
    200,
  );
  assert.equal(
    (await call("GET", "/api/account")).json().user.biography,
    "Learning from repositories.",
  );
  assert.deepEqual(
    (await call("PUT", "/api/account/bookmarks/orbit", { saved: false })).json()
      .bookmarks,
    [],
  );
  const foreign = await system.gateway.inject({
    method: "PATCH",
    url: "/api/account",
    payload: { displayName: "Intruder", biography: "" },
    headers: {
      host: "localhost",
      origin: "http://elsewhere.test",
      "x-commit-zero": "local-demo",
      cookie: sessionCookie,
    },
  });
  assert.equal(foreign.statusCode, 403);
});

test("Rankings derive from saved evidence and change with the scenario", async (t) => {
  const system = await createTestSystem();
  t.after(() => system.close());
  const get = (url) =>
    system.gateway.inject({ url, headers: { host: "localhost" } });
  let board = (await get("/api/rankings")).json();
  assert.equal(board.rows.length, 3);
  assert.match(board.basis, /Not Elo/);
  for (const row of board.rows)
    assert.equal(row.score, row.code + row.collaboration);
  const oldGemini = board.rows.find((r) => r.id === "gemini").score;
  let state = (await get("/api/state")).json();
  const metrics = (await get("/api/contributions")).json();
  assert.equal(metrics.repos, undefined);
  assert.equal(metrics.agents.length, state.agents.length);
  assert.ok(JSON.stringify(metrics).length < JSON.stringify(state).length / 2);
  t.diagnostic(
    `Contribution payload: ${Buffer.byteLength(JSON.stringify(metrics))} bytes vs ${Buffer.byteLength(JSON.stringify(state))} bytes for the full state.`,
  );
  for (let i = 0; i < 10; i++)
    state = (
      await system.gateway.inject({
        method: "POST",
        url: "/api/advance",
        payload: { runId: state.runId, version: state.version },
        headers: { host: "localhost", "x-commit-zero": "local-demo" },
      })
    ).json();
  board = (await get("/api/rankings")).json();
  assert.equal(board.version, 10);
  assert.ok(board.rows.find((r) => r.id === "gemini").score > oldGemini);
  assert.ok(
    board.rows.every((r, i, rows) => i === 0 || rows[i - 1].score >= r.score),
  );
  const code = (await get("/api/rankings?category=code")).json();
  assert.ok(code.rows.every((r) => r.score === r.code));
  assert.equal((await get("/api/rankings?category=made-up")).statusCode, 400);
  assert.equal(/[А-Яа-яЁё]/.test(JSON.stringify(english(state))), false);
});

test("Repeated workspace reads use the revision cache without leaking mutable snapshots", async (t) => {
  const db = await connectDatabase({ memory: true, url: null });
  t.after(() => db.close());
  let count = 0;
  const measured = {
    ...db,
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          query: (...args) => {
            count++;
            return tx.query(...args);
          },
        }),
      ),
  };
  const store = new WorkspaceStore(measured);
  await store.initialize();
  count = 0;
  const first = await store.read(),
    cold = count;
  count = 0;
  const second = await store.read();
  t.diagnostic(`Workspace cache: ${cold} cold queries; ${count} warm query.`);
  assert.ok(count < cold / 2, `${count} warm queries vs ${cold} cold queries`);
  second.repos.length = 0;
  assert.ok((await store.read()).repos.length > 0);
  await store.change({ runId: first.runId, version: first.version });
  assert.equal((await store.read()).version, 1);
});

test("Independent service processes start, communicate over HTTP, and shut down", async (t) => {
  const cluster = await startServices({
    memory: true,
    ports: { workspace: 0, identity: 0, ranking: 0, gateway: 0 },
  });
  t.after(() => cluster.close());
  assert.equal(new Set(Object.values(cluster.services)).size, 4);
  const health = await fetch(cluster.url + "/api/health").then((r) => r.json());
  assert.equal(health.status, "ok");
  assert.deepEqual(Object.keys(health.services).sort(), [
    "identity",
    "ranking",
    "workspace",
  ]);
  const state = await fetch(cluster.url + "/api/state").then((r) => r.json());
  assert.equal(state.repos.length, 5);
  const board = await fetch(cluster.url + "/api/rankings").then((r) =>
    r.json(),
  );
  assert.equal(board.rows.length, 3);
});

test("Gateway reports unavailable dependencies without leaking internal errors", async (t) => {
  const app = await createGateway({
    services: {
      workspace: "http://unavailable",
      identity: "http://unavailable",
      ranking: "http://unavailable",
    },
    transport: async () => {
      throw new Error("private transport details");
    },
  });
  t.after(() => app.close());
  const health = await app.inject({
    url: "/api/health",
    headers: { host: "localhost" },
  });
  assert.equal(health.statusCode, 503);
  assert.equal(health.json().status, "degraded");
  assert.equal(health.json().services.workspace.status, "unavailable");
  const state = await app.inject({
    url: "/api/state",
    headers: { host: "localhost" },
  });
  assert.equal(state.statusCode, 503);
  assert.match(state.json().message, /Workspace service is unavailable/);
  assert.doesNotMatch(state.body, /private transport/);
});
