import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDatabase } from "../server/database.mjs";
import { ExperimentStore, hash } from "../server/lab/store.mjs";
import { runArena } from "../server/lab/arena-runner.mjs";
import { broadcastMatch } from "../server/lab/arena-broadcast.mjs";
import { learnSpecialists } from "../server/lab/arena-specialists.mjs";
import {
  selectStrategy,
  routingRule,
  flatStrategy,
} from "../server/lab/arena-router.mjs";
import {
  revisionNovelty,
  rememberFailure,
  revisionPrompt,
} from "../server/lab/arena-revisions.mjs";
import {
  lossReview,
  evaluateModelRevision,
  transferSuite,
  transferEvaluation,
} from "../server/lab/arena-learning.mjs";
import { liveMatch, frameAt } from "../prototype/app/arena-spectator.mjs";
import {
  expandArenaRules,
  validateArenaGame,
  gameFingerprint,
  playArena,
  diversity,
  evaluateArenaCandidate,
  observations,
  arenaStrategySchema,
  validateArenaStrategy,
  policyHash,
} from "../server/lab/arena-engine.mjs";
const language = {
  name: "Test arena",
  description: "Test fixture only",
  functions: [
    { name: "sum", params: ["a", "b"], body: ["add", "a", "b"] },
    { name: "diff", params: ["a", "b"], body: ["sub", "a", "b"] },
    {
      name: "prod",
      params: ["a", "b"],
      body: ["if", ["eq", "a", 0], 0, ["mul", "a", "b"]],
    },
  ],
};
const draft = {
  name: "Test rules",
  description: "Test-only resource rules",
  actions: ["Scout", "Guard", "Raid"],
  phases: [
    { direction: 1, margins: [2, 3, 4] },
    { direction: -1, margins: [4, 1, 2] },
  ],
  costs: [0, 2, 4],
  energyCap: 6,
  recharge: 1,
  phaseLength: 3,
};
const game = expandArenaRules(draft);
const strategies = [
  {
    name: "Adaptive",
    explanation: "Test expected payoffs",
    score: ["sum", "expected", 0],
    temperature: 1,
  },
  {
    name: "Conserve",
    explanation: "Test cost aversion",
    score: ["diff", 0, "cost"],
    temperature: 1,
  },
  {
    name: "Pressure",
    explanation: "Test preference",
    score: ["prod", "action", 3],
    temperature: 0.5,
  },
];

test("Empirical selector uses only known rules and observed history; replay records executed specialist switches", async () => {
  const rows = (a, b) => [
    { points: a, matches: 10 },
    { points: b, matches: 10 },
  ];
  const policy = {
    ...strategies[1],
    portfolio: {
      version: 1,
      provenance: "empirical_context_selector",
      experts: [strategies[0]],
      rules: [
        {
          key: routingRule(game),
          game: game.name,
          allowed: [0, 1],
          overall: rows(10, 15),
          contexts: { "0:action-0": rows(18, 2), "0:mixed": rows(1, 19) },
        },
      ],
    },
  };
  validateArenaStrategy(language, [game], policy);
  assert.notEqual(policyHash(policy), policyHash(flatStrategy(policy)));
  const state = {
    round: 0,
    counts: [
      [0, 0, 0],
      [4, 0, 0],
    ],
  };
  assert.equal(selectStrategy(policy, game, state, 0).index, 0);
  state.counts[1] = [4, 4, 4];
  assert.equal(selectStrategy(policy, game, state, 0).index, 1);
  assert.deepEqual(
    selectStrategy(policy, game, state, 0),
    selectStrategy(
      policy,
      game,
      { ...state, opponentCode: "secret", nextAction: 2 },
      0,
    ),
  );
  assert.equal(
    selectStrategy(policy, { ...game, recharge: 2 }, state, 0).index,
    0,
  );
  assert.equal(
    selectStrategy(policy, { ...game, name: "Renamed rules" }, state, 0).index,
    1,
  );
  const invalid = structuredClone(policy);
  invalid.portfolio.rules[0].contexts["next-action-2"] = rows(1, 19);
  assert.throws(
    () => validateArenaStrategy(language, [game], invalid),
    /past observed/,
  );
  const events = [];
  const match = await broadcastMatch({
    language,
    game,
    strategies: [policy, strategies[2]],
    seed: 22,
    players: [0, 2],
    generation: null,
    trial: true,
    matchId: "fixture",
    delayMs: 0,
    signal: new AbortController().signal,
    event: async (actor, kind, message, data) =>
      events.push({ actor, kind, message, data }),
  });
  assert.deepEqual(
    match,
    playArena(language, game, [policy, strategies[2]], 22),
  );
  assert.ok(
    events.some((e) => e.kind === "selection" && e.data.selection.index === 1),
  );
  for (const e of events.filter((v) => v.kind === "selection"))
    assert.deepEqual(
      e.data.selection,
      match.rounds[e.data.round].selections[e.data.player === 0 ? 0 : 1],
    );
});

