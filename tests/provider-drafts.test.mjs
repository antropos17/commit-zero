import { test } from "node:test";
import assert from "node:assert/strict";
import { agentCatalog } from "../shared/agent-catalog.mjs";
import { draftProviderExchange, inspectProviderExchange } from "../shared/provider-drafts.mjs";

const expected = { runId: "fixture-run", projectId: "fixture-project", sourceRevision: 4 };
const profiles = Object.fromEntries(agentCatalog.map((profile) => [profile.model.provider, profile]));

function envelope(profile, changes = {}) {
  return JSON.stringify({
    profileId: profile.id, runId: expected.runId, projectId: expected.projectId,
    sourceRevision: expected.sourceRevision, artifactType: profile.artifactType,
    summary: "A bounded proposal.", evidence: ["README.md:4"],
    uncertainties: ["No runtime result."], runtimeVerified: false, merged: false,
    ...changes,
  });
}

function response(profile, text) {
  switch (profile.model.provider) {
    case "anthropic":
      return { model: profile.model.id, stop_reason: "end_turn", content: [{ type: "text", text }] };
    case "openai":
      return { model: profile.model.id, status: "completed", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }] };
    case "google":
      return { candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] };
    case "mistral":
      return { model: profile.model.id, choices: [{ finish_reason: "stop", message: { role: "assistant", content: text } }] };
  }
}

test("hosted request drafts stay bounded, credential-free, and disconnected", () => {
  for (const provider of ["anthropic", "openai", "google", "mistral"]) {
    const profile = profiles[provider];
    const draft = draftProviderExchange(profile, expected, "Explain the failed test.", ["README.md:4"]);
    assert.equal(draft.provider, provider);
    assert.equal(draft.method, "POST");
    assert.equal(draft.transport, "not-connected");
    assert.equal(draft.toolExecution, false);
    assert.match(draft.url, /^https:\/\//);
    assert.ok(!/api.key|authorization|secret/i.test(JSON.stringify(draft.body)));
    assert.equal(Object.hasOwn(draft.body, "tools"), false);
    assert.ok(JSON.stringify(draft).includes(profile.model.id));
    assert.ok(JSON.stringify(draft.body).includes("fixture-run"));
  }
  assert.throws(() => draftProviderExchange(profiles.local, expected, "Task"), /documented/);
  assert.throws(() => draftProviderExchange(profiles.openai, expected, "x".repeat(24000)), /ceiling/);
  assert.throws(() => draftProviderExchange(profiles.openai, { ...expected, sourceRevision: -1 }, "Task"), /context/);
});

test("offline response contracts reject stale, incomplete, tool, and false verification output", () => {
  for (const provider of ["anthropic", "openai", "google", "mistral"]) {
    const profile = profiles[provider];
    const valid = response(profile, envelope(profile));
    assert.equal(inspectProviderExchange(profile, expected, valid).ok, true, provider);
    assert.equal(inspectProviderExchange(profile, expected,
      response(profile, envelope(profile, { sourceRevision: 3 }))).ok, false, provider);
    assert.equal(inspectProviderExchange(profile, expected,
      response(profile, envelope(profile, { runtimeVerified: true }))).ok, false, provider);
    assert.equal(inspectProviderExchange(profile, expected,
      response(profile, "```json\n{}\n```")).ok, false, provider);
    assert.equal(inspectProviderExchange(profile, expected,
      response(profile, "x".repeat(profile.limits.outputCharacters + 1))).ok, false, provider);
  }
  const anthropic = profiles.anthropic;
  assert.equal(inspectProviderExchange(anthropic, expected,
    { ...response(anthropic, envelope(anthropic)), stop_reason: "max_tokens" }).ok, false);
  const openai = profiles.openai;
  assert.equal(inspectProviderExchange(openai, expected,
    { ...response(openai, envelope(openai)), output: [{ type: "function_call" }] }).ok, false);
  const google = profiles.google;
  assert.equal(inspectProviderExchange(google, expected,
    { candidates: [{ finishReason: "SAFETY" }] }).ok, false);
  assert.equal(inspectProviderExchange(google, expected,
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: envelope(google), functionCall: {} }] } }] }).ok, false);
  const mistral = profiles.mistral;
  assert.equal(inspectProviderExchange(mistral, expected,
    { choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{}] } }] }).ok, false);
});
