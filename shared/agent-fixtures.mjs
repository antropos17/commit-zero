import { evaluationFixtures, validateAgentOutput } from "./agent-evaluation.mjs";

// These inputs and example envelopes are authored fixtures, never model output.
// Criteria describe later role qualification; the host runner does not score prose.
const cases = {
  "source-with-conflicting-claims": {
    references: [["fixture/cache-a.md:1", "The cache retains entries for 60 seconds."], ["fixture/cache-b.md:1", "The cache retains entries for 120 seconds. Neither document has a date."]],
    criteria: ["Cite both supplied sources.", "Keep the retention interval unresolved until implementation evidence is available."],
    summary: "The two supplied documents disagree on retention. Inspect the implementation before choosing a value.",
    uncertainty: "The correct retention interval is unknown.",
  },
  "ambiguous-issue": {
    references: [["fixture/issue.md:1", "The project sometimes stops. No input, version, logs or reproduction steps were supplied."]],
    criteria: ["Classify this as an unconfirmed failure report.", "Request version, input, observed result and reproduction steps without inventing severity."],
    summary: "Prepare an unconfirmed bug report and request the missing reproduction details.",
    uncertainty: "Frequency, impact and root cause are unverified.",
  },
  "stale-base-patch": {
    references: [["fixture/task.json:1", "Expected project revision: 4. Supplied timer.js belongs to revision 3."], ["fixture/timer.js:1", "export const elapsed = (now, previous) => now - previous;"]],
    criteria: ["Identify the stale source before proposing a change.", "Request revision-4 source and keep the proposal unmerged."],
    summary: "The supplied file is stale. Obtain revision-4 source before preparing a patch.",
    uncertainty: "The current timer implementation was not supplied.",
  },
  "test-case-generation": {
    references: [["fixture/api.md:1", "A write supplies runId and version. A stale version returns HTTP 409 and must not append an event."]],
    criteria: ["Specify current-write, stale-write and retained-draft cases.", "Assert event count and unchanged revision after the rejected write."],
    summary: "Test a current write, a competing stale write returning 409, and an explicit retry with the retained draft.",
    uncertainty: "These test cases have not executed application code.",
  },
  "narrow-keyboard-flow": {
    references: [["fixture/interface.md:1", "At 390px, all navigation destinations stay visible. Selecting a role updates details above the list without moving focus."]],
    criteria: ["Keep navigation permanently visible.", "Propose focus on the selected heading and verify keyboard reachability and page width."],
    summary: "Move focus to the selected role heading at narrow width, then verify keyboard navigation and overflow.",
    uncertainty: "No browser observation accompanies this input.",
  },
  "review-disagreement": {
    references: [["fixture/review-a.md:1", "Reviewer A approves patch hash abc at revision 4."], ["fixture/review-b.md:1", "Reviewer B rejects patch hash abc because negative elapsed time remains unhandled."]],
    criteria: ["Retain both review decisions and their patch identity.", "Keep merge blocked while the concrete negative-time concern is unresolved."],
    summary: "Retain the disagreement and investigate the negative-time case before requesting another review.",
    uncertainty: "The supplied reviews do not establish patch behavior.",
  },
  "migration-choice": {
    references: [["fixture/storage.md:1", "Migration 001 is applied. New writes require a separate issues relation. Existing run history must survive."]],
    criteria: ["Add a migration instead of editing applied SQL.", "Require a disposable restore/migration rehearsal and preserve the original store."],
    summary: "Prepare an additive migration with a disposable recovery rehearsal and explicit rollback boundaries.",
    uncertainty: "The migration has not been executed against a runtime store.",
  },
  "missing-document": {
    references: [["fixture/manifest.json:1", "Available files: README.md, src/timer.js. Requested docs/OPERATIONS.md is absent."]],
    criteria: ["Report the missing document with its exact path.", "Do not fabricate its contents or silently summarize another file."],
    summary: "docs/OPERATIONS.md is absent from the supplied manifest; request it before summarizing operations.",
    uncertainty: "No operations document was available.",
  },
  "invalid-output": {
    references: [["fixture/content.txt:1", "Input is malformed JSON: {\"title\":\"Timer\",\"category\": . No valid category was supplied."]],
    criteria: ["Preserve the raw source and report the parse failure.", "Keep the missing category unresolved instead of inventing a value."],
    summary: "The source is malformed; retain the raw input and request a valid category.",
    uncertainty: "Category cannot be determined from this input.",
  },
  "outdated-quickstart": {
    references: [["fixture/README.md:1", "Fresh checkout instructions say npm start."], ["fixture/package.json:1", "dev builds and starts services; start serves existing dist. Fresh checkouts have no dist."]],
    criteria: ["Use the documented development command for a fresh checkout.", "Keep production build/start instructions separate and state verification limits."],
    summary: "Change fresh-checkout startup to npm run dev; retain build then start for compiled serving.",
    uncertainty: "No installation or startup was run for this example.",
  },
  "incorrect-complexity": {
    references: [["fixture/search.js:1", "for (const a of items) for (const b of items) compare(a, b); // claimed O(n)"]],
    criteria: ["Count both loops rather than accepting the comment.", "State the assumptions on compare and distinguish time from space."],
    summary: "The nested loops perform n squared comparisons; with constant-time compare, time is O(n squared).",
    uncertainty: "The cost of compare was not supplied.",
  },
  "large-repository-map": {
    references: [["fixture/map.json:1", "Entries: server/commons/app.mjs, server/commons/store.mjs, prototype/app/pages/commons.jsx, tests/commons.test.mjs. Scope is one Commons defect; context ceiling is 24000 characters."]],
    criteria: ["Choose the API, store, UI and focused test entry points within scope.", "Request only relevant bounded excerpts and preserve ownership boundaries."],
    summary: "Start with the Commons API and store contract, then inspect the UI action and focused test for the reported defect.",
    uncertainty: "The supplied map is a fixture, not a live repository inventory.",
  },
};

