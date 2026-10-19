import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { connectDatabase } from "../server/database.mjs";
import {
  compileLanguage,
  validateGame,
  validateStrategy,
  playMatch,
} from "../server/lab/language.mjs";
import { ExperimentStore, hash } from "../server/lab/store.mjs";
import { LocalModel } from "../server/lab/model.mjs";
import { synthesizePredicates } from "../server/lab/synthesis.mjs";
import { searchPolicies } from "../server/lab/strategy-search.mjs";
import {
  assessPolicy,
  compareCandidate,
  lossFeedback,
} from "../server/lab/learning.mjs";

// Explicit test fixtures. These are never installed as a runtime fallback.
const language = {
  name: "Test calculus",
  description: "Fixture for bounded interpreter tests.",
  functions: [
    {
      name: "bound",
      params: ["x", "y"],
      body: ["and", ["lte", 1, "x"], ["lte", "x", "y"]],
    },
    { name: "residue", params: ["x", "y"], body: ["mod", "x", "y"] },
    {
      name: "pick",
      params: ["x", "y", "z"],
      body: ["if", ["eq", "x", 0], "y", "z"],
    },
  ],
};
const games = [false, true].map((loses, i) => ({
  name: `Test game ${i + 1}`,
  description: "Remove 1 to 3 stones.",
  initial: 12 + i,
  legal: ["bound", "move", 3],
  loseAtZero: loses,
}));
const strategies = [0, 1].map((i) => ({
  name: `Test strategy ${i + 1}`,
  explanation: "Test-only policy.",
  policies: games.map((g) => ({
    game: g.name,
    score: i
      ? ["residue", "move", 100]
      : ["pick", ["residue", "after", 4], 100, "move"],
  })),
}));
const headers = { host: "localhost", "x-commit-zero": "local-demo" };
async function setup(t, model) {
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({ db, lab: { model } });
  t.after(() => app.close());
  return {
    db,
    app,
    call: (method, url, payload) =>
      app.inject({ method, url, payload, headers }),
  };
}
async function finished(call, id) {
  for (let i = 0; i < 200; i++) {
    const run = (await call("GET", `/api/lab/runs/${id}`)).json();
    if (run.status !== "running") return run;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Test experiment failed to finish.");
}
test("Language interpreter rejects host access, malformed expressions and nonterminating games", () => {
  const machine = compileLanguage(language);
  assert.equal(machine.evaluate(["pick", ["residue", 8, 4], 7, 9]), 7);
  assert.throws(() => machine.evaluate(["eval", "process.exit()"]), /Unknown/);
  assert.throws(() => machine.evaluate(["__proto__", 1]), /Unknown/);
  assert.throws(() => machine.evaluate("process"), /Unknown variable/);
  assert.throws(
    () =>
      compileLanguage({
        ...language,
        functions: [
          ...language.functions,
          { name: "attack", params: ["x"], body: ["attack", "x"] },
        ],
      }),
    /Unknown/,
  );
  let deep = 1;
  for (let i = 0; i < 30; i++) deep = ["residue", deep, 2];
  assert.throws(() => machine.evaluate(deep), /depth/);
  assert.throws(
    () => validateGame(language, { ...games[0], legal: false }),
    /must call/,
  );
  assert.throws(
    () => validateStrategy(language, games, { ...strategies[0], policies: [] }),
    /policy/,
  );
  for (const strategy of strategies)
    validateStrategy(language, games, strategy);
  const match = playMatch(language, games[0], strategies, 16);
  assert.equal(match.moves.at(-1).after, 0);
  assert.ok(
    match.moves.every(
      (m) => m.move >= 1 && m.move <= 3 && m.after === m.before - m.move,
    ),
  );
  assert.deepEqual(match, playMatch(language, games[0], strategies, 16));
});
test("Experiment executes generated DSL fixtures and records replayable results with honest provenance", async (t) => {
  let calls = 0;
  const outputs = [language, ...games, ...strategies];
  const model = {
    name: "fixture",
    provenance: "test_fixture",
    ready: async () => ({ available: true }),
    generate: async () => ({
      text: JSON.stringify(outputs[calls++]),
      usage: { completion_tokens: 10 },
      finishReason: "stop",
    }),
  };
  const { call } = await setup(t, model),
    before = (await call("GET", "/api/state")).json();
  const response = await call("POST", "/api/lab/runs", { learningRounds: 0 });
  assert.equal(response.statusCode, 202);
  const run = await finished(call, response.json().id);
  assert.equal(run.status, "completed");
  assert.equal(run.provenance, "test_fixture");
  assert.equal(calls, 5);
  assert.equal(run.summary.matches, 64);
  assert.equal(
    run.summary.scores.reduce((a, b) => a + b),
    64,
  );
  assert.equal(run.events.filter((e) => e.kind === "match").length, 64);
  assert.equal(run.events.length, run.version);
  assert.deepEqual(
    run.events.map((e) => e.sequence),
    Array.from({ length: run.version }, (_, i) => i + 1),
  );
  const a = (
    await call("GET", `/api/lab/runs/${run.id}/artifacts/match-1.json`)
  ).json();
  assert.equal(a.sha256, hash(a.content));
  const { artifactContents, ...exported } = (
    await call("GET", `/api/lab/runs/${run.id}/export`)
  ).json();
  assert.deepEqual(exported, run);
  assert.equal(artifactContents.length, run.artifacts.length);
  for (const item of artifactContents)
    assert.equal(hash(item.content), item.sha256);
  assert.deepEqual(
    a.content.moves,
    playMatch(language, games[0], strategies, 12, 0).moves,
  );
  assert.deepEqual((await call("GET", "/api/state")).json(), before);
  assert.equal(
    (
      await call("POST", `/api/lab/runs/${run.id}/cancel`, {
        version: run.version,
      })
    ).json().status,
    "completed",
  );
});
test("Unavailable, failed and cancelled model runs never become fabricated successes", async (t) => {
  let available = false,
    calls = 0;
  const model = {
    name: "fixture",
    provenance: "test_fixture",
    ready: async () => ({ available }),
    generate: async () => {
      calls++;
      return { text: "{}", usage: {}, finishReason: "stop" };
    },
  };
  const { call, db } = await setup(t, model);
  assert.equal(
    (await call("POST", "/api/lab/runs", { learningRounds: 0 })).statusCode,
    503,
  );
  assert.equal((await call("GET", "/api/lab")).json().runs.length, 0);
  available = true;
  const id = (await call("POST", "/api/lab/runs", { learningRounds: 0 })).json()
    .id;
  const failed = await finished(call, id);
  assert.equal(failed.status, "failed");
  assert.equal(calls, 3);
  assert.equal(failed.events.filter((e) => e.kind === "rejected").length, 3);
  let entered;
  const started = new Promise((r) => (entered = r));
  model.generate = (_prompt, signal) =>
    new Promise((_resolve, reject) => {
      entered();
      signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      });
    });
  const second = (
    await call("POST", "/api/lab/runs", { learningRounds: 0 })
  ).json();
  await started;
  assert.equal(
    (await call("POST", "/api/lab/runs", { learningRounds: 0 })).statusCode,
    409,
  );
  assert.equal(
    (await call("POST", `/api/lab/runs/${second.id}/cancel`, { version: 0 }))
      .statusCode,
    409,
  );
  const running = (await call("GET", `/api/lab/runs/${second.id}`)).json();
  assert.equal(
    (
      await call("POST", `/api/lab/runs/${second.id}/cancel`, {
        version: running.version,
      })
    ).json().status,
    "cancelled",
  );
  const store = new ExperimentStore(db);
  const abandoned = await store.create("fixture", "test_fixture");
  await store.recover();
  assert.equal((await store.read(abandoned.id)).status, "interrupted");
});
test("Local model adapter refuses non-local endpoints and keeps real request provenance", async () => {
  assert.throws(
    () => new LocalModel({ url: "https://example.com" }),
    /loopback/,
  );
  const requests = [];
  const model = new LocalModel({
    credential: async () => "test-only-token",
    transport: async (url, options) => {
      requests.push({ url, options });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
          usage: { completion_tokens: 1 },
          model: "cz-local-coder",
        }),
      );
    },
  });
  const result = await model.generate("Test", new AbortController().signal);
  assert.equal(model.provenance, "local_model");
  assert.equal(result.text, "{}");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(JSON.parse(requests[0].options.body).messages.length, 2);
});

