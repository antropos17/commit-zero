import { compileLanguage, fields } from "./language.mjs";
import { hash } from "./store.mjs";
import { resultType } from "./schema.mjs";
import { selectStrategy } from "./arena-router.mjs";

export const DIVERSITY_FLOOR = 0.12;
export const ARENA_VERSION = 1;
export const variables = [
  "action",
  "phase",
  "round",
  "energy",
  "oppEnergy",
  "lastSelf",
  "lastOpp",
  "cost",
  "pay0",
  "pay1",
  "pay2",
  "expected",
  "counter",
  "opp0",
  "opp1",
  "opp2",
];
const ensure = (ok, message) => {
  if (!ok) throw new Error(message);
};
const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const text = (v, max) =>
  typeof v === "string" && v.trim().length >= 2 && v.length <= max;
const obj = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const tuple = (items) => ({
  type: "array",
  prefixItems: items,
  minItems: items.length,
  maxItems: items.length,
});
const number = (minimum, maximum) => ({ type: "integer", minimum, maximum });
const phaseSchema = obj({
  direction: { enum: [-1, 1] },
  margins: tuple([number(1, 5), number(1, 5), number(1, 5)]),
});
export const arenaGameSchema = obj({
  name: { type: "string", minLength: 2, maxLength: 48 },
  description: { type: "string", minLength: 2, maxLength: 500 },
  actions: tuple(
    Array.from({ length: 3 }, () => ({
      type: "string",
      minLength: 2,
      maxLength: 24,
    })),
  ),
  phases: tuple([phaseSchema, phaseSchema]),
  costs: tuple([number(0, 4), number(0, 4), number(0, 4)]),
  energyCap: number(4, 8),
  recharge: number(1, 3),
  phaseLength: number(2, 6),
});
export const arenaGameContract = `Invent rules for a simultaneous-action resource game. Return the exact schema. Choose three distinct action names. phases contains TWO objects {direction, margins}. direction=1 means action 0 beats 1, 1 beats 2, 2 beats 0; -1 reverses these counters. margins contains three payoff magnitudes 1..5 for those edges respectively. The host expands these edges into a zero-sum payoff matrix with tied identical actions. The two phases must differ in direction or margins. Costs are three integers 0..4: at least one zero-cost action, and largest cost above recharge. energyCap=4..8, recharge=1..3, phaseLength=2..6. Players start with full energy, simultaneously choose affordable actions, receive payoff, pay costs and recharge up to cap. 24 rounds; phase alternates every phaseLength rounds. Invent meaningful resource and phase tradeoffs. The host defines this bounded game family; you author its numeric rules. No extra fields.`;

export function expandArenaRules(draft) {
  fields(draft, [
    "name",
    "description",
    "actions",
    "phases",
    "costs",
    "energyCap",
    "recharge",
    "phaseLength",
  ]);
  ensure(
    Array.isArray(draft.phases) && draft.phases.length === 2,
    "Two phases required.",
  );
  const { phases, ...game } = draft;
  game.payoffs = phases.map((phase) => {
    fields(phase, ["direction", "margins"]);
    ensure(
      [-1, 1].includes(phase.direction) &&
        Array.isArray(phase.margins) &&
        phase.margins.length === 3 &&
        phase.margins.every((v) => integer(v, 1, 5)),
      "Invalid phase edges.",
    );
    const [a, b, c] = phase.margins.map((v) => v * phase.direction);
    return [0, a, -c, -a, 0, b, c, -b, 0];
  });
  return validateArenaGame(game);
}