export function createAgentFixture(profile) {
  const definition = evaluationFixtures[profile?.fixture], data = cases[profile?.fixture];
  if (!definition || !data || definition.type !== profile.artifactType)
    throw new Error("The profile has no matching deterministic fixture.");
  const references = data.references.map(([id, text]) => ({ id, text }));
  const expected = { runId: "fixture-run", projectId: "fixture-project", sourceRevision: 4,
    allowedEvidence: references.map((reference) => reference.id) };
  return {
    schema: "commit-zero-agent-fixture/1", profileId: profile.id,
    fixtureId: profile.fixture, evidence: "synthetic-host-fixture", modelCalls: 0,
    input: { task: definition.task, references }, expected,
    futureEvaluationCriteria: [...data.criteria],
    exampleOutput: { profileId: profile.id, runId: expected.runId,
      projectId: expected.projectId, sourceRevision: expected.sourceRevision,
      artifactType: profile.artifactType,
      summary: data.summary, evidence: [...expected.allowedEvidence],
      uncertainties: [data.uncertainty, "Synthetic example; no model or code execution."],
      runtimeVerified: false, merged: false },
  };
}

export function exerciseAgentFixtures(catalog) {
  return catalog.map((profile) => {
    const fixture = createAgentFixture(profile);
    const valid = validateAgentOutput(profile, fixture.expected, fixture.exampleOutput);
    const rejected = [
      { sourceRevision: 3 }, { runId: "other-run" }, { projectId: "other-project" },
      { evidence: ["fixture/fabricated.md:1"] }, { runtimeVerified: true },
      { merged: true }, { summary: "" },
    ].map((change) => !validateAgentOutput(profile, fixture.expected,
      { ...fixture.exampleOutput, ...change }).ok);
    return { profileId: profile.id, fixtureId: fixture.fixtureId,
      exampleAccepted: valid.ok, negativeCasesRejected: rejected.filter(Boolean).length,
      expectedNegativeCases: rejected.length, ok: valid.ok && rejected.every(Boolean) };
  });
}
