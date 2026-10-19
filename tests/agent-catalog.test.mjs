import { test } from "node:test";
import assert from "node:assert/strict";
import { agentCatalog, validateAgentCatalog } from "../shared/agent-catalog.mjs";
import { evaluationFixtures, validateAgentOutput } from "../shared/agent-evaluation.mjs";

test("proposed agent catalog has distinct disabled roles and source-backed model IDs", () => {
  assert.deepEqual(validateAgentCatalog(), { count: 18, documented: 12, enabled: 0 });
  for (const profile of agentCatalog) {
    assert.ok(evaluationFixtures[profile.fixture]);
    assert.equal(profile.artifactType, evaluationFixtures[profile.fixture].type);
    assert.ok(profile.model.id ? profile.model.source : profile.activation.includes("Verify an exact model"));
  }
});

test("host contract rejects stale, mismatched, oversized and fabricated output claims", () => {
  for (const profile of agentCatalog) {
    const expected = { runId: "fixture-run", projectId: "fixture-project", sourceRevision: 4,
      allowedEvidence: ["project/readme.md:4"] };
    const valid = {
      profileId: profile.id,
      runId: expected.runId,
      projectId: expected.projectId,
      artifactType: profile.artifactType,
      sourceRevision: expected.sourceRevision,
      summary: "Proposal with explicit uncertainty.",
      evidence: ["project/readme.md:4"],
      uncertainties: ["No runtime check was performed."],
      runtimeVerified: false,
      merged: false,
    };
    assert.deepEqual(validateAgentOutput(profile, expected, valid), { ok: true });
    for (const changed of [
      { sourceRevision: -1 },
      { sourceRevision: 3 },
      { runId: "other-run" },
      { projectId: "other-project" },
      { profileId: "someone-else" },
      { artifactType: "different" },
      { summary: "x".repeat(8001) },
      { evidence: [false] },
      { evidence: ["project/invented.md:1"] },
      { runtimeVerified: true },
      { merged: true },
      { toolCalls: [] },
    ])
      assert.equal(validateAgentOutput(profile, expected, { ...valid, ...changed }).ok, false);
    assert.equal(validateAgentOutput(profile, { ...expected, sourceRevision: -1 }, valid).ok, false);
  }
});