test("Specialists preserve exact source programs, qualify on paired games, and learn reproducibly from separate seeds", () => {
  const candidates = [strategies[0], strategies[2]].map((strategy, i) => ({
    strategy,
    source: { runId: "fixture", artifact: `model-${i}` },
  }));
  const result = learnSpecialists(
    language,
    [game],
    strategies[1],
    candidates,
    strategies,
  );
  assert.ok(
    result.retained.length > 0,
    "Fixture has a real game-specific improvement",
  );
  assert.deepEqual(
    result,
    learnSpecialists(language, [game], strategies[1], candidates, strategies),
  );
  assert.ok(
    result.retained.every((r) =>
      candidates.some(
        (c) =>
          hash(c.strategy) === hash(r.strategy) &&
          hash(c.source) === hash(r.source),
      ),
    ),
  );
  assert.ok(
    result.retained.every((r) =>
      r.strengths.every(
        (s) => s.control[1] > s.control[0] && s.training[1] >= s.training[0],
      ),
    ),
  );
  assert.deepEqual(
    [...new Set(result.trainingMatches.map((m) => m.seed))],
    [41, 42, 43],
  );
  validateArenaStrategy(language, [game], result.candidate);
});
test("Arena rules expand cyclic edges, reject degenerate games, and ignore cosmetic novelty", () => {
  assert.equal(game.payoffs[0][1], 2);
  assert.equal(game.payoffs[0][3], -2);
  assert.equal(
    gameFingerprint(game),
    gameFingerprint({ ...game, name: "Different title" }),
  );
  assert.throws(
    () =>
      validateArenaGame({
        ...game,
        payoffs: [game.payoffs[0], game.payoffs[0]],
      }),
    /Phases/,
  );
  assert.throws(
    () =>
      expandArenaRules({
        ...draft,
        phases: [{ direction: 0, margins: [1, 2, 3] }, draft.phases[1]],
      }),
    /Invalid/,
  );
  assert.throws(
    () => validateArenaGame({ ...game, costs: [1, 2, 3] }),
    /Invalid costs/,
  );
});
test("Arena replay is seeded, resource-bounded and simultaneous", () => {
  const match = playArena(language, game, strategies.slice(0, 2), 42);
  assert.deepEqual(
    match,
    playArena(language, game, strategies.slice(0, 2), 42),
  );
  assert.equal(match.rounds.length, 24);
  let score = 0;
  for (const r of match.rounds) {
    score += r.payoff;
    assert.equal(r.score, score);
    for (let p = 0; p < 2; p++) {
      assert.ok(game.costs[r.actions[p]] <= r.before[p]);
      assert.ok(r.after[p] >= 0 && r.after[p] <= game.energyCap);
      assert.ok(
        Math.abs(r.probabilities[p].reduce((a, b) => a + b) - 1) < 1e-10,
      );
    }
  }
  const state = {
    round: 0,
    energy: [6, 6],
    last: [-1, -1],
    counts: [
      [0, 0, 0],
      [0, 0, 0],
    ],
  };
  assert.equal(observations(game, state, 0, 1).lastOpp, -1);
  const changedOpponent = playArena(
    language,
    game,
    [strategies[0], strategies[2]],
    42,
  );
  assert.deepEqual(
    match.rounds[0].probabilities[0],
    changedOpponent.rounds[0].probabilities[0],
  );
});
test("Diversity measures behavior and unchanged candidates cannot be promoted", () => {
  const schema = arenaStrategySchema(language);
  assert.equal(
    schema.properties.score.anyOf[0].prefixItems[1].$ref,
    "#/$defs/expressionNumber",
  );
  assert.ok(schema.$defs.leafNumber.anyOf.every((v) => v.type !== "boolean"));
  assert.equal(
    diversity(
      language,
      [game],
      [strategies[0], { ...strategies[0], name: "Cosmetic clone" }],
    ).minimum,
    0,
  );
  assert.ok(diversity(language, [game], strategies).minimum >= 0.12);
  const check = evaluateArenaCandidate(
    language,
    [game],
    strategies[0],
    strategies[0],
    strategies.slice(1),
    strategies,
  );
  assert.equal(check.accepted, false);
  assert.equal(check.before.points, check.after.points);
});

