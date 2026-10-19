import { hash } from "./store.mjs";
import { behavior, distance, validateArenaStrategy } from "./arena-engine.mjs";

export const FAILURE_MEMORY_LIMIT = 6;
export const RETRY_LIMIT = 6;
export const APPROACHES = [
  "Diagnose which observation misled the incumbent. Write a correction grounded in the executed loss, not a restatement of the old formula.",
  "Reconsider resource accounting: immediate payoff versus energy left for future choices. Invent your own expression; do not reuse the failed formula.",
  "Reconsider phase transitions: distinguish the current payoff pattern from accumulated opponent history. Explain which prior assumption you are abandoning.",
  "Reconsider opponent prediction: separate recent behavior from longer-run frequencies. Use the measured failures to decide what to trust.",
  "Try a simpler scoring hypothesis with fewer interacting terms. Explain the failure it avoids; do not copy a previous expression.",
  "Try a different composition of the available functions. Check their actual semantics and describe a falsifiable reason it should improve the failed cases.",
];

// Changing prose, temperature, or algebraic spelling is not a new approach.
export function revisionNovelty(language, games, previous, candidate, memory) {
  const references = [
    { strategy: previous, source: { kind: "incumbent" } },
    ...memory,
  ];
  const exact = references.find(
    (r) => hash(r.strategy.score) === hash(candidate.score),
  );
  if (exact)
    return {
      novel: false,
      reason: "Repeated expression",
      source: exact.source,
      distance: 0,
    };
  validateArenaStrategy(language, games, candidate);
  const signature = behavior(language, games, candidate);
  for (const reference of references) {
    // An ill-typed earlier program can only be compared by source identity.
    if (reference.invalid) continue;
    const delta = distance(
      signature,
      behavior(language, games, reference.strategy),
    );
    if (delta < 0.01)
      return {
        novel: false,
        reason: "Behavioral duplicate on common probes",
        source: reference.source,
        distance: delta,
      };
  }
  return {
    novel: true,
    reason:
      "Different expression and at least 1% behavioral distance from remembered failures and incumbent",
  };
}

export function developmentFeedback(evaluation, games) {
  const failures = evaluation.trainingAfter.results
    .map((r, i) => ({
      game: games[r.game].name,
      opponent: r.opponent,
      seed: r.seed,
      seat: r.seat,
      before: evaluation.trainingBefore.results[i].score,
      after: r.score,
    }))
    .filter((r) => r.after < r.before)
    .sort((a, b) => a.after - a.before - (b.after - b.before))
    .slice(0, 2);
  return {
    control: [evaluation.before.points, evaluation.after.points],
    training: [
      evaluation.trainingBefore.points,
      evaluation.trainingAfter.points,
    ],
    distance: evaluation.diversity.minimum,
    reason: evaluation.reason,
    failures,
  };
}

export function rememberFailure(memory, entry) {
  const key = hash(entry.strategy.score);
  // Do not evict useful history by repeatedly recording the same program.
  const unique = memory.filter((r) => hash(r.strategy.score) !== key);
  return [...unique, entry].slice(-FAILURE_MEMORY_LIMIT);
}

export function revisionPrompt(base, memory, attempt, feedback) {
  const ledger = memory.map((r) => ({
    source: r.source,
    score: r.strategy.score,
    temperature: r.strategy.temperature,
    feedback: r.feedback,
    invalid: r.invalid || false,
  }));
  return `REVISION ATTEMPT ${attempt}/${RETRY_LIMIT}. Read the failed experiments FIRST.
Failed-program memory (development evidence only; never unseen test results): ${JSON.stringify(ledger)}
Latest rejection: ${feedback || "None in this revision yet."}
Current investigation: ${APPROACHES[attempt - 1]}
Write lesson (what evidence changed your mind), approach (how your hypothesis differs), diagnosis, evidence, hypothesis, and strategy. Source-identical and behaviorally equivalent proposals are rejected before tournament evaluation. Do not repeat any remembered expression. No candidate menu, host code synthesis or prewritten replacement exists.
Generation grammar excludes every known expression, including other active strategies and all drafts recorded in this continuation. Numeric literals in new code must be integers from -100 to 100; observed values remain real. The available operators and two call layers are unchanged. Invent a new composition; changing prose or temperature cannot bypass the exclusion.
${base}`;
}
