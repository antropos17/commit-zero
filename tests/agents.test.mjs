import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createTestSystem } from "./harness.mjs";
import {
  createIdentityApp,
  identityDatabase,
} from "../services/identity/app.mjs";

const configuration = {
  name: "Edge Case",
  mission: "Find timing bugs and propose regression fixes.",
  instructions:
    "Read the project scope and propose changes through reviewed pull requests.",
  provider: "local",
  model: "test-model",
  repository: "chatgpt/orbit",
  dailyBudgetCents: 100,
  maxMinutes: 10,
  capabilities: ["propose", "review"],
};
const call =
  (app, cookie = "") =>
  (method, url, payload) =>
    app.inject({
      method,
      url,
      payload,
      headers: { host: "localhost", "x-commit-zero": "local-demo", cookie },
    });
const register = async (app, username) => {
  const result = await call(app)("POST", "/api/auth/register", {
    username,
    displayName: username,
    password: "A-local-password-for-tests",
  });
  assert.equal(result.statusCode, 200, result.body);
  return String(result.headers["set-cookie"]).split(";")[0];
};

test("Agent configurations isolate owners, reject stale writes, and cannot launch execution", async (t) => {
  const system = await createTestSystem();
  t.after(() => system.close());
  const publicCall = call(system.gateway);
  assert.equal(
    (await publicCall("GET", "/api/account/agents")).statusCode,
    401,
  );
  assert.equal(
    (await publicCall("POST", "/api/account/agents", configuration)).statusCode,
    401,
  );
  const owner = call(
    system.gateway,
    await register(system.gateway, "agent_owner"),
  );
  const other = call(
    system.gateway,
    await register(system.gateway, "other_owner"),
  );
  const stateBefore = (await publicCall("GET", "/api/state")).json();
  for (const invalid of [
    { maxMinutes: 61 },
    { dailyBudgetCents: -1 },
    { capabilities: ["merge"] },
    { capabilities: [] },
    { provider: "unknown" },
    { instructions: "  " },
    { repository: "../../secrets" },
  ]) {
    assert.equal(
      (
        await owner("POST", "/api/account/agents", {
          ...configuration,
          ...invalid,
        })
      ).statusCode,
      400,
    );
  }
  const created = await owner("POST", "/api/account/agents", configuration);
  assert.equal(created.statusCode, 201, created.body);
  const { agent, execution } = created.json();
  assert.equal(agent.status, "configuration_only");
  assert.equal(agent.version, 1);
  assert.equal(agent.account_id, undefined);
  assert.equal(execution.available, false);
  assert.equal(execution.policy.directMerge, false);
  assert.equal(
    (await owner("POST", "/api/account/agents", configuration)).statusCode,
    409,
  );
  assert.equal(
    (await other("GET", "/api/account/agents")).json().agents.length,
    0,
  );
  assert.equal(
    (
      await other("PATCH", `/api/account/agents/${agent.id}`, {
        ...configuration,
        version: 1,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (await other("POST", `/api/account/agents/${agent.id}/launch`)).statusCode,
    404,
  );
  const updated = await owner("PATCH", `/api/account/agents/${agent.id}`, {
    ...configuration,
    mission: "Review Orbit and propose reproducible timing fixes.",
    version: 1,
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().agent.version, 2);
  assert.equal(
    (
      await owner("PATCH", `/api/account/agents/${agent.id}`, {
        ...configuration,
        version: 1,
      })
    ).statusCode,
    409,
  );
  const launch = await owner("POST", `/api/account/agents/${agent.id}/launch`);
  assert.equal(launch.statusCode, 409);
  assert.equal(launch.json().execution.available, false);
  assert.equal(
    (await owner("GET", "/api/account/agents")).json().agents[0].version,
    2,
  );
  const stateAfter = (await publicCall("GET", "/api/state")).json();
  assert.equal(stateAfter.version, stateBefore.version);
  assert.equal(stateAfter.runId, stateBefore.runId);
  assert.equal(stateAfter.agents.length, stateBefore.agents.length);
});

test("Agent configurations survive an embedded identity database restart", async (t) => {
  const directory = await mkdtemp(resolve(".cache/agent-persistence-"));
  let app;
  t.after(async () => {
    await app?.close();
    assert.ok(directory.startsWith(resolve(".cache") + sep));
    await rm(directory, { recursive: true, force: true });
  });
  app = await createIdentityApp({
    db: await identityDatabase({ directory, memory: false, url: null }),
  });
  const cookie = await register(app, "persistent_owner");
  const created = await call(app, cookie)(
    "POST",
    "/api/account/agents",
    configuration,
  );
  assert.equal(created.statusCode, 201, created.body);
  await app.close();
  app = null;
  app = await createIdentityApp({
    db: await identityDatabase({ directory, memory: false, url: null }),
  });
  const agents = (await call(app, cookie)("GET", "/api/account/agents")).json()
    .agents;
  assert.equal(agents.length, 1);
  assert.equal(agents[0].name, configuration.name);
  assert.deepEqual(agents[0].capabilities, configuration.capabilities);
});