test("Repair search derives playable predicates from the supplied language without a fallback game", () => {
  const candidates = synthesizePredicates(language);
  assert.ok(candidates.length > 0 && candidates.length <= 8);
  for (const legal of candidates) {
    assert.ok(language.functions.some((f) => f.name === legal[0]));
    validateGame(language, { ...games[0], legal });
  }
  const numericOnly = {
    ...language,
    functions: language.functions.filter((f) => f.name !== "bound"),
  };
  assert.deepEqual(
    synthesizePredicates({
      ...numericOnly,
      functions: [
        ...numericOnly.functions,
        { name: "twice", params: ["x"], body: ["mul", "x", 2] },
      ],
    }),
    [],
  );
});

const learningLanguage = {
  ...language,
  functions: [
    ...language.functions,
    { name: "minus", params: ["a", "b"], body: ["sub", "a", "b"] },
  ],
};
const weak = {
  name: "Weak fixture",
  explanation: "Always take one.",
  policies: games.map((g) => ({ game: g.name, score: ["minus", 1, 1] })),
};
const strong = {
  name: "Exact fixture",
  explanation: "Test oracle policy, never used by runtime agents.",
  policies: games.map((g, i) => ({
    game: g.name,
    score: [
      "pick",
      ["residue", i ? ["minus", "after", 1] : "after", 4],
      100,
      0,
    ],
  })),
};