export function gameFingerprint(game) {
  const { payoffs, costs, energyCap, recharge, phaseLength } = game;
  return hash({ payoffs, costs, energyCap, recharge, phaseLength });
}
export function validateArenaGame(game) {
  fields(game, [
    "name",
    "description",
    "actions",
    "payoffs",
    "costs",
    "energyCap",
    "recharge",
    "phaseLength",
  ]);
  ensure(
    text(game.name, 48) && text(game.description, 500),
    "Use a name of 2..48 and description of 2..500 characters.",
  );
  ensure(
    Array.isArray(game.actions) &&
      game.actions.length === 3 &&
      game.actions.every((a) => text(a, 24)) &&
      new Set(game.actions).size === 3,
    "Use three distinct action names.",
  );
  ensure(
    Array.isArray(game.payoffs) && game.payoffs.length === 2,
    "Supply two payoff matrices.",
  );
  for (const matrix of game.payoffs) {
    ensure(
      Array.isArray(matrix) &&
        matrix.length === 9 &&
        matrix.every((v) => integer(v, -5, 5)),
      "Each matrix has nine integer entries in -5..5.",
    );
    for (let a = 0; a < 3; a++) {
      ensure(matrix[a * 3 + a] === 0, "Diagonal entries must be zero.");
      const row = matrix.slice(a * 3, a * 3 + 3);
      ensure(
        row.some((v) => v > 0) && row.some((v) => v < 0),
        `Action ${a} must beat one action and lose to another in each phase.`,
      );
      for (let b = 0; b < 3; b++)
        ensure(
          matrix[a * 3 + b] === -matrix[b * 3 + a],
          "Opposite payoff entries must sum to zero.",
        );
    }
  }
  ensure(
    hash(game.payoffs[0]) !== hash(game.payoffs[1]),
    "Phases must change executable payoffs, not just names.",
  );
  ensure(
    integer(game.energyCap, 4, 8) &&
      integer(game.recharge, 1, 3) &&
      integer(game.phaseLength, 2, 6),
    "Invalid resource or phase bounds.",
  );
  ensure(
    Array.isArray(game.costs) &&
      game.costs.length === 3 &&
      game.costs.every((v) => integer(v, 0, 4)) &&
      game.costs.includes(0) &&
      new Set(game.costs).size > 1 &&
      Math.max(...game.costs) > game.recharge &&
      Math.max(...game.costs) <= game.energyCap,
    `Invalid costs ${JSON.stringify(game.costs)} with recharge=${game.recharge}. Include cost 0. At least one cost MUST be strictly greater than recharge. Set recharge=1 and a cost=3 or 4 to satisfy this. Max cost is 4.`,
  );
  return game;
}
export function arenaStrategySchema(language) {
  // Finite grammar prevents runaway recursive JSON generation in local providers.
  const leaf = {
    anyOf: [
      { type: "number", minimum: -100, maximum: 100 },
      { type: "boolean" },
      { type: "string", enum: variables },
    ],
  };
  const numericParams = (f) => {
    const required = new Set();
    const visit = (node, numeric = false) => {
      if (typeof node === "string") {
        if (numeric) required.add(node);
        return;
      }
      if (!Array.isArray(node)) return;
      const arithmetic = ["add", "sub", "mul", "mod", "lt", "lte"].includes(
        node[0],
      );
      node
        .slice(1)
        .forEach((child, i) =>
          visit(child, arithmetic || (numeric && node[0] === "if" && i > 0)),
        );
    };
    visit(f.body);
    return required;
  };
  const calls = (level, numericOnly = false) =>
    language.functions
      .filter((f) => !numericOnly || resultType(f.body) === "number")
      .map((f) =>
        tuple([
          { const: f.name },
          ...f.params.map((p) => ({
            $ref: `#/$defs/${level}${numericParams(f).has(p) ? "Number" : ""}`,
          })),
        ]),
      );
  const definitions = {
    leaf,
    leafNumber: { anyOf: leaf.anyOf.filter((v) => v.type !== "boolean") },
    expression: { anyOf: [...leaf.anyOf, ...calls("leaf")] },
    expressionNumber: {
      anyOf: [
        ...leaf.anyOf.filter((v) => v.type !== "boolean"),
        ...calls("leaf", true),
      ],
    },
  };
  return {
    ...obj({
      name: { type: "string", minLength: 2, maxLength: 48 },
      explanation: { type: "string", minLength: 2, maxLength: 240 },
      score: { anyOf: calls("expression", true) },
      temperature: { type: "number", minimum: 0.3, maximum: 3 },
    }),
    $defs: definitions,
  };
}
export const policyHash = (s) =>
  hash({
    score: s.score,
    temperature: s.temperature,
    ...(s.portfolio ? { portfolio: s.portfolio } : {}),
  });
