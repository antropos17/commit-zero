import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { connectDatabase } from "../server/database.mjs";
import {
  createIdentityApp,
  identityDatabase,
} from "../services/identity/app.mjs";
import { resolveOwnedAgent } from "../server/commons/owned-agent.mjs";
import { projectHistory } from "../shared/commons-history.mjs";
import { gitStream } from "../server/commons/git-export.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
const headers = { host: "localhost", "x-commit-zero": "local-demo" };
function modelFixture(prompts = []) {
  return {
    name: "fixture-not-inference",
    provenance: "test_fixture",
    ready: async () => ({ available: true }),
    generate: async (prompt, _signal, _seed, schema) => {
      prompts.push(prompt);
      const data = schema.properties.content
        ? {
            message: "Fixture implemented a new module.",
            generalMessage: "Fixture update.",
            title: "Add bounded helper",
            path: "helper.js",
            content: "export const clamp = (x) => Math.max(0, x);",
            star: true,
            copyFromRepo: "",
            copyFromPath: "",
          }
        : {
            message: "Fixture approval with runtime untested.",
            generalMessage: "Fixture review.",
            approve: true,
          };
      return {
        text: JSON.stringify(data),
        model: "fixture-not-inference",
        finishReason: "stop",
        elapsedMs: 1,
        usage: {},
      };
    },
  };
}
async function setup(t, options = {}) {
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({
    db,
    commons: { model: modelFixture(), ...options },
  });
  t.after(() => app.close());
  const { runId } = (await app.inject({ url: "/api/state", headers })).json();
  const read = async () =>
    (await app.inject({ url: `/api/commons?runId=${runId}`, headers })).json();
  const post = async (route, input, extra = {}) =>
    app.inject({
      method: "POST",
      url: `/api/commons/${route}`,
      headers: { ...headers, ...extra },
      payload: { runId, version: (await read()).version, ...input },
    });
  return { app, db, read, post, runId };
}
async function finish(read) {
  for (let i = 0; i < 150; i++) {
    const state = await read();
    if (state.jobs.at(-1)?.status !== "running") return state;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Fixture job did not settle.");
}
const newProject = {
  id: "new-library",
  name: "New Library",
  description: "A bounded test library.",
  kind: "library",
  sourceRepoId: "",
};
test("Project and issue lifecycle is transactional, normalized, scoped and exportable", async (t) => {
  const { post, read, db, app, runId } = await setup(t);
  const created = await post("projects", newProject);
  assert.equal(created.statusCode, 200, created.body);
  assert.equal((await post("projects", newProject)).statusCode, 409);
  assert.equal(
    (await post("projects", { ...newProject, id: "../escape" })).statusCode,
    400,
  );
  const repoId = newProject.id;
  assert.equal(
    (
      await post("issues", {
        repoId,
        title: "Clamp negatives",
        description: "Negative numbers should return zero.",
      })
    ).statusCode,
    200,
  );
  const issue = (await read()).projects.at(-1).issues[0];
  assert.equal(
    (await db.query("SELECT count(*)::integer AS n FROM commons_issues"))
      .rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT document->'issues' AS issues FROM commons_projects WHERE id=$1",
        [repoId],
      )
    ).rows[0].issues,
    [],
  );
  assert.equal(
    (
      await post("comments", {
        repoId: "safe-timer",
        targetId: issue.id,
        targetType: "issue",
        message: "wrong project",
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await post("comments", {
        repoId,
        targetId: issue.id,
        targetType: "issue",
        message: "Retain NaN behavior.",
      })
    ).statusCode,
    200,
  );
  const prior = await read();
  assert.equal(
    (
      await post("issue-state", {
        repoId,
        issueId: issue.id,
        status: "closed",
        version: prior.version - 1,
      })
    ).statusCode,
    409,
  );
  assert.deepEqual(await read(), prior);
  assert.equal(
    (await post("stars", { repoId, starred: true })).statusCode,
    200,
  );
  assert.equal(
    (await post("stars", { repoId, starred: true })).statusCode,
    409,
  );
  assert.equal(
    (await post("stars", { repoId, starred: false })).statusCode,
    200,
  );
  assert.equal(
    (
      await post("projects", {
        ...newProject,
        id: "fork-library",
        sourceRepoId: repoId,
      })
    ).statusCode,
    200,
  );
  let state = await read();
  assert.deepEqual(
    state.projects.at(-1).files,
    state.projects.find((p) => p.id === repoId).files,
  );
  assert.equal(state.projects.at(-1).origin.repoId, repoId);
  assert.deepEqual(state.projects.at(-1).issues, []);
  assert.equal(
    (await post("project-state", { repoId, archived: true })).statusCode,
    200,
  );
  assert.equal(
    (
      await post("issues", {
        repoId,
        title: "Blocked",
        description: "No writes in archive.",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post("jobs", { repoId, task: "Blocked" })).statusCode,
    409,
  );
  assert.equal(
    (await post("project-state", { repoId, archived: false })).statusCode,
    200,
  );
  const exported = await app.inject({
    url: `/api/commons/projects/${repoId}/export?runId=${runId}`,
    headers,
  });
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.json().project.issues[0].id, issue.id);
  assert.equal(exported.json().sourceHash.length, 64);
  // Force cold hydration through another instance, rather than only inspecting a cached snapshot.
  const { CommonsStore } = await import("../server/commons/store.mjs");
  state = await new CommonsStore(db, null).read(runId);
  assert.equal(
    state.projects.find((p) => p.id === repoId).issues[0].title,
    "Clamp negatives",
  );
});
test("Issue to new-file PR, discussion, close/reopen, merge and exact version history work together", async (t) => {
  const prompts = [],
    { post, read } = await setup(t, { model: modelFixture(prompts) });
  await post("projects", newProject);
  const repoId = newProject.id;
  await post("issues", {
    repoId,
    title: "Clamp negatives",
    description: "Negative inputs become zero.",
  });
  const issueId = (await read()).projects.at(-1).issues[0].id;
  await post("comments", {
    repoId,
    targetType: "issue",
    targetId: issueId,
    message: "Keep positive values unchanged.",
  });
  assert.equal(
    (await post("jobs", { repoId, issueId, task: "Implement a helper." }))
      .statusCode,
    202,
  );
  let state = await finish(read),
    repo = state.projects.at(-1),
    pr = repo.prs[0];
  assert.equal(state.jobs.at(-1).status, "completed");
  assert.equal(pr.before, null);
  assert.equal(repo.issues[0].status, "open");
  assert.ok(
    prompts.every((prompt) =>
      prompt.includes("Keep positive values unchanged."),
    ),
  );
  assert.equal(
    (
      await post("comments", {
        repoId,
        targetType: "pull",
        targetId: pr.id,
        message: "Review source before merging.",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await post("pull-state", { repoId, prId: pr.id, status: "closed" }))
      .statusCode,
    200,
  );
  assert.equal((await post("merge", { repoId, prId: pr.id })).statusCode, 409);
  assert.equal(
    (await post("pull-state", { repoId, prId: pr.id, status: "open" }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await post("jobs", {
        repoId,
        sourcePrId: pr.id,
        task: "Address the retained review without repeating code.",
      })
    ).statusCode,
    202,
  );
  state = await finish(read);
  assert.equal(state.jobs.at(-1).status, "failed");
  assert.match(state.events.at(-1).text, /already retained/);
  assert.equal((await post("merge", { repoId, prId: pr.id })).statusCode, 200);
  state = await read();
  repo = state.projects.at(-1);
  assert.equal(repo.revision, 1);
  assert.equal(repo.issues[0].status, "closed");
  const history = projectHistory(repo, state.events);
  assert.equal(history.error, "");
  assert.equal(history.versions[0].files["helper.js"], pr.after);
  assert.equal(Object.hasOwn(history.versions[1].files, "helper.js"), false);
  const directory = await mkdtemp(resolve(".cache/tmp/git-export-"));
  try {
    const git = (args, input) =>
      execFileSync("git", ["-C", directory, ...args], {
        input,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 2000000,
      });
    git(["init", "--bare", "--quiet"]);
    git(["fast-import", "--quiet"], gitStream(repo, state.events));
    assert.equal(git(["show", "main:helper.js"]), pr.after);
    assert.equal(git(["rev-list", "--count", "main"]).trim(), "2");
    assert.equal(
      git(["ls-tree", "--name-only", "main~1"]).includes("helper.js"),
      false,
    );
    assert.throws(
      () =>
        gitStream(
          { ...repo, files: { ...repo.files, "../escape.js": "unsafe" } },
          state.events,
        ),
      /safely to Git/,
    );
  } finally {
    assert.ok(directory.startsWith(resolve(".cache/tmp") + sep));
    await rm(directory, { recursive: true, force: true });
  }
  assert.equal(
    (await post("pull-state", { repoId, prId: pr.id, status: "open" }))
      .statusCode,
    409,
  );
});
test("Saved agents authenticate through identity, freeze configuration and enforce scope and capabilities", async (t) => {
  const identity = await createIdentityApp({
    db: await identityDatabase({ memory: true, url: null }),
  });
  await identity.listen({ host: "127.0.0.1", port: 0 });
  t.after(() => identity.close());
  const origin = `http://127.0.0.1:${identity.server.address().port}`;
  const { post, read } = await setup(t, {
    resolveAgent: (request, id) => resolveOwnedAgent(request, id, { origin }),
  });
  const registration = await identity.inject({
    method: "POST",
    url: "/api/auth/register",
    headers,
    payload: {
      username: "profile_owner",
      displayName: "Profile owner",
      password: "Fixture-only-password-249",
    },
  });
  const cookie = String(registration.headers["set-cookie"]).split(";")[0];
  const saved = await identity.inject({
    method: "POST",
    url: "/api/account/agents",
    headers: { ...headers, cookie },
    payload: {
      name: "Custom Builder",
      mission: "Implement bounded helper functions.",
      instructions: "Preserve the public API. Explain the change.",
      provider: "local",
      model: "fixture-not-inference",
      repository: "commons/new-library",
      dailyBudgetCents: 0,
      maxMinutes: 2,
      capabilities: ["propose"],
    },
  });
  assert.equal(saved.statusCode, 201, saved.body);
  const agent = saved.json().agent;
  await post("projects", newProject);
  const input = {
    repoId: newProject.id,
    task: "Implement the helper.",
    agentId: agent.id,
    agentVersion: 1,
  };
  assert.equal((await post("jobs", input)).statusCode, 401);
  assert.equal(
    (await post("jobs", { ...input, agentVersion: 2 }, { cookie })).statusCode,
    409,
  );
  assert.equal(
    (await post("jobs", { ...input, repoId: "safe-timer" }, { cookie }))
      .statusCode,
    403,
  );
  assert.equal((await post("jobs", input, { cookie })).statusCode, 202);
  const state = await finish(read),
    job = state.jobs.at(-1);
  assert.equal(job.status, "completed");
  assert.equal(job.agent.name, "Custom Builder");
  assert.equal(job.agent.version, 1);
  assert.equal(job.agent.maxMinutes, 2);
  assert.equal(job.agent.providerCostCents, 0);
  assert.deepEqual(state.projects.at(-1).stars, []);
  assert.ok(
    !state.events.some(
      (event) =>
        event.jobId === job.id &&
        event.actor === "builder" &&
        event.type === "message",
    ),
  );
  assert.ok(
    state.events.some(
      (event) =>
        event.type === "proposal" &&
        event.agentId === agent.id &&
        event.actorName === "Custom Builder",
    ),
  );
});
