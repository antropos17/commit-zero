import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve, join, sep } from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { connectDatabase } from "../server/database.mjs";
import { WorkspaceStore } from "../server/store.mjs";
import { CommonsStore } from "../server/commons/store.mjs";

const headers = { host: "localhost", "x-commit-zero": "local-demo" };
const pause = () => new Promise((done) => setTimeout(done, 15));

async function simulateRecovery() {
  const root = resolve(".cache/tmp");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "sim-recovery-"));
  assert.ok(directory.startsWith(root + sep));
  let db;
  let app;
  try {
    db = await connectDatabase({ directory, url: null });
    app = await createApp({ db });
    const runId = (await app.inject({ url: "/api/state", headers })).json().runId;
    const store = new CommonsStore(db, new WorkspaceStore(db));
    await store.change(runId, 0, (state) => {
      state.jobs.push({ id: randomUUID(), repoId: "safe-timer", status: "running", model: "fixture-no-model", provenance: "test_fixture" });
    });
    await app.close();
    app = null;
    db = null;
    db = await connectDatabase({ directory, url: null });
    app = await createApp({ db });
    const recovered = (await app.inject({ url: `/api/commons?runId=${runId}`, headers })).json();
    assert.equal(recovered.jobs[0].status, "interrupted");
    assert.ok(recovered.events.some((event) => event.type === "stopped" && event.jobId === recovered.jobs[0].id));
    return true;
  } finally {
    if (app) await app.close();
    else await db?.close();
    assert.ok(directory.startsWith(root + sep));
    await rm(directory, { recursive: true, force: true });
  }
}