test("Live broadcast commits each round before execution continues and cancellation preserves only executed rounds", async () => {
  const events = [],
    signal = new AbortController();
  const args = {
    language,
    game,
    strategies: strategies.slice(0, 2),
    seed: 42,
    players: [0, 1],
    generation: 0,
    matchId: "arena-match-g0-0.json",
    signal: signal.signal,
    delayMs: 0,
  };
  let release, arrived;
  const first = new Promise((resolve) => {
      arrived = resolve;
    }),
    hold = new Promise((resolve) => {
      release = resolve;
    });
  const task = broadcastMatch({
    ...args,
    event: async (actor, kind, message, data) => {
      events.push({ actor, kind, message, data });
      if (kind === "round" && data.round.round === 0) {
        arrived();
        await hold;
      }
    },
  });
  await first;
  assert.equal(events.length, 2);
  assert.equal(events[1].data.round.round, 0);
  assert.equal(liveMatch({ events }).rounds.length, 1);
  release();
  const result = await task;
  assert.deepEqual(
    result,
    playArena(language, game, strategies.slice(0, 2), 42),
  );
  assert.deepEqual(
    events.filter((e) => e.kind === "round").map((e) => e.data.round),
    result.rounds,
  );
  assert.equal(frameAt({ ...liveMatch({ events }) }, 0).score, 0);
  const stopped = [],
    abort = new AbortController();
  await assert.rejects(
    broadcastMatch({
      ...args,
      signal: abort.signal,
      event: async (actor, kind, message, data) => {
        stopped.push({ actor, kind, message, data });
        if (kind === "round") abort.abort();
      },
    }),
    /abort/i,
  );
  assert.equal(stopped.filter((e) => e.kind === "round").length, 1);
  assert.equal(liveMatch({ events: stopped }).complete, false);
});

test("Arena persists real execution, evolving rules, decisions and immutable continuation with an explicitly mocked model", async (t) => {
  const db = await connectDatabase({ memory: true, url: null });
  t.after(() => db.close());
  const store = new ExperimentStore(db);
  let rules = 0,
    policies = 0;
  const model = {
    name: "Test fixture model",
    provenance: "test_fixture",
    generate: async (_prompt, _signal, _seed, schema) => {
      let value;
      if (schema.properties.functions) value = language;
      else if (schema.properties.phases)
        value = {
          ...draft,
          name: `Fixture rules ${++rules}`,
          phaseLength: 2 + (rules % 4),
        };
      else if (schema.properties.choice)
        value = { choice: 0, analysis: "Test-only host selection" };
      else if (schema.properties.strategy)
        value = {
          lesson: "Test failure changed the hypothesis",
          approach: "Test different measured policy",
          diagnosis: "Test-only diagnosis of a loss",
          evidence: "Fixture game, round 1",
          hypothesis: "Test-only changed payoff preference",
          strategy: { ...strategies[0], score: ["prod", "pay0", ++policies] },
        };
      else value = strategies[policies++ % 3];
      return {
        text: JSON.stringify(value),
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        finishReason: "stop",
        elapsedMs: 1,
      };
    },
  };
  const run = await store.create(model.name, model.provenance, {
    mode: "arena",
  });
  await runArena(store, model, run.id, new AbortController().signal, {
    learningRounds: 1,
    spectatorDelayMs: 0,
  });
  const done = await store.read(run.id);
  assert.equal(done.status, "completed", done.summary.error);
  assert.equal(done.summary.learningProtocol, "model-revision-v5");
  assert.ok(done.events.some((e) => e.kind === "grammar"));
  assert.ok(
    done.events.filter((e) => e.kind === "evaluation").length <
      done.events.filter(
        (e) =>
          e.kind === "response" &&
          e.data.artifact.startsWith("arena-revision-"),
      ).length,
  );
  assert.ok(!done.events.some((e) => e.kind === "synthesis"));
  const freeze = done.events.find((e) => e.kind === "frozen");
  assert.ok(
    !done.events.some(
      (e) => e.sequence > freeze.sequence && e.kind === "inference",
    ),
  );
  assert.equal(done.summary.transfer.length, 3);
  assert.equal(done.summary.games.length, 3);
  assert.equal(done.summary.generations.length, 2);
  assert.equal(
    done.events.filter((e) => e.kind === "match" && !e.data.trial).length,
    120,
  );
  assert.equal(done.summary.routingResults.length, 3);
  const saved = (await store.artifact(run.id, "arena-state.json")).content
    .specialistPools;
  assert.equal(saved.length, 3);
  assert.ok(saved.every((pool) => pool.length <= 6));
  assert.equal(
    done.events.filter(
      (e) =>
        ["promoted", "retained"].includes(e.kind) &&
        e.data.artifact?.startsWith("arena-diff"),
    ).length,
    3,
  );
  assert.ok(done.summary.generations.every((g) => g.diversity.minimum >= 0.12));
  const parentHash = hash(done),
    next = await store.create(model.name, model.provenance, { mode: "arena" });
  await runArena(store, model, next.id, new AbortController().signal, {
    source: done,
    learningRounds: 0,
    spectatorDelayMs: 0,
  });
  assert.equal((await store.read(next.id)).status, "completed");
  assert.equal(hash(await store.read(run.id)), parentHash);
  assert.equal(
    (await store.artifact(next.id, "lineage.json")).content.inheritance,
    "arena-state",
  );
});

