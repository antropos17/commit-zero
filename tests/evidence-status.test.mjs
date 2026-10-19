import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEvidence,
  isPublicationOrigin,
} from "../scripts/evidence-status.mjs";
import { browserGroups } from "../scripts/test-ui.mjs";
import { qualityPlan } from "../scripts/quality-plan.mjs";
import { sourceIndexVersion } from "../scripts/project-files.mjs";

function fixture() {
  // Synthetic contract data only. Never saved as real verification evidence.
  const sourceHash = "a".repeat(64),
    head = "1".repeat(40),
    publicHead = "2".repeat(40),
    tree = "3".repeat(40);
  const stamp = {
    sourceIndexVersion,
    status: "passed",
    stable: true,
    sourceHash,
    finalSourceHash: sourceHash,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:01:00.000Z",
  };
  return {
    source: { head, tree, branch: "fixture-source", dirty: false },
    sourceHash,
    finalSourceHash: sourceHash,
    finalHead: head,
    finalPublicationHead: publicHead,
    publication: {
      status: "available",
      head: publicHead,
      tree,
      dirty: false,
      originMatches: true,
      cachedRemoteHead: publicHead,
    },
    full: {
      ...stamp,
      mode: "full",
      fullGate: true,
      stages: qualityPlan("full").map(({ name }) => ({ name, code: 0 })),
    },
    browser: {
      ...stamp,
      fullBrowserSuite: true,
      groups: browserGroups.map(({ name, files }) => ({
        name,
        files,
        exitCode: 0,
        expected: 1,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
        complete: true,
      })),
    },
    hosted: { requested: false, status: "not-queried" },
  };
}

test("publication identity accepts only the expected GitHub repository transports", () => {
  for (const value of [
    "https://github.com/antropos17/commit-zero.git",
    "git@github.com:antropos17/commit-zero.git",
    "ssh://git@github.com/antropos17/commit-zero.git",
  ])
    assert.equal(isPublicationOrigin(value), true);
  for (const value of [
    "https://example.com/antropos17/commit-zero.git",
    "https://github.com/other/commit-zero.git",
    "file://github.com/antropos17/commit-zero.git",
    "http://github.com/antropos17/commit-zero.git",
    "https://github.com/antropos17/commit-zero.git?target=other",
  ])
    assert.equal(isPublicationOrigin(value), false);
});

test("evidence permits different Git histories only with matching trees and current complete checks", () => {
  const facts = fixture();
  assert.notEqual(facts.source.head, facts.publication.head);
  const result = evaluateEvidence(facts);
  assert.equal(result.status, "current");
  assert.deepEqual(result.issues, []);
  assert.equal(result.checks.publicationTreeMatches, true);
  assert.equal(result.checks.fullGateCurrent, true);
  assert.equal(result.checks.browserSuiteCurrent, true);
});

test("evidence rejects stale, focused, partial and probe-only verification", () => {
  const changes = [
    (f) => {
      f.full.sourceIndexVersion = 1;
    },
    (f) => {
      delete f.browser.sourceIndexVersion;
    },
    (f) => {
      f.full.sourceHash = "b".repeat(64);
    },
    (f) => {
      f.full.mode = "ui";
      f.full.fullGate = false;
    },
    (f) => {
      f.full.stages.pop();
    },
    (f) => {
      f.full.stages = {};
    },
    (f) => {
      f.full.stages = [null];
    },
    (f) => {
      f.full.finishedAt = "invalid";
    },
    (f) => {
      f.browser = {
        status: "passed",
        browserLaunched: true,
        profileRemovedAfterClose: true,
      };
    },
    (f) => {
      f.browser.groups.pop();
    },
    (f) => {
      f.browser.groups = { length: browserGroups.length };
    },
    (f) => {
      f.browser.groups[0].skipped = 1;
    },
    (f) => {
      f.browser.groups[0].flaky = 1;
    },
    (f) => {
      f.browser.groups[0].files = ["missing.spec.mjs"];
    },
  ];
  for (const change of changes) {
    const facts = fixture();
    change(facts);
    assert.equal(evaluateEvidence(facts).status, "blocked");
  }
});

test("evidence refuses dirty, changing, unpushed or mismatched publication state", () => {
  for (const change of [
    (f) => {
      f.source.dirty = true;
    },
    (f) => {
      f.publication.dirty = true;
    },
    (f) => {
      f.finalHead = "4".repeat(40);
    },
    (f) => {
      f.finalSourceHash = "b".repeat(64);
    },
    (f) => {
      f.publication.tree = "4".repeat(40);
    },
    (f) => {
      f.publication.originMatches = false;
    },
    (f) => {
      f.publication.cachedRemoteHead = "4".repeat(40);
    },
    (f) => {
      f.finalPublicationHead = "4".repeat(40);
    },
    (f) => {
      f.publication.head = null;
    },
  ]) {
    const facts = fixture();
    change(facts);
    assert.equal(evaluateEvidence(facts).status, "blocked");
  }
});

test("requested hosted evidence must confirm the exact public main and Verify commit", () => {
  const facts = fixture();
  facts.hosted = {
    requested: true,
    status: "passed",
    remoteHead: facts.publication.head,
    run: { headSha: facts.publication.head },
  };
  assert.equal(evaluateEvidence(facts).status, "current");
  for (const change of [
    (f) => {
      f.hosted.remoteHead = "4".repeat(40);
    },
    (f) => {
      f.hosted.run.headSha = "4".repeat(40);
    },
    (f) => {
      f.hosted.status = "not-passed";
    },
  ]) {
    const changed = structuredClone(facts);
    change(changed);
    assert.equal(evaluateEvidence(changed).status, "blocked");
  }
});
