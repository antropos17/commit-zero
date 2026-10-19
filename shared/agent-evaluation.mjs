// Contract fixtures check host-side envelopes, not a model's ability to produce them.
export const evaluationFixtures = Object.freeze({
  "source-with-conflicting-claims": { task: "Find two conflicting source claims and label uncertainty.", type: "sources" },
  "ambiguous-issue": { task: "Classify a report with no steps to reproduce.", type: "triage" },
  "stale-base-patch": { task: "Propose a patch against a stale project revision.", type: "patch" },
  "test-case-generation": { task: "Produce cases for stale project revisions.", type: "tests" },
  "narrow-keyboard-flow": { task: "Inspect a narrow, keyboard-only navigation flow.", type: "design" },
  "review-disagreement": { task: "Review a patch when two reviewers disagree.", type: "review" },
  "migration-choice": { task: "Choose a reversible storage migration path.", type: "decision" },
  "missing-document": { task: "Summarize a project page that cannot be found.", type: "notes" },
  "invalid-output": { task: "Classify malformed source content without inventing fields.", type: "content" },
  "outdated-quickstart": { task: "Correct an outdated startup command.", type: "docs" },
  "incorrect-complexity": { task: "Check a claimed algorithmic complexity bound.", type: "analysis" },
  "large-repository-map": { task: "Map a large repository with bounded context.", type: "map" },
});

export function validateAgentOutput(profile, envelope) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope))
    return { ok: false, reason: "Expected an object envelope." };
  if (envelope.profileId !== profile.id || envelope.artifactType !== profile.artifactType)
    return { ok: false, reason: "Profile or artifact type mismatch." };
  if (!Number.isInteger(envelope.sourceRevision) || envelope.sourceRevision < 0)
    return { ok: false, reason: "Source revision is required." };
  if (typeof envelope.summary !== "string" || !envelope.summary.trim() || envelope.summary.length > 8000)
    return { ok: false, reason: "A bounded summary is required." };
  if (!Array.isArray(envelope.evidence) || envelope.evidence.length > 20 ||
      envelope.evidence.some((item) => typeof item !== "string" || !item.trim() || item.length > 500))
    return { ok: false, reason: "Evidence must be bounded source references." };
  if (!Array.isArray(envelope.uncertainties) || envelope.uncertainties.length > 20 ||
      envelope.uncertainties.some((item) => typeof item !== "string" || !item.trim() || item.length > 500))
    return { ok: false, reason: "Uncertainties must be bounded statements." };
  if (envelope.runtimeVerified !== false || envelope.merged !== false)
    return { ok: false, reason: "Catalog output cannot assert execution or merge." };
  return { ok: true };
}
