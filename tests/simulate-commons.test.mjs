import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateCommons } from "../scripts/simulate-commons.mjs";
import example from "../shared/commons-fixture-seed17.json" with { type: "json" };

test("seeded Commons fixture reproduces conflicts, review, failures, retry, cancellation and paging", async () => {
  const first = await simulateCommons(17);
  const replay = await simulateCommons(17);
  assert.deepEqual(replay, first);
  assert.deepEqual(first, example);
  assert.equal(first.outcomes.staleRevisionStatus, 409);
  assert.equal(first.outcomes.acceptedMergeVersion, 1);
  assert.equal(first.outcomes.scenarioRevisionPreserved, true);
  assert.ok(first.outcomes.pages > 1);
  assert.equal(first.modelInference, false);
  const larger = await simulateCommons(18, { historyCount: 24 });
  assert.equal(larger.historyCount, 24);
  assert.ok(larger.outcomes.pages > first.outcomes.pages);
  assert.notEqual(larger.outcomes.acceptedSourceHash, first.outcomes.acceptedSourceHash);
});

test("simulation rejects invalid seed before opening a store", async () => {
  await assert.rejects(simulateCommons(-1), /Seed/);
  await assert.rejects(simulateCommons(1.5), /Seed/);
  await assert.rejects(simulateCommons(17, { historyCount: 41 }), /History count/);
});
