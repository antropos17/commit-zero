import { compileLanguage } from "./language.mjs";
import { resultType } from "./schema.mjs";
import { hash } from "./store.mjs";
import { selectStrategy } from "./arena-router.mjs";
import {
  arenaFitness,
  playArena,
  observations,
  expandArenaRules,
  gameFingerprint,
  policyHash,
  validateArenaStrategy,
  evaluateArenaCandidate,
  behavior,
  distance,
} from "./arena-engine.mjs";

export function evaluateModelRevision(
  language,
  games,
  previous,
  candidate,
  others,
  opponents,
) {
  const result = evaluateArenaCandidate(
    language,
    games,
    previous,
    candidate,
    others,
    opponents,
  );
  if (hash(previous.score) === hash(candidate.score))
    return {
      ...result,
      accepted: false,
      reason:
        "Expression unchanged; write new code, not just a name or temperature.",
    };
  return result;
}

export function compactReview(review) {
  const compact = {
    trainingPoints: review.trainingPoints,
    matches: review.matches,
    losses: review.losses,
    cases: review.cases.slice(0, 2).map((c) => ({
      game: c.game,
      score: c.score,
      opponent: c.opponent,
      mistakes: c.mistakes.slice(0, 1).map((m) => ({
        ...m,
        actions: m.actions.map((a) => ({
          action: a.action,
          legal: a.legal,
          score: a.score,
          probability: a.probability,
          hindsightPayoff: a.hindsightPayoff,
          observed: Object.fromEntries(
            Object.entries(a.observed).filter(([key]) =>
              [
                "action",
                "cost",
                "expected",
                "counter",
                "pay0",
                "pay1",
                "pay2",
              ].includes(key),
            ),
          ),
        })),
      })),
    })),
  };
  return JSON.stringify(compact, (_k, v) =>
    typeof v === "number" ? Math.round(v * 1000) / 1000 : v,
  );
}

// Diagnostics describe executed training matches, never prescribe replacement code.
export function lossReview(language, games, strategy, opponents) {
  const fitness = arenaFitness(language, games, strategy, opponents, [11, 12]);
  const machine = compileLanguage(language);
  const losses = fitness.results
    .filter((r) => r.score < 0)
    .sort((a, b) => a.score - b.score);
  const selected = losses
    .filter((r, i) => losses.findIndex((p) => p.game === r.game) === i)
    .slice(0, 3);
  const cases = selected.map((r) => {
    const game = games[r.game],
      seat = r.seat;
    const match = playArena(
      language,
      game,
      seat
        ? [opponents[r.opponent], strategy]
        : [strategy, opponents[r.opponent]],
      r.seed,
    );
    const state = {
      round: 0,
      energy: [game.energyCap, game.energyCap],
      last: [-1, -1],
      counts: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    };
    const mistakes = match.rounds
      .map((turn) => {
        state.round = turn.round;
        state.energy = turn.before;
        const chosen = turn.actions[seat],
          opponentAction = turn.actions[1 - seat];
        const active = selectStrategy(strategy, game, state, seat).strategy;
        const actions = game.actions.map((name, action) => {
          const observed = observations(game, state, seat, action);
          return {
            action,
            name,
            legal: game.costs[action] <= turn.before[seat],
            observed,
            score: machine.evaluate(active.score, observed),
            probability: turn.probabilities[seat][action],
            hindsightPayoff:
              game.payoffs[turn.phase][action * 3 + opponentAction],
          };
        });
        const payoff = actions[chosen].hindsightPayoff;
        const regret =
          Math.max(
            ...actions.filter((a) => a.legal).map((a) => a.hindsightPayoff),
          ) - payoff;
        const item = {
          round: turn.round + 1,
          phase: turn.phase + 1,
          energy: turn.before[seat],
          chosen,
          opponentAction,
          payoff,
          regret,
          actions,
        };
        for (let p = 0; p < 2; p++) {
          state.last[p] = turn.actions[p];
          state.counts[p][turn.actions[p]]++;
        }
        return item;
      })
      .sort((a, b) => b.regret - a.regret)
      .slice(0, 2);
    return {
      game: game.name,
      seed: r.seed,
      seat,
      opponent: opponents[r.opponent].name,
      score: r.score,
      matchHash: hash(match),
      mistakes,
    };
  });
  return {
    version: 2,
    trainingPoints: fitness.points,
    matches: fitness.matches,
    losses: losses.length,
    cases,
    interpretation:
      "Counterfactual payoffs use the already revealed opponent action. They measure one-step hindsight regret, not an action available to the policy or a causal long-term improvement. Only observed fields were available before choosing.",
  };
}