test("Learning gate measures actual winning choices and refuses unchanged or weaker policies", () => {
  for (const game of games) {
    const report = assessPolicy(learningLanguage, game, strong);
    assert.equal(report.trainingErrors, 0);
    assert.equal(report.controlErrors, 0);
  }
  const good = compareCandidate(learningLanguage, games, weak, strong, [
    weak,
    weak,
  ]);
  assert.equal(good.accepted, true);
  assert.equal(good.after.controlErrors, 0);
  assert.ok(good.after.wins > good.before.wins);
  assert.equal(good.matchesPerVersion, 128);
  assert.equal(
    compareCandidate(learningLanguage, games, strong, weak, [strong, weak])
      .accepted,
    false,
  );
  assert.equal(
    compareCandidate(learningLanguage, games, strong, strong, [strong, weak])
      .accepted,
    false,
  );
  const misere = assessPolicy(learningLanguage, games[1], weak);
  const forced = misere.states.find((s) => s.heap === 1);
  assert.deepEqual(forced.winningMoves, []);
  assert.equal(forced.mistake, false);
  const feedback = lossFeedback(
    learningLanguage,
    games,
    [weak, strong],
    [
      {
        ...playMatch(learningLanguage, games[0], [weak, strong], 12),
        game: 0,
        artifact: "match-1.json",
      },
    ],
    0,
  );
  assert.ok(
    feedback.training.every((g) => g.examples.every((s) => s.heap <= 32)),
  );
});

