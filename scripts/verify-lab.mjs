import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { hash } from "../server/lab/store.mjs";
import {
  compileLanguage,
  validateGame,
  validateStrategy,
  playMatch,
} from "../server/lab/language.mjs";
import {
  assessStrategies,
  compareCandidate,
  lossFeedback,
} from "../server/lab/learning.mjs";
// Compare the persisted JSON representation: JSON normalizes negative zero.
const equalJson = (a, b, label) => assert.equal(hash(a), hash(b), label);
const id = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(id || ""))
  throw new Error("Pass a saved experiment UUID.");
const base = `http://127.0.0.1:4173/api/lab/runs/${id}`;
async function get(path = "") {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`Read failed: HTTP ${response.status}`);
  return response.json();
}
const { artifactContents, ...run } = await get("/export");
assert.equal(run.status, "completed");
assert.equal(run.provenance, "local_model");
assert.equal(run.version, run.events.length);
equalJson(
  run.events.map((e) => e.sequence),
  Array.from({ length: run.version }, (_, i) => i + 1),
);
const artifacts = new Map();
for (const meta of run.artifacts) {
  const item = artifactContents.find((a) => a.name === meta.name);
  assert.equal(hash(item.content), meta.sha256, meta.name);
  assert.equal(item.sha256, meta.sha256);
  artifacts.set(meta.name, item.content);
}
const language = artifacts.get("language.json");
if (run.summary.mode === "arena") {
  const { verifyArena } = await import("./verify-arena.mjs");
  await verifyArena(run, artifacts);
  process.exit(0);
}
const games = [1, 2].map((n) => artifacts.get(`game-${n}.json`));
compileLanguage(language);
games.forEach((g) => validateGame(language, g));
const generations = run.summary.generations || [
  { generation: 0, results: run.summary.results, scores: run.summary.scores },
];
let scores,
  strategies,
  tournamentMatches = 0,
  evaluationMatches = 0;
for (const [name, item] of artifacts) {
  if (!name.endsWith("-model-check.json")) continue;
  equalJson(
    item.evaluation,
    compareCandidate(
      language,
      games,
      item.previous,
      item.candidate,
      item.opponents,
    ),
  );
  evaluationMatches += item.evaluation.matchesPerVersion * 2;
}
for (const generation of generations) {
  const prefix = generation.generation ? `g${generation.generation}-` : "";
  strategies = [1, 2].map((n) => artifacts.get(`${prefix}strategy-${n}.json`));
  strategies.forEach((s) => validateStrategy(language, games, s));
  scores = [0, 0];
  const matches = [];
  for (const result of generation.results) {
    const saved = artifacts.get(result.artifact);
    const replay = playMatch(
      language,
      games[result.game],
      strategies,
      result.opening,
      result.first,
    );
    equalJson(saved.moves, replay.moves, result.artifact);
    assert.equal(saved.winner, replay.winner);
    assert.equal(saved.languageHash, hash(language));
    assert.equal(saved.gameHash, hash(games[result.game]));
    equalJson(saved.strategyHashes, strategies.map(hash));
    scores[replay.winner]++;
    matches.push({ ...replay, game: result.game, artifact: result.artifact });
  }
  assert.equal(generation.results.length, 64);
  equalJson(scores, generation.scores);
  tournamentMatches += generation.results.length;
  if (generation.metrics)
    equalJson(
      generation.metrics,
      assessStrategies(language, games, strategies).map(
        ({ strategyHash, trainingErrors, controlErrors }) => ({
          strategyHash,
          trainingErrors,
          controlErrors,
        }),
      ),
    );
  for (let player = 0; player < 2; player++) {
    const next = generation.generation + 1;
    const name = `g${next}-s${player + 1}-losses.json`;
    if (artifacts.has(name))
      equalJson(
        artifacts.get(name),
        lossFeedback(language, games, strategies, matches, player),
      );
    const change = artifacts.get(`g${next}-s${player + 1}-change.json`);
    if (!change) continue;
    equalJson(change.previous, strategies[player]);
    equalJson(change.opponents, strategies);
    const checked = compareCandidate(
      language,
      games,
      change.previous,
      change.candidate,
      change.opponents,
    );
    equalJson(checked, change.evaluation);
    const promoted = artifacts.get(`g${next}-strategy-${player + 1}.json`);
    equalJson(promoted, checked.accepted ? change.candidate : change.previous);
    evaluationMatches += checked.matchesPerVersion * 2;
  }
}
equalJson(scores, run.summary.scores);
equalJson(run.summary.results, generations.at(-1).results);
if (artifacts.has("lineage.json")) {
  const lineage = artifacts.get("lineage.json");
  const response = await fetch(
    `http://127.0.0.1:4173/api/lab/runs/${lineage.sourceRunId}`,
  );
  assert.ok(response.ok);
  const parent = await response.json();
  assert.equal(parent.version, lineage.sourceVersion);
  if (lineage.sourceHashEncoding !== "json-iso-dates-v1") {
    // Early development runs hashed driver Date objects as {}. Preserve and
    // verify that historical encoding; all new lineage hashes include ISO dates.
    parent.created_at = {};
    parent.updated_at = {};
    parent.events.forEach((e) => {
      e.recorded_at = {};
    });
    parent.artifacts.forEach((a) => {
      a.created_at = {};
    });
  }
  assert.equal(hash(parent), lineage.sourceHash);
}
const receipt = {
  checkedAt: new Date().toISOString(),
  runId: id,
  provenance: run.provenance,
  language: language.name,
  games: games.map((g) => g.name),
  strategies: strategies.map((s) => s.name),
  scores,
  matches: tournamentMatches,
  evaluationMatches,
  generations: generations.length,
  promoted: run.summary.decisions?.filter((d) => d.accepted).length || 0,
  controlErrors: generations.map((g) => g.metrics?.map((m) => m.controlErrors)),
  artifactsChecked: artifacts.size,
  events: run.events.length,
  calls: run.summary.calls,
  usage: run.summary.usage,
  elapsedMs: run.summary.elapsedMs,
  assistedGameRepairs: run.events.filter((e) => e.kind === "synthesis").length,
  allMatchesUsedOneStoneMoves: run.summary.results.every(
    (r) => r.turns === r.opening,
  ),
  runHash: hash(run),
};
await mkdir("runtime/verification", { recursive: true });
await writeFile(
  `runtime/verification/lab-${id}.json`,
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt, null, 2));
