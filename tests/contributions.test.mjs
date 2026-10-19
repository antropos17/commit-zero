import { test } from "node:test";
import assert from "node:assert/strict";
import {
  modelContributions,
  commonsPullPath,
  projectContributions,
} from "../shared/contributions.mjs";

test("Contributions distinguish initial implementations, foreign merges and unmerged or fixture work", () => {
  const jobs = [
    { id: "mine", model: "model-a", provenance: "local_model" },
    { id: "other", model: "model-b", provenance: "local_model" },
    { id: "fixture", model: "model-a", provenance: "test_fixture" },
  ];
  const pull = (id, jobId, status, baseRevision) => ({
    id,
    jobId,
    status,
    baseRevision,
  });
  const data = {
    jobs,
    projects: [
      {
        id: "own",
        createdAt: "2026-10-19",
        prs: [
          pull("first", "mine", "merged", 0),
          pull("follow-up", "mine", "merged", 1),
        ],
      },
      {
        id: "foreign",
        createdAt: "2026-10-19",
        prs: [
          pull("their-first", "other", "merged", 0),
          pull("improvement", "mine", "merged", 1),
          pull("reviewed", "mine", "approved", 2),
        ],
      },
      { id: "seed", prs: [pull("seed-fix", "mine", "merged", 0)] },
      {
        id: "fork",
        createdAt: "2026-10-19",
        origin: { repoId: "own" },
        prs: [pull("fork-fix", "mine", "merged", 0)],
      },
      {
        id: "unverified",
        createdAt: "2026-10-19",
        prs: [
          pull("test", "fixture", "merged", 0),
          pull("missing", "missing", "merged", 1),
        ],
      },
    ],
  };
  const before = structuredClone(data);
  const result = modelContributions(data, "model-a");
  assert.deepEqual(
    result.created.map(({ project, pull: p }) => [project.id, p.id]),
    [["own", "first"]],
  );
  assert.deepEqual(
    result.improved.map((p) => p.id),
    ["improvement", "seed-fix", "fork-fix"],
  );
  assert.equal(result.accepted.length, 5);
  assert.equal(result.pulls.length, 6);
  assert.equal(result.pulls.find((p) => p.id === "improvement").number, 2);
  assert.deepEqual(data, before);
  assert.equal(modelContributions(data, "unknown").accepted.length, 0);
  assert.deepEqual(modelContributions(null, "model-a").created, []);
});

test("Project credits preserve creator, scope model jobs, and separate accepted changes from proposals", () => {
  const project = {
    id: "p",
    createdAt: "2026-10-19",
    prs: [
      { id: "initial", jobId: "a", status: "merged", baseRevision: 0 },
      { id: "improved", jobId: "b", status: "merged", baseRevision: 1 },
      { id: "pending", jobId: "b", status: "approved", baseRevision: 2 },
      { id: "closed", jobId: "b", status: "closed", baseRevision: 2 },
      { id: "fixture", jobId: "fixture", status: "merged", baseRevision: 2 },
      {
        id: "wrong-room",
        jobId: "wrong-room",
        status: "merged",
        baseRevision: 3,
      },
      { id: "missing", jobId: "missing", status: "merged", baseRevision: 4 },
    ],
  };
  const jobs = [
    { id: "a", model: "creator", repoId: "p", provenance: "local_model" },
    { id: "b", model: "improver", repoId: "p", provenance: "local_model" },
    { id: "fixture", model: "fake", repoId: "p", provenance: "test_fixture" },
    {
      id: "wrong-room",
      model: "wrong",
      repoId: "elsewhere",
      provenance: "local_model",
    },
  ];
  const before = structuredClone(project);
  const result = projectContributions(project, jobs);
  assert.equal(result.initial.model, "creator");
  assert.deepEqual(
    result.accepted.map(({ model }) => model),
    ["creator", "improver", null, null, null],
  );
  assert.deepEqual(
    result.proposed.map(({ pull }) => pull.id),
    ["pending", "closed"],
  );
  assert.equal(result.accepted[1].pull.number, 2);
  assert.equal(
    projectContributions({ ...project, origin: { repoId: "original" } }, jobs)
      .initial,
    null,
  );
  assert.equal(
    projectContributions({ ...project, createdAt: undefined }, jobs).initial,
    null,
  );
  assert.deepEqual(projectContributions({ ...project, prs: [] }, jobs), {
    initial: null,
    accepted: [],
    proposed: [],
  });
  assert.deepEqual(project, before);
});

test("Exact PR links preserve project and pull identity independently of list order", () => {
  const url = commonsPullPath("a/b ?", "pull#&/2");
  const [pathname, query] = url.split("?");
  assert.equal(decodeURIComponent(pathname.split("/").at(-1)), "a/b ?");
  assert.equal(new URLSearchParams(query).get("pull"), "pull#&/2");
  assert.equal(new URLSearchParams(query).get("view"), "changes");
});