test("Learning continuation preserves parent history, records analyses and rejects regression in the next round", async (t) => {
  let calls = 0;
  const outputs = [
    learningLanguage,
    ...games,
    weak,
    weak,
    { analysis: "Measured losing moves corrected.", strategy: strong },
    {
      analysis: "Measured losing moves corrected independently.",
      strategy: strong,
    },
    {
      analysis: "Bad revision to verify regression protection.",
      strategy: weak,
    },
    {
      analysis: "Bad revision to verify regression protection.",
      strategy: weak,
    },
  ];
  const model = {
    name: "fixture",
    provenance: "test_fixture",
    ready: async () => ({ available: true }),
    generate: async () => ({
      text: JSON.stringify(outputs[calls++]),
      usage: {},
      finishReason: "stop",
    }),
  };
  const { call } = await setup(t, model);
  const parentId = (
    await call("POST", "/api/lab/runs", { learningRounds: 0 })
  ).json().id;
  const parent = await finished(call, parentId);
  assert.equal(parent.status, "completed");
  assert.equal(
    (await call("POST", "/api/lab/runs", { sourceRunId: parentId })).statusCode,
    400,
  );
  assert.equal(
    (
      await call("POST", "/api/lab/runs", {
        sourceRunId: parentId,
        sourceVersion: parent.version - 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await call("POST", "/api/lab/runs", { learningRounds: 4 })).statusCode,
    400,
  );
  const childId = (
    await call("POST", "/api/lab/runs", {
      sourceRunId: parentId,
      sourceVersion: parent.version,
      learningRounds: 2,
    })
  ).json().id;
  const child = await finished(call, childId);
  assert.equal(child.status, "completed");
  const lineage = (
    await call("GET", `/api/lab/runs/${childId}/artifacts/lineage.json`)
  ).json().content;
  assert.equal(lineage.sourceHashEncoding, "json-iso-dates-v1");
  assert.equal(lineage.sourceHash, hash(parent));
  assert.equal(calls, 9);
  assert.equal(child.summary.totalTournamentMatches, 192);
  assert.deepEqual(
    child.summary.decisions.map((d) => d.accepted),
    [true, true, false, false],
  );
  assert.deepEqual(
    child.summary.generations.map((g) => g.metrics.map((m) => m.controlErrors)),
    [
      [64, 64],
      [0, 0],
      [0, 0],
    ],
  );
  assert.equal(child.events.filter((e) => e.kind === "analysis").length, 4);
  assert.equal(child.events.filter((e) => e.kind === "match").length, 192);
  assert.equal(child.events.length, child.version);
  assert.deepEqual(
    (await call("GET", `/api/lab/runs/${parentId}`)).json(),
    parent,
  );
  const final = (
    await call("GET", `/api/lab/runs/${childId}/artifacts/g2-strategy-1.json`)
  ).json();
  assert.equal(final.sha256, hash(strong));
});

test("Strategy search synthesizes bounded programs from actual functions and scores training positions", () => {
  const results = searchPolicies(learningLanguage, games, weak);
  for (const result of results) {
    assert.ok(result.evaluated > 0 && result.evaluated <= 3000);
    assert.ok(result.candidates.length > 0 && result.candidates.length <= 3);
    for (const candidate of result.candidates) {
      const strategy = {
        ...weak,
        policies: weak.policies.map((p) =>
          p.game === result.game ? { ...p, score: candidate.score } : p,
        ),
      };
      validateStrategy(learningLanguage, games, strategy);
      assert.equal(
        assessPolicy(
          learningLanguage,
          games.find((g) => g.name === result.game),
          strategy,
        ).trainingErrors,
        candidate.trainingErrors,
      );
    }
  }
  assert.ok(
    results[0].candidates[0].trainingErrors <
      assessPolicy(learningLanguage, games[0], weak).trainingErrors,
  );
});

test("Failed unaided proposals can use disclosed host search with model-selected candidates", async (t) => {
  let calls = 0;
  const initial = [learningLanguage, ...games, weak, weak];
  const model = {
    name: "fixture",
    provenance: "test_fixture",
    ready: async () => ({ available: true }),
    generate: async (_prompt, _signal, _seed, schema) => {
      let value = initial[calls++];
      if (!value) {
        const choices =
          schema.properties.strategy.properties.policies.prefixItems;
        value = {
          analysis: choices
            ? "Selected tool candidates using measured errors."
            : "Unaided unchanged proposal for the test.",
          strategy: choices
            ? {
                name: "Tool selection",
                explanation: "Host synthesized; fixture model selected.",
                policies: choices.map((choice) => ({
                  game: choice.properties.game.const,
                  score: choice.properties.score.enum[0],
                })),
              }
            : weak,
        };
      }
      return { text: JSON.stringify(value), usage: {}, finishReason: "stop" };
    },
  };
  const { call } = await setup(t, model);
  const id = (await call("POST", "/api/lab/runs", { learningRounds: 1 })).json()
    .id;
  const run = await finished(call, id);
  assert.equal(run.status, "completed");
  assert.equal(run.summary.totalTournamentMatches, 128);
  assert.equal(
    run.events.filter((e) => e.kind === "strategy-search").length,
    2,
  );
  assert.ok(run.summary.decisions.some((d) => d.accepted));
  const change = (
    await call("GET", `/api/lab/runs/${id}/artifacts/g1-s1-change.json`)
  ).json().content;
  assert.equal(change.candidateProvenance, "host_synthesis_selected_by_model");
  assert.equal(change.evaluation.accepted, true);
});