test("Revision memory rejects cosmetic and behavioral repeats and retains cumulative failure feedback", () => {
  const entry = {
    source: { runId: "fixture", artifact: "draft.json" },
    strategy: strategies[0],
    feedback: { control: [20, 10], reason: "Regression" },
  };
  const memory = rememberFailure([], entry);
  assert.equal(
    revisionNovelty(
      language,
      [game],
      strategies[1],
      { ...strategies[0], name: "Renamed", temperature: 2 },
      memory,
    ).novel,
    false,
  );
  assert.equal(
    revisionNovelty(
      language,
      [game],
      strategies[1],
      { ...strategies[0], score: ["diff", "expected", 0] },
      memory,
    ).novel,
    false,
  );
  assert.equal(
    revisionNovelty(language, [game], strategies[1], strategies[2], memory)
      .novel,
    true,
  );
  assert.equal(rememberFailure(memory, entry).length, 1);
  const prompt = revisionPrompt("BASE_CONTEXT", memory, 2, "Prior rejection");
  assert.ok(prompt.indexOf("Regression") < prompt.indexOf("BASE_CONTEXT"));
  assert.match(prompt, /resource accounting/);
  assert.doesNotMatch(prompt, /Rejected output:/);
});

test("Loss review uses legal pre-action evidence and fresh transfer fixtures stay outside training", () => {
  const review = lossReview(language, [game], strategies[2], strategies);
  assert.ok(review.cases.length);
  for (const c of review.cases)
    for (const m of c.mistakes) {
      assert.ok(m.actions[m.chosen].legal);
      assert.equal(m.actions[m.chosen].hindsightPayoff, m.payoff);
      assert.equal(
        m.regret,
        Math.max(
          ...m.actions.filter((a) => a.legal).map((a) => a.hindsightPayoff),
        ) - m.payoff,
      );
      assert.ok(m.actions.every((a) => a.observed.round === m.round - 1));
    }
  const suite = transferSuite(language, [game], strategies, 12345);
  assert.deepEqual(suite, transferSuite(language, [game], strategies, 12345));
  assert.ok(
    suite.games.every((g) => gameFingerprint(g) !== gameFingerprint(game)),
  );
  const transfer = transferEvaluation(
    language,
    suite,
    [game],
    strategies,
    strategies[0],
    strategies[0],
  );
  assert.deepEqual(
    transfer.map((r) => r.scope),
    ["new-games", "new-opponents", "both-new"],
  );
  assert.ok(
    transfer.every((r) => JSON.stringify(r.before) === JSON.stringify(r.after)),
  );
  assert.equal(
    evaluateModelRevision(
      language,
      [game],
      strategies[0],
      { ...strategies[0], temperature: 0.3 },
      strategies.slice(1),
      strategies,
    ).accepted,
    false,
  );
});
