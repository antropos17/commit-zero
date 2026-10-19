import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { agentCatalog } from "../shared/agent-catalog.mjs";
import { createAgentFixture, exerciseAgentFixtures } from "../shared/agent-fixtures.mjs";
import { validateAgentOutput } from "../shared/agent-evaluation.mjs";

test("every disabled role has concrete bounded inputs and a valid synthetic host example", () => {
  for (const profile of agentCatalog) {
    const fixture = createAgentFixture(profile);
    assert.equal(fixture.modelCalls, 0);
    assert.equal(fixture.profileId, profile.id);
    assert.ok(fixture.input.references.every((reference) => reference.text && reference.id));
    assert.ok(fixture.futureEvaluationCriteria.length >= 2);
    assert.ok(JSON.stringify(fixture.input).length < profile.limits.contextCharacters);
    assert.deepEqual(validateAgentOutput(profile, fixture.expected, fixture.exampleOutput), { ok: true });
  }
  const results = exerciseAgentFixtures(agentCatalog);
  assert.equal(results.length, 18);
  assert.equal(new Set(results.map((result) => result.fixtureId)).size, 12);
  assert.ok(results.every((result) => result.ok && result.negativeCasesRejected === 7));
  assert.throws(() => createAgentFixture({ fixture: "missing", artifactType: "notes" }), /matching/);
});

test("host evidence allowlists reject invented references and cannot be granted by output", () => {
  const profile = agentCatalog[0], fixture = createAgentFixture(profile);
  assert.equal(validateAgentOutput(profile, { ...fixture.expected, allowedEvidence: [] }, fixture.exampleOutput).ok, false);
  assert.equal(validateAgentOutput(profile, { ...fixture.expected, allowedEvidence: null }, fixture.exampleOutput).ok, false);
  assert.equal(validateAgentOutput(profile, fixture.expected, { ...fixture.exampleOutput,
    evidence: ["fixture/invented.md:1"], allowedEvidence: ["fixture/invented.md:1"] }).ok, false);
  const second = createAgentFixture(profile);
  fixture.input.references[0].text = "changed copy";
  assert.notEqual(second.input.references[0].text, "changed copy");
});

test("prepared role holdouts stay distinct from exported demonstration inputs", async () => {
  const holdout = JSON.parse(await readFile(new URL("./fixtures/agent-evaluation-holdout.json", import.meta.url), "utf8"));
  assert.equal(holdout.schema, "commit-zero-agent-holdout/1");
  assert.equal(new Set(holdout.cases.map((item) => item.id)).size, 12);
  const demoTexts = agentCatalog.flatMap((profile) => createAgentFixture(profile).input.references.map((reference) => reference.text));
  for (const profile of agentCatalog) {
    const cases = holdout.cases.filter((item) => item.artifactType === profile.artifactType);
    assert.ok(cases.length);
    for (const item of cases) {
      assert.ok(JSON.stringify(item).length < profile.limits.contextCharacters);
      assert.ok(item.references.every((reference) => reference.id && reference.text && !demoTexts.includes(reference.text)));
      assert.ok(item.criteria.length >= 2);
      assert.equal(Object.hasOwn(item, "exampleOutput"), false);
    }
  }
});
