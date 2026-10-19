import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { connectDatabase } from "../server/database.mjs";
import { syntaxCheck } from "../server/commons/runner.mjs";
import {
  projectHistory,
  numberedPulls,
  eventLabel,
  taskHistory,
} from "../shared/commons-history.mjs";

const headers = { host: "localhost", "x-commit-zero": "local-demo" };
function fixture(options = {}) {
  return {
    name: "fixture-not-a-model",
    provenance: "test_fixture",
    ready: async () => ({ available: true }),
    async generate(prompt, signal, _seed, schema) {
      options.inspectPrompt?.(prompt);
      await options.wait?.(signal);
      const reply = schema.properties.content
        ? {
            message: "Fixture proposal, not an inference.",
            generalMessage: "Fixture general update.",
            title: "Fixture update",
            path: "clock.js",
            content: "export const fixture = 1;",
            star: true,
            copyFromRepo: "vector-kit",
            copyFromPath: "geometry.js",
            ...options.proposal,
          }
        : {
            message: "Fixture review, not an inference.",
            generalMessage: "Fixture review summary.",
            approve: options.approve !== false,
          };
      return {
        text: JSON.stringify(reply),
        model: this.name,
        elapsedMs: 1,
        usage: {},
        finishReason: "stop",
      };
    },
  };
}
async function setup(t, model = fixture()) {
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({ db, commons: { model } });
  t.after(() => app.close());
  const scenario = (await app.inject({ url: "/api/state", headers })).json();
  const read = async () =>
    (
      await app.inject({ url: `/api/commons?runId=${scenario.runId}`, headers })
    ).json();
  const post = async (path, body = {}, version) =>
    app.inject({
      url: `/api/commons/${path}`,
      method: "POST",
      headers,
      payload: {
        runId: scenario.runId,
        version: version ?? (await read()).version,
        ...body,
      },
    });
  return { app, db, scenario, read, post };
}
async function finished(read) {
  for (let i = 0; i < 100; i++) {
    const s = await read();
    if (s.jobs.at(-1)?.status !== "running") return s;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Collaboration did not settle.");
}

test("Commons persists scoped conversations, actual fork/copy/PR/review and guarded merge without changing scenario", async (t) => {
  const { app, scenario, read, post } = await setup(t);
  assert.equal(
    (await post("messages", { repoId: "", message: "General goal" }))
      .statusCode,
    200,
  );
  assert.equal(
    (await post("messages", { repoId: "safe-timer", message: "Project note" }))
      .statusCode,
    200,
  );
  assert.equal(
    (await post("jobs", { repoId: "safe-timer", task: "Fix the clock" }))
      .statusCode,
    202,
  );
  let s = await finished(read);
  assert.equal(s.jobs[0].status, "completed");
  assert.equal(s.jobs[0].responses.length, 2);
  assert.ok(s.jobs[0].responses.every((r) => r.provenance === "test_fixture"));
  const p = s.projects.find((p) => p.id === "safe-timer"),
    pr = p.prs[0];
  assert.equal(pr.status, "approved");
  const task = taskHistory(s, "safe-timer")[0];
  assert.equal(task.phase, "Calls finished");
  assert.equal(task.outcome, "Awaiting operator merge");
  assert.equal(task.responseCount, 2);
  assert.equal(task.pull.id, pr.id);
  assert.equal(task.fork.id, pr.forkId);
  assert.ok(task.events.some((event) => event.repoId === ""));
  assert.ok(task.events.every((event) => event.jobId === task.id));
  assert.equal(
    p.forks[0].files["reused/vector-kit/geometry.js"],
    s.projects.find((p) => p.id === "vector-kit").files["geometry.js"],
  );
  assert.equal(p.files["clock.js"], pr.before);
  assert.equal(p.forks[0].files["clock.js"], pr.after);
  assert.deepEqual(p.stars, ["builder"]);
  assert.ok(s.events.some((e) => e.repoId === "" && e.actor === "reviewer"));
  assert.equal(
    (await post("merge", { repoId: p.id, prId: pr.id })).statusCode,
    200,
  );
  s = await read();
  assert.equal(taskHistory(s)[0].outcome, "Merged · v1");
  const history = projectHistory(
    s.projects.find((p) => p.id === "safe-timer"),
    s.events,
  );
  assert.equal(history.error, "");
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [1, 0],
  );
  assert.equal(history.versions[1].files["clock.js"], pr.before);
  assert.equal(history.versions[0].files["clock.js"], pr.after);
  assert.equal(history.versions[0].prId, pr.id);
  assert.equal(
    history.versions[0].at,
    s.events.find((e) => e.type === "merge").at,
  );
  assert.equal(
    s.projects.find((p) => p.id === "safe-timer").files["clock.js"],
    pr.after,
  );
  assert.equal(
    (await post("merge", { repoId: p.id, prId: pr.id })).statusCode,
    409,
  );
  assert.deepEqual(
    (await app.inject({ url: "/api/state", headers })).json(),
    scenario,
  );
});