// Evaluation-only fixtures, generated once after all model revisions are frozen.
// No search, ranking or candidate-strategy selection takes place here.
export function transferSuite(language, existingGames, existingPolicies, seed) {
  let value = seed >>> 0;
  const next = (n) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % n;
  };
  const games = [];
  for (let attempt = 0; games.length < 2 && attempt < 100; attempt++) {
    const game = expandArenaRules({
      name: `Unseen rules ${games.length + 1}`,
      description:
        "Host-generated held-out resource benchmark; not model-authored.",
      actions: ["Probe", "Shield", "Strike"],
      phases: [
        { direction: 1, margins: [1 + next(5), 1 + next(5), 1 + next(5)] },
        { direction: -1, margins: [1 + next(5), 1 + next(5), 1 + next(5)] },
      ],
      costs: [0, 1 + next(3), 4],
      energyCap: 4 + next(5),
      recharge: 1 + next(3),
      phaseLength: 2 + next(5),
    });
    if (
      ![...existingGames, ...games].some(
        (g) => gameFingerprint(g) === gameFingerprint(game),
      )
    )
      games.push(game);
  }
  if (games.length !== 2)
    throw new Error("Could not construct novel test rules.");
  const functions = language.functions.filter(
    (f) => resultType(f.body) === "number",
  );
  const opponents = [];
  for (let attempt = 0; opponents.length < 3 && attempt < 100; attempt++) {
    const f = functions[next(functions.length)];
    const leaves = [
      "expected",
      "counter",
      "cost",
      "pay0",
      "pay1",
      "pay2",
      "energy",
      "phase",
      -1,
      0,
      1,
      2,
    ];
    const strategy = {
      name: `Unseen opponent ${opponents.length + 1}`,
      explanation:
        "Host-generated evaluation fixture; never offered as a candidate.",
      score: [f.name, ...f.params.map(() => leaves[next(leaves.length)])],
      temperature: 0.35 + next(260) / 100,
    };
    try {
      validateArenaStrategy(language, [...existingGames, ...games], strategy);
    } catch {
      continue;
    }
    const signature = behavior(
      language,
      [...existingGames, ...games],
      strategy,
    );
    if (
      ![...existingPolicies, ...opponents].some(
        (s) =>
          policyHash(s) === policyHash(strategy) ||
          distance(
            signature,
            behavior(language, [...existingGames, ...games], s),
          ) < 0.01,
      )
    )
      opponents.push(strategy);
  }
  if (opponents.length !== 3)
    throw new Error("Could not construct novel test opponents.");
  return {
    version: 1,
    provenance: "host_generated_evaluation_only",
    seed,
    games,
    opponents,
    seeds: [
      10000 + next(1000000),
      2000000 + next(1000000),
      4000000 + next(1000000),
      6000000 + next(1000000),
    ],
  };
}

export function transferEvaluation(
  language,
  suite,
  games,
  opponents,
  previous,
  candidate,
) {
  return [
    ["new-games", suite.games, opponents],
    ["new-opponents", games, suite.opponents],
    ["both-new", suite.games, suite.opponents],
  ].map(([scope, testGames, testOpponents]) => ({
    scope,
    before: arenaFitness(
      language,
      testGames,
      previous,
      testOpponents,
      suite.seeds,
    ),
    after: arenaFitness(
      language,
      testGames,
      candidate,
      testOpponents,
      suite.seeds,
    ),
  }));
}