export function observations(game, state, player, action) {
  const opponent = 1 - player,
    phase = Math.floor(state.round / game.phaseLength) % 2;
  const counts = state.counts[opponent],
    total = counts.reduce((a, b) => a + b, 0) + 3;
  const probabilities = counts.map((n) => (n + 1) / total);
  const row = game.payoffs[phase].slice(action * 3, action * 3 + 3);
  return {
    action,
    phase,
    round: state.round,
    energy: state.energy[player],
    oppEnergy: state.energy[opponent],
    lastSelf: state.last[player],
    lastOpp: state.last[opponent],
    cost: game.costs[action],
    pay0: row[0],
    pay1: row[1],
    pay2: row[2],
    expected: row.reduce((n, p, i) => n + p * probabilities[i], 0),
    counter: state.last[opponent] < 0 ? 0 : row[state.last[opponent]],
    opp0: probabilities[0],
    opp1: probabilities[1],
    opp2: probabilities[2],
  };
}
export function distribution(machine, game, strategy, state, player = 0) {
  strategy = selectStrategy(strategy, game, state, player).strategy;
  const legal = [0, 1, 2].filter((a) => game.costs[a] <= state.energy[player]);
  const scores = legal.map((a) =>
    machine.evaluate(strategy.score, observations(game, state, player, a)),
  );
  ensure(
    scores.every((s) => typeof s === "number" && Number.isFinite(s)),
    "Strategy scores must be finite numbers.",
  );
  const max = Math.max(...scores),
    weights = scores.map((s) =>
      Math.exp(Math.max(-40, (s - max) / strategy.temperature)),
    );
  const total = weights.reduce((a, b) => a + b, 0),
    result = [0, 0, 0];
  legal.forEach((a, i) => {
    result[a] = (0.95 * weights[i]) / total + 0.05 / legal.length;
  });
  return result;
}
export function probeStates(game) {
  const states = [];
  for (const phase of [0, 1])
    for (const energy of [0, Math.floor(game.energyCap / 2), game.energyCap])
      for (const last of [-1, 0, 1, 2]) {
        const counts = [1, 1, 1];
        if (last >= 0) counts[last] = 6;
        states.push({
          round: phase * game.phaseLength,
          energy: [energy, game.energyCap],
          last: [last, last],
          counts: [[1, 1, 1], counts],
        });
      }
  return states;
}
export function validateArenaStrategy(language, games, strategy) {
  fields(strategy, [
    "name",
    "explanation",
    "score",
    "temperature",
    ...(Object.hasOwn(strategy, "portfolio") ? ["portfolio"] : []),
  ]);
  if (Object.hasOwn(strategy, "portfolio")) {
    const p = strategy.portfolio;
    fields(p, ["version", "provenance", "experts", "rules"]);
    ensure(
      p.version === 1 && p.provenance === "empirical_context_selector",
      "Unknown selector version.",
    );
    ensure(
      Array.isArray(p.experts) &&
        p.experts.length <= 6 &&
        Array.isArray(p.rules) &&
        p.rules.length <= 5,
      "Bounded portfolio required.",
    );
    for (const expert of p.experts) {
      ensure(
        !Object.hasOwn(expert, "portfolio"),
        "Nested portfolios are forbidden.",
      );
      validateArenaStrategy(language, games, expert);
    }
    const rows = (value) => {
      ensure(
        Array.isArray(value) && value.length === p.experts.length + 1,
        "Invalid selector rows.",
      );
      for (const r of value) {
        fields(r, ["points", "matches"]);
        ensure(
          integer(r.matches, 0, 1000) && integer(r.points, 0, r.matches * 2),
          "Invalid selector training scores.",
        );
      }
    };
    for (const rule of p.rules) {
      fields(rule, ["key", "game", "allowed", "overall", "contexts"]);
      ensure(
        /^[a-f0-9]{64}$/.test(rule.key) && text(rule.game, 48),
        "Invalid selector rule.",
      );
      ensure(
        Array.isArray(rule.allowed) &&
          rule.allowed.includes(0) &&
          rule.allowed.every((i) => integer(i, 0, p.experts.length)),
        "Invalid specialist indices.",
      );
      rows(rule.overall);
      ensure(
        rule.contexts && Object.keys(rule.contexts).length <= 10,
        "Invalid selector contexts.",
      );
      for (const [key, value] of Object.entries(rule.contexts)) {
        ensure(
          /^[01]:(unknown|mixed|action-[012])$/.test(key),
          "Selector context must use past observed actions.",
        );
        rows(value);
      }
    }
  }
  ensure(
    text(strategy.name, 48) && text(strategy.explanation, 600),
    "Use short strategy name and explanation.",
  );
  ensure(
    typeof strategy.temperature === "number" &&
      Number.isFinite(strategy.temperature) &&
      strategy.temperature >= 0.3 &&
      strategy.temperature <= 3,
    "Temperature must be 0.3..3.",
  );
  ensure(
    Array.isArray(strategy.score),
    "The strategy must call the generated language.",
  );
  const machine = compileLanguage(language);
  for (const game of games)
    for (const state of probeStates(game))
      distribution(machine, game, strategy, state);
}
export function behavior(language, games, strategy) {
  const machine = compileLanguage(language);
  return games.flatMap((game) =>
    probeStates(game).map((s) => distribution(machine, game, strategy, s)),
  );
}
export function distance(a, b) {
  ensure(
    a.length === b.length && a.length > 0,
    "Compare signatures on the same probes.",
  );
  return (
    a.reduce(
      (sum, row, i) =>
        sum + row.reduce((n, p, j) => n + Math.abs(p - b[i][j]), 0) / 2,
      0,
    ) / a.length
  );
}
export function diversity(language, games, strategies) {
  const signatures = strategies.map((s) => behavior(language, games, s));
  const pairs = [];
  for (let a = 0; a < strategies.length; a++)
    for (let b = a + 1; b < strategies.length; b++)
      pairs.push({ a, b, distance: distance(signatures[a], signatures[b]) });
  return {
    minimum: pairs.length ? Math.min(...pairs.map((p) => p.distance)) : 1,
    pairs,
    threshold: DIVERSITY_FLOOR,
    probesPerStrategy: signatures[0]?.length || 0,
  };
}
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function* arenaRounds(
  language,
  game,
  strategies,
  seed,
  preparedMachine,
) {
  const machine = preparedMachine || compileLanguage(language);
  const state = {
    round: 0,
    energy: [game.energyCap, game.energyCap],
    last: [-1, -1],
    counts: [
      [0, 0, 0],
      [0, 0, 0],
    ],
  };
  const rng = [random(seed ^ 0x12345678), random(seed ^ 0x76543210)],
    rounds = [];
  let score = 0;
  for (; state.round < 24; state.round++) {
    const selections = strategies.some((s) => s.portfolio)
      ? strategies.map((s, p) => {
          const selected = selectStrategy(s, game, state, p);
          return {
            index: selected.index,
            name: selected.strategy.name,
            policyHash: policyHash(selected.strategy),
            reason: selected.reason,
            ...(selected.context ? { context: selected.context } : {}),
            ...(selected.trainingMatches !== undefined
              ? {
                  trainingMatches: selected.trainingMatches,
                  trainingMean: selected.trainingMean,
                }
              : {}),
          };
        })
      : null;
    // Both policies see the pre-round state. Neither sees the current opponent choice.
    const probabilities = strategies.map((s, p) =>
      distribution(machine, game, s, state, p),
    );
    const actions = probabilities.map((row, p) => {
      const roll = rng[p]();
      let sum = 0;
      for (let a = 0; a < 3; a++) {
        sum += row[a];
        if (roll < sum) return a;
      }
      return row.findLastIndex((v) => v > 0);
    });
    const phase = Math.floor(state.round / game.phaseLength) % 2;
    const payoff = game.payoffs[phase][actions[0] * 3 + actions[1]];
    const before = [...state.energy];
    score += payoff;
    for (let p = 0; p < 2; p++) {
      state.energy[p] = Math.min(
        game.energyCap,
        state.energy[p] - game.costs[actions[p]] + game.recharge,
      );
      state.counts[p][actions[p]]++;
      state.last[p] = actions[p];
    }
    rounds.push({
      round: state.round,
      phase,
      before,
      actions,
      probabilities,
      after: [...state.energy],
      payoff,
      score,
      ...(selections ? { selections } : {}),
    });
    yield rounds.at(-1);
  }
  return {
    engine: "resource-arena-v1",
    game: game.name,
    seed,
    rounds,
    score,
    winner: score > 0 ? 0 : score < 0 ? 1 : null,
    languageHash: hash(language),
    gameHash: hash(game),
    strategyHashes: strategies.map(hash),
  };
}
export function playArena(language, game, strategies, seed, preparedMachine) {
  const iterator = arenaRounds(
    language,
    game,
    strategies,
    seed,
    preparedMachine,
  );
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}
export function arenaFitness(language, games, strategy, opponents, seeds) {
  const machine = compileLanguage(language),
    results = [];
  for (const [g, game] of games.entries())
    for (const [o, opponent] of opponents.entries())
      for (const seed of seeds)
        for (const seat of [0, 1]) {
          const match = playArena(
            language,
            game,
            seat ? [opponent, strategy] : [strategy, opponent],
            seed,
            machine,
          );
          results.push({
            game: g,
            opponent: o,
            seat,
            seed,
            score: seat ? -match.score : match.score,
            matchHash: hash(match),
          });
        }
  return {
    points: results.reduce(
      (n, r) => n + (r.score > 0 ? 2 : r.score === 0 ? 1 : 0),
      0,
    ),
    matches: results.length,
    results,
  };
}
export function evaluateArenaCandidate(
  language,
  games,
  previous,
  candidate,
  others,
  opponents,
) {
  validateArenaStrategy(language, games, candidate);
  const before = arenaFitness(
    language,
    games,
    previous,
    opponents,
    [1001, 1002, 1003, 1004],
  );
  const after = arenaFitness(
    language,
    games,
    candidate,
    opponents,
    [1001, 1002, 1003, 1004],
  );
  const trainingBefore = arenaFitness(
    language,
    games,
    previous,
    opponents,
    [11, 12],
  );
  const trainingAfter = arenaFitness(
    language,
    games,
    candidate,
    opponents,
    [11, 12],
  );
  const differences = diversity(language, games, [candidate, ...others]);
  const accepted =
    differences.minimum >= DIVERSITY_FLOOR &&
    after.points > before.points &&
    trainingAfter.points >= trainingBefore.points;
  return {
    accepted,
    before,
    after,
    trainingBefore,
    trainingAfter,
    diversity: differences,
    reason: accepted
      ? "Improved control score without training regression; behavior remains distinct from the active population."
      : "Retained: promotion needs higher control score, no training regression and at least 12% pairwise behavioral distance.",
  };
}