export async function simulateCommons(seed = 17, { historyCount = 8 } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 1_000_000)
    throw new Error("Seed must be an integer between 0 and 1000000.");
  if (!Number.isSafeInteger(historyCount) || historyCount < 1 || historyCount > 40)
    throw new Error("History count must be an integer between 1 and 40.");
  let behavior = "approve";
  let proposalNumber = 0;
  const model = {
    name: "simulated-fixture-no-inference",
    provenance: "test_fixture",
    ready: async () => behavior === "unavailable"
      ? { available: false, reason: "Simulated capability unavailable." }
      : { available: true },
    async generate(_prompt, signal, _modelSeed, schema) {
      if (behavior === "provider-failure")
        throw new Error("Simulated provider failure. No model was called.");
      if (behavior === "timeout")
        throw new Error("Simulated provider timeout. No model was called.");
      if (behavior === "wait")
        await new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          if (signal.aborted) reject(signal.reason);
        });
      if (behavior === "invalid")
        return { text: "{invalid", model: this.name, elapsedMs: 0, usage: {}, finishReason: "stop" };
      const builder = Boolean(schema.properties.content);
      if (builder) proposalNumber++;
      const content = `export const simulationValue = ${seed + proposalNumber};\n`;
      const value = builder
        ? {
            message: "Simulated builder proposal; runtime untested.",
            generalMessage: "Simulated fixture update.",
            title: `Seeded proposal ${proposalNumber}`,
            path: "simulation.js",
            content,
            star: false,
            copyFromRepo: "",
            copyFromPath: "",
          }
        : {
            message: behavior === "reject" ? "Simulated reviewer requests changes." : "Simulated reviewer approves syntax-only proposal.",
            generalMessage: "Simulated fixture review.",
            approve: behavior !== "reject",
          };
      return { text: JSON.stringify(value), model: this.name, elapsedMs: 0, usage: {}, finishReason: "stop" };
    },
  };
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({ db, commons: { model } });
  try {
    const scenario = (await app.inject({ url: "/api/state", headers })).json();
    const runId = scenario.runId;
    const read = async () => (await app.inject({ url: `/api/commons?runId=${runId}`, headers })).json();
    const post = async (route, fields, version) => app.inject({
      url: `/api/commons/${route}`,
      method: "POST",
      headers,
      payload: { runId, version: version ?? (await read()).version, ...fields },
    });
    const finish = async () => {
      for (let attempt = 0; attempt < 120; attempt++) {
        const state = await read();
        if (state.jobs.at(-1)?.status !== "running") return state;
        await pause();
      }
      throw new Error("Simulated job did not settle.");
    };
    const project = (state) => state.projects.find((item) => item.id === "safe-timer");
    const originalScenarioRevision = scenario.version;
    const initial = await read();
    assert.equal((await post("messages", { repoId: "safe-timer", message: `Seed ${seed}: operator fixture brief.` })).statusCode, 200);
    const afterMessage = await read();
    const stale = await post("messages", { repoId: "safe-timer", message: "Stale simulated edit." }, initial.version);
    assert.equal(stale.statusCode, 409);
    assert.equal((await read()).version, afterMessage.version);

    behavior = "unavailable";
    const unavailable = await post("jobs", { repoId: "safe-timer", task: "Fixture: capability unavailable." });
    assert.equal(unavailable.statusCode, 503);
    assert.equal((await read()).version, afterMessage.version);

    behavior = "reject";
    model.name = "fixture-ada-no-model";
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture A: propose a bounded change." })).statusCode, 202);
    let state = await finish();
    const rejected = project(state).prs.at(-1);
    assert.equal(rejected.status, "changes-requested");
    assert.equal((await post("merge", { repoId: "safe-timer", prId: rejected.id })).statusCode, 409);

    behavior = "approve";
    model.name = "fixture-ben-no-model";
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture B: propose a distinct change." })).statusCode, 202);
    state = await finish();
    const accepted = project(state).prs.at(-1);
    assert.equal(accepted.status, "approved");
    assert.equal(state.jobs[0].model, "fixture-ada-no-model");
    assert.equal(state.jobs[1].model, "fixture-ben-no-model");
    assert.equal((await post("merge", { repoId: "safe-timer", prId: accepted.id })).statusCode, 200);
    state = await read();
    assert.equal(project(state).revision, 1);

    behavior = "provider-failure";
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture C: provider fails." })).statusCode, 202);
    state = await finish();
    assert.equal(state.jobs.at(-1).status, "failed");
    const failedJob = state.jobs.at(-1);
    behavior = "approve";
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture C retry: new explicit job." })).statusCode, 202);
    state = await finish();
    assert.equal(state.jobs.at(-1).status, "completed");
    assert.notEqual(state.jobs.at(-1).id, failedJob.id);

    behavior = "invalid";
    const pullsBeforeInvalid = project(state).prs.length;
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture D: invalid output." })).statusCode, 202);
    state = await finish();
    assert.equal(state.jobs.at(-1).status, "failed");
    assert.equal(project(state).prs.length, pullsBeforeInvalid);

    behavior = "timeout";
    assert.equal((await post("jobs", { repoId: "safe-timer", task: "Fixture: provider timeout." })).statusCode, 202);
    state = await finish();
    assert.equal(state.jobs.at(-1).status, "failed");
    assert.equal(project(state).prs.length, pullsBeforeInvalid);

    behavior = "wait";
    const start = await post("jobs", { repoId: "safe-timer", task: "Fixture E: cancelled task." });
    assert.equal(start.statusCode, 202);
    const active = (await read()).jobs.at(-1);
    assert.equal((await post("stop", { jobId: active.id })).statusCode, 200);
    state = await finish();
    assert.equal(state.jobs.at(-1).status, "cancelled");
    assert.equal(project(state).prs.length, pullsBeforeInvalid);

    for (let index = 0; index < historyCount; index++)
      assert.equal((await post("messages", { repoId: "safe-timer", message: `Seed ${seed} history ${index}.` })).statusCode, 200);
    state = await read();
    let after = 0;
    let pages = 0;
    let events = 0;
    for (;;) {
      const page = (await app.inject({ url: `/api/commons/events?runId=${runId}&after=${after}&limit=3`, headers })).json();
      pages++;
      events += page.events.length;
      after = page.nextAfter;
      if (!page.hasMore) break;
      assert.ok(pages < 100);
    }
    assert.equal(events, state.events.length);
    assert.equal((await app.inject({ url: "/api/state", headers })).json().version, originalScenarioRevision);
    assert.ok(state.jobs.every((job) => (job.responses || []).every((response) => response.provenance === "test_fixture")));
    const interruptedRecovery = await simulateRecovery();
    return {
      kind: "deterministic-commons-fixture",
      seed,
      historyCount,
      modelInference: false,
      persistedUserData: false,
      actorLabels: ["simulated operator", "Fixture Ada (no model)", "Fixture Ben (no model)", "simulated reviewer"],
      outcomes: {
        staleRevisionStatus: stale.statusCode,
        unavailableCapabilityStatus: unavailable.statusCode,
        rejectedReview: rejected.status,
        rejectedMergeStatus: 409,
        acceptedMergeVersion: project(state).revision,
        acceptedSourceHash: createHash("sha256").update(project(state).files["simulation.js"]).digest("hex"),
        providerFailure: failedJob.status,
        explicitRetry: "completed",
        invalidOutput: "failed-without-pr",
        timeout: "failed-without-pr",
        cancelled: state.jobs.at(-1).status,
        events,
        pages,
        scenarioRevisionPreserved: true,
        interruptedRecovery,
      },
    };
  } finally {
    await app.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const flags = process.argv.slice(2);
  if (![2, 4].includes(flags.length) || flags[0] !== "--seed" || (flags.length === 4 && flags[2] !== "--history"))
    throw new Error("Use: npm run simulate:commons -- --seed <integer> [--history 1..40]");
  console.log(JSON.stringify(await simulateCommons(Number(flags[1]), { historyCount: flags.length === 4 ? Number(flags[3]) : 8 }), null, 2));
}