test("Chat-sourced tasks retain exact context for both roles and reject invalid origins without writes", async (t) => {
  const prompts = [];
  const { app, scenario, read, post } = await setup(
    t,
    fixture({ inspectPrompt: (prompt) => prompts.push(prompt) }),
  );
  const sourceText = `Original discussion: ${"context ".repeat(150)}do not truncate this ending`;
  await post("messages", { repoId: "", message: sourceText });
  const sourceId = (await read()).events[0].id;
  for (let i = 0; i < 7; i++)
    await post("messages", {
      repoId: "safe-timer",
      message: `Later message ${i}`,
    });
  const before = await read();
  assert.equal(
    (
      await post(
        "jobs",
        {
          repoId: "safe-timer",
          task: "Inspect the original issue",
          sourceMessageId: sourceId,
        },
        before.version - 1,
      )
    ).statusCode,
    409,
  );
  assert.deepEqual(await read(), before);
  assert.equal(
    (
      await post("jobs", {
        repoId: "safe-timer",
        task: "Inspect the original issue",
        sourceMessageId: sourceId,
      })
    ).statusCode,
    202,
  );
  let state = await finished(read);
  assert.equal(state.jobs[0].sourceMessageId, sourceId);
  assert.equal(
    state.events.find((event) => event.type === "started").sourceMessageId,
    sourceId,
  );
  assert.equal(taskHistory(state)[0].sourceMessage.text, sourceText);
  assert.equal(prompts.length, 2);
  assert.ok(
    prompts.every((prompt) => prompt.includes(JSON.stringify(sourceText))),
  );
  assert.ok(prompts.every((prompt) => prompt.includes('"sourceMessage":')));

  const calls = prompts.length;
  const proposalId = state.events.find((event) => event.type === "proposal").id;
  const projectMessageId = state.events.find(
    (event) => event.type === "message" && event.repoId === "safe-timer",
  ).id;
  for (const [repoId, sourceMessageId, status] of [
    ["safe-timer", "not-a-uuid", 400],
    ["safe-timer", "00000000-0000-4000-8000-000000000000", 404],
    ["safe-timer", proposalId, 404],
    ["vector-kit", projectMessageId, 404],
  ]) {
    assert.equal(
      (await post("jobs", { repoId, task: "Invalid origin", sourceMessageId }))
        .statusCode,
      status,
    );
    assert.deepEqual(await read(), state);
  }
  assert.equal(prompts.length, calls);
  assert.equal(
    (
      await post("jobs", {
        repoId: "safe-timer",
        task: "Project discussion",
        sourceMessageId: projectMessageId,
      })
    ).statusCode,
    202,
  );
  state = await finished(read);
  assert.equal(taskHistory(state)[1].sourceMessage.id, projectMessageId);
  const reset = await app.inject({
    method: "POST",
    url: "/api/runs",
    headers,
    payload: { runId: scenario.runId, version: scenario.version },
  });
  assert.equal(reset.statusCode, 200);
  const nextRun = (await app.inject({ url: "/api/state", headers })).json()
    .runId;
  const crossRun = await app.inject({
    method: "POST",
    url: "/api/commons/jobs",
    headers,
    payload: {
      runId: nextRun,
      version: 0,
      repoId: "safe-timer",
      task: "Foreign run origin",
      sourceMessageId: sourceId,
    },
  });
  assert.equal(crossRun.statusCode, 404);
  assert.deepEqual(await read(), state);
});

