import { hash } from "./store.mjs";
import {
  arenaFitness,
  playArena,
  validateArenaStrategy,
  policyHash,
} from "./arena-engine.mjs";
import { flatStrategy, routingContext, routingRule } from "./arena-router.mjs";

const points = (score) => (score > 0 ? 2 : score === 0 ? 1 : 0);
function perGame(fitness, games) {
  return games.map((game, index) => ({
    key: routingRule(game),
    name: game.name,
    points: fitness.results
      .filter((r) => r.game === index)
      .reduce((n, r) => n + points(r.score), 0),
  }));
}

// Expert source is always retained. All admission/training matches are executed;
// none of the previous or current run's unseen-test outcomes enter the learner.
export function learnSpecialists(
  language,
  games,
  previous,
  candidates,
  opponents,
) {
  const baseline = flatStrategy(previous);
  const trainSeeds = [31, 32],
    controlSeeds = [2001, 2002, 2003, 2004];
  const baselineTraining = arenaFitness(
    language,
    games,
    baseline,
    opponents,
    trainSeeds,
  );
  const baselineControl = arenaFitness(
    language,
    games,
    baseline,
    opponents,
    controlSeeds,
  );
  const training = perGame(baselineTraining, games),
    control = perGame(baselineControl, games);
  const assessments = [];
  const seen = new Set([policyHash(baseline)]);
  for (const entry of candidates) {
    const strategy = flatStrategy(entry.strategy),
      key = policyHash(strategy);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      validateArenaStrategy(language, games, strategy);
    } catch {
      continue;
    }
    const trained = arenaFitness(
      language,
      games,
      strategy,
      opponents,
      trainSeeds,
    );
    const checked = arenaFitness(
      language,
      games,
      strategy,
      opponents,
      controlSeeds,
    );
    const train = perGame(trained, games),
      test = perGame(checked, games);
    const strengths = games
      .map((g, i) => ({
        key: routingRule(g),
        game: g.name,
        training: [training[i].points, train[i].points],
        control: [control[i].points, test[i].points],
      }))
      .filter(
        (r) => r.control[1] > r.control[0] && r.training[1] >= r.training[0],
      );
    assessments.push({
      strategy,
      source: entry.source,
      strengths,
      trainingHash: hash(trained),
      controlHash: hash(checked),
    });
  }
  const retained = assessments
    .filter((a) => a.strengths.length)
    .sort(
      (a, b) =>
        Math.max(...b.strengths.map((s) => s.control[1] - s.control[0])) -
          Math.max(...a.strengths.map((s) => s.control[1] - s.control[0])) ||
        policyHash(a.strategy).localeCompare(policyHash(b.strategy)),
    )
    .slice(0, 6);
  const experts = retained.map((r) => r.strategy),
    all = [baseline, ...experts];
  const trainingMatches = [];
  const rules = games.map((game) => {
    const key = routingRule(game);
    const overall = all.map(() => ({ points: 0, matches: 0 })),
      contexts = {};
    for (const [index, strategy] of all.entries())
      for (const [opponentIndex, opponent] of opponents.entries())
        for (const seed of [41, 42, 43])
          for (const seat of [0, 1]) {
            const match = playArena(
              language,
              game,
              seat ? [opponent, strategy] : [strategy, opponent],
              seed,
            );
            const result = points(seat ? -match.score : match.score);
            overall[index].points += result;
            overall[index].matches++;
            const state = {
                round: 0,
                counts: [
                  [0, 0, 0],
                  [0, 0, 0],
                ],
              },
              visited = new Set();
            for (const turn of match.rounds) {
              state.round = turn.round;
              visited.add(routingContext(game, state, seat));
              for (const p of [0, 1]) state.counts[p][turn.actions[p]]++;
            }
            for (const context of visited) {
              contexts[context] ||= all.map(() => ({ points: 0, matches: 0 }));
              contexts[context][index].points += result;
              contexts[context][index].matches++;
            }
            trainingMatches.push({
              rule: key,
              index,
              opponent: opponentIndex,
              seed,
              seat,
              hash: hash(match),
            });
          }
    return {
      key,
      game: game.name,
      allowed: [
        0,
        ...retained.flatMap((r, i) =>
          r.strengths.some((s) => s.key === key) ? [i + 1] : [],
        ),
      ],
      overall,
      contexts,
    };
  });
  const candidate = {
    ...baseline,
    name: `${baseline.name.slice(0, 32)} portfolio`,
    portfolio: {
      version: 1,
      provenance: "empirical_context_selector",
      experts,
      rules,
    },
  };
  return {
    baseline,
    assessments,
    retained,
    trainingMatches,
    candidate,
    baselineTrainingHash: hash(baselineTraining),
    baselineControlHash: hash(baselineControl),
    interpretation:
      "Host-implemented empirical selector over model-authored programs. Training labels are executed match outcomes, not causal counterfactuals. Choices see rules and past opponent actions only. Unknown rules use baseline. Unseen evaluation never trains this selector.",
  };
}
