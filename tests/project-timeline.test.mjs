import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localProjectTimeline,
  scenarioProjectTimeline,
} from "../shared/project-timeline.mjs";

test("Project timeline scopes events, preserves check outcomes and distinguishes reviewer from merger", () => {
  const project = {
    id: "p",
    prs: [
      {
        id: "pr",
        jobId: "job",
        baseRevision: 0,
        path: "main.js",
        status: "merged",
        review: { approve: true },
      },
    ],
  };
  const jobs = [
    {
      id: "job",
      repoId: "p",
      model: "author",
      provenance: "local_model",
      responses: [
        { actor: "reviewer", model: "review-model", provenance: "local_model" },
      ],
    },
  ];
  const event = (id, type, actor, sequence, extra = {}) => ({
    id,
    type,
    actor,
    sequence,
    repoId: "p",
    prId: "pr",
    jobId: "job",
    ...extra,
  });
  const events = [
    event("proposal", "proposal", "builder", 1),
    event("failed", "check", "system", 2, { check: { passed: false } }),
    event("review", "review", "reviewer", 3),
    event("merge", "merge", "operator", 4),
    event("foreign", "merge", "operator", 5, { repoId: "other" }),
    event("noise", "message", "builder", 6, { repoId: "other" }),
  ];
  const before = structuredClone(events);
  const rows = localProjectTimeline(project, jobs, events);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["merge", "review", "failed", "proposal"],
  );
  assert.equal(rows[0].model, null);
  assert.equal(rows[0].actor, "operator");
  assert.equal(rows[0].version, 1);
  assert.equal(rows[1].model, "review-model");
  assert.equal(rows[1].action, "approved the PR");
  assert.equal(rows[2].action, "syntax failed");
  assert.equal(rows[2].model, null);
  assert.equal(rows[3].model, "author");
  assert.equal(rows[3].pull.number, 1);
  assert.equal(rows[3].file, "main.js");
  assert.deepEqual(events, before);
  const fake = localProjectTimeline(
    project,
    [{ ...jobs[0], provenance: "test_fixture" }],
    events,
  );
  assert.equal(
    fake.some((row) => row.model),
    false,
  );
  assert.equal(
    localProjectTimeline(
      project,
      [{ ...jobs[0], repoId: "other" }],
      events,
    ).some((row) => row.model),
    false,
  );
});

test("Task timeline retains chat, fork, failure and merge evidence without leaking other tasks", () => {
  const project = { id: "p", prs: [{ id: "pr", jobId: "j", baseRevision: 0 }] };
  const jobs = [
    { id: "other", repoId: "q" },
    { id: "j", repoId: "p", sourceMessageId: "source" },
  ];
  const events = [
    {
      id: "source",
      type: "message",
      repoId: "",
      actor: "operator",
      text: "Requirement",
      sequence: 1,
    },
    { id: "start", type: "started", repoId: "p", jobId: "j", sequence: 2 },
    {
      id: "fork",
      type: "fork",
      repoId: "p",
      jobId: "j",
      forkId: "f",
      sequence: 3,
    },
    {
      id: "failure",
      type: "failed",
      repoId: "p",
      jobId: "j",
      text: "Rejected output",
      sequence: 4,
    },
    {
      id: "merge",
      type: "merge",
      repoId: "p",
      prId: "pr",
      actor: "operator",
      sequence: 5,
    },
    {
      id: "unrelated",
      type: "started",
      repoId: "p",
      jobId: "another",
      sequence: 6,
    },
    { id: "foreign", type: "message", repoId: "", sequence: 7 },
  ];
  const rows = localProjectTimeline(project, jobs, events, "j");
  assert.deepEqual(
    rows.map((row) => row.id),
    ["merge", "failure", "fork", "start", "source"],
  );
  assert.ok(rows.every((row) => row.task.id === "j" && row.task.number === 2));
  assert.equal(rows[0].version, 1);
  assert.equal(rows[0].model, null);
  assert.equal(rows[1].text, "Rejected output");
  assert.equal(rows[2].forkId, "f");
  assert.equal(rows[4].text, "Requirement");
});

test("Scenario timeline keeps historical checks and only links a PR in the same project", () => {
  const rows = scenarioProjectTimeline(
    "p",
    [
      {
        sequence: 2,
        repo: "p",
        actor: "a",
        type: "check",
        text: "received a failing check",
        pr: 1,
      },
      { sequence: 1, repo: "p", actor: "a", type: "star" },
    ],
    [{ id: 1, repo: "other", status: "merged" }],
    "run",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "received a failing check");
  assert.equal(rows[0].pull, undefined);
  assert.equal(rows[0].id, "run:2");
});