test("Task history separates execution from acceptance and preserves scoped failures and stable numbers", () => {
  const state = {
    jobs: [
      { id: "other", repoId: "other", status: "completed" },
      { id: "writing", repoId: "p", status: "running" },
      { id: "checking", repoId: "p", status: "running", responses: [{}] },
      { id: "reviewing", repoId: "p", status: "running" },
      { id: "failed", repoId: "p", status: "failed", responses: [{}] },
      { id: "stopped", repoId: "p", status: "cancelled" },
      { id: "interrupted", repoId: "p", status: "interrupted" },
      { id: "rejected", repoId: "p", status: "completed" },
    ],
    projects: [
      {
        id: "p",
        prs: [
          { id: "review-pr", jobId: "reviewing", status: "open" },
          { id: "rejected-pr", jobId: "rejected", status: "changes-requested" },
        ],
      },
    ],
    events: [
      {
        jobId: "failed",
        type: "failed",
        text: "Invalid output",
        at: "failure-time",
      },
      { jobId: "other", type: "failed", text: "Unrelated failure" },
      { jobId: "stopped", type: "stopped", text: "Stopped by operator" },
      { jobId: "interrupted", type: "stopped", text: "Server restarted" },
      { jobId: "rejected", type: "completed", at: "completed-time" },
      { type: "message", text: "Unrelated chat" },
    ],
  };
  const before = structuredClone(state);
  const jobs = taskHistory(state, "p");
  assert.deepEqual(
    jobs.map((job) => job.number),
    [2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    jobs.map((job) => job.phase),
    [
      "Builder working",
      "Checking proposal",
      "Reviewer working",
      "Failed",
      "Stopped",
      "Interrupted",
      "Calls finished",
    ],
  );
  assert.equal(jobs[3].reason, "Invalid output");
  assert.equal(jobs[3].finishedAt, "failure-time");
  assert.equal(jobs[3].responseCount, 1);
  assert.equal(jobs[3].outcome, "No pull request");
  assert.equal(jobs[4].reason, "Stopped by operator");
  assert.equal(jobs[5].reason, "Server restarted");
  assert.equal(jobs[6].outcome, "Changes requested");
  assert.equal(jobs[6].finishedAt, "completed-time");
  assert.equal(jobs[0].finishedAt, null);
  assert.deepEqual(state, before);
});

test("Version history reconstructs multiple files, excludes unmerged work and refuses inconsistent evidence", () => {
  const first = {
    id: "first",
    title: "First patch",
    path: "one.js",
    before: "one-v0",
    after: "one-v1",
    baseRevision: 0,
    status: "merged",
    hash: "fixture-1",
  };
  const second = {
    id: "second",
    title: "Second patch",
    path: "two.js",
    before: "two-v0",
    after: "two-v2",
    baseRevision: 1,
    status: "merged",
    hash: "fixture-2",
  };
  const p = {
    id: "fixture",
    revision: 2,
    files: { "one.js": "one-v1", "two.js": "two-v2" },
    prs: [
      first,
      { ...first, id: "rejected", status: "changes-requested" },
      second,
    ],
  };
  const events = [first, second].map((pr, index) => ({
    id: String(index),
    type: "merge",
    repoId: p.id,
    prId: pr.id,
    actor: "operator",
    at: `2026-10-18T20:0${index}:00Z`,
  }));
  const original = structuredClone(p),
    history = projectHistory(p, events);
  assert.deepEqual(
    history.versions.map((v) => v.revision),
    [2, 1, 0],
  );
  assert.deepEqual(history.versions[2].files, {
    "one.js": "one-v0",
    "two.js": "two-v0",
  });
  assert.deepEqual(history.versions[1].files, {
    "one.js": "one-v1",
    "two.js": "two-v0",
  });
  assert.equal(history.versions[0].number, 3);
  history.versions[2].files["one.js"] = "changed view";
  assert.deepEqual(p, original);
  assert.ok(projectHistory(p, events.slice(1)).error);
  assert.ok(
    projectHistory(
      { ...p, files: { ...p.files, "two.js": "wrong head" } },
      events,
    ).error,
  );
  assert.deepEqual(
    numberedPulls([p]).map((pr) => pr.number),
    [1, 2, 3],
  );
  assert.equal(eventLabel(events[1], numberedPulls([p])[2]), "merged PR #3");
});

test("Commons rejects impersonation, stale writes, unknown rooms and duplicate actions atomically", async (t) => {
  const { read, post } = await setup(t);
  assert.equal(
    (
      await post("messages", {
        repoId: "",
        message: "Pretend",
        actor: "builder",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await post("messages", { repoId: "missing", message: "Unknown" }))
      .statusCode,
    404,
  );
  assert.equal(
    (await post("messages", { repoId: "", message: "  " })).statusCode,
    400,
  );
  const writes = await Promise.all([
    post("messages", { repoId: "", message: "One" }, 0),
    post("messages", { repoId: "", message: "Two" }, 0),
  ]);
  assert.deepEqual(writes.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await read()).events.length, 1);
  assert.equal((await read()).events[0].actor, "operator");
});

test("Commons retains rejected output, denies unapproved merges and parses code without executing it", async (t) => {
  const { read, post } = await setup(
    t,
    fixture({ proposal: { path: "../../outside.js" } }),
  );
  await post("jobs", { repoId: "safe-timer", task: "Try an invalid path" });
  const s = await finished(read);
  assert.equal(s.jobs[0].status, "failed");
  assert.equal(s.jobs[0].responses.length, 1);
  assert.equal(s.projects.find((p) => p.id === "safe-timer").forks.length, 0);
  assert.equal(
    (await syntaxCheck("throw new Error('this must never execute');")).passed,
    true,
  );
  assert.equal((await syntaxCheck("export const broken = ;")).passed, false);
  const rejected = await setup(t, fixture({ approve: false }));
  await rejected.post("jobs", { repoId: "safe-timer", task: "Reject fixture" });
  const done = await finished(rejected.read),
    pr = done.projects.find((p) => p.id === "safe-timer").prs[0];
  assert.equal(pr.status, "changes-requested");
  assert.equal(
    (await rejected.post("merge", { repoId: "safe-timer", prId: pr.id }))
      .statusCode,
    409,
  );
});

test("Commons cancellation and shared inference lease prevent late writes and competing lab jobs", async (t) => {
  const model = fixture({
    wait: (signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
      }),
  });
  const { app, read, post } = await setup(t, model);
  const start = await post("jobs", { repoId: "safe-timer", task: "Wait" });
  assert.equal(start.statusCode, 202);
  assert.equal(
    (await post("jobs", { repoId: "safe-timer", task: "Compete" })).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/lab/runs",
        method: "POST",
        headers,
        payload: {},
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post("stop", { jobId: start.json().jobs[0].id })).statusCode,
    200,
  );
  const s = await finished(read);
  assert.equal(s.jobs[0].status, "cancelled");
  assert.equal(s.projects.find((p) => p.id === "safe-timer").prs.length, 0);
});
