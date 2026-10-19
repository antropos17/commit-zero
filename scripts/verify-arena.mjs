import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { constrainRevisionSchema } from "../server/lab/arena-decoder.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { hash } from "../server/lab/store.mjs";
import { learnSpecialists } from "../server/lab/arena-specialists.mjs";
import {
  revisionNovelty,
  developmentFeedback,
} from "../server/lab/arena-revisions.mjs";
import {
  lossReview,
  evaluateModelRevision,
  transferSuite,
  transferEvaluation,
} from "../server/lab/arena-learning.mjs";
import {
  validateArenaGame,
  validateArenaStrategy,
  expandArenaRules,
  playArena,
  diversity,
  evaluateArenaCandidate,
  DIVERSITY_FLOOR,
  policyHash,
} from "../server/lab/arena-engine.mjs";
export async function verifyArena(run, artifacts) {
  const equal = (a, b, label) => assert.equal(hash(a), hash(b), label);
  const language = artifacts.get("language.json");
  for (const start of run.events.filter((e) => e.kind === "match-start")) {
    const saved = artifacts.get(start.data.matchId);
    assert.ok(saved, "Completed runs must finalize every live match");
    equal(start.data.players, saved.players);
    equal(start.data.gameRules, saved.gameRules);
    equal(
      run.events
        .filter(
          (e) => e.kind === "round" && e.data.matchId === start.data.matchId,
        )
        .map((e) => e.data.round),
      saved.rounds,
      "Broadcast rounds match final replay",
    );
  }
  let matches = 0,
    evaluationMatches = 0,
    promoted = 0,
    transferMatches = 0,
    routingPromoted = 0,
    specialistTrainingMatches = 0,
    trialMatches = 0;
  const specialistMode = run.summary.learningProtocol === "model-revision-v5";
  const modelOnly = [
    "model-revision-v2",
    "model-revision-v3",
    "model-revision-v4",
    "model-revision-v5",
  ].includes(run.summary.learningProtocol);
  const retryMemory = [
    "model-revision-v3",
    "model-revision-v4",
    "model-revision-v5",
  ].includes(run.summary.learningProtocol);
  const constrained = ["model-revision-v4", "model-revision-v5"].includes(
    run.summary.learningProtocol,
  );
  let parentArtifacts = new Map();
  if (retryMemory && run.summary.sourceRunId) {
    const response = await fetch(
      `http://127.0.0.1:4173/api/lab/runs/${run.summary.sourceRunId}/export`,
    );
    assert.ok(response.ok);
    parentArtifacts = new Map(
      (await response.json()).artifactContents.map((a) => [a.name, a.content]),
    );
  }
  const Ajv = constrained
    ? createRequire(import.meta.resolve("eslint"))("ajv")
    : null;
  const emitted = [];
  if (modelOnly)
    assert.ok(
      !run.events.some((e) => e.kind === "synthesis"),
      "No host policy synthesis in model-only runs",
    );
  for (const event of run.events.filter((e) => e.kind === "accepted")) {
    const name = event.data.artifact,
      stem = name.slice(0, -5);
    const response = run.events
      .filter(
        (e) =>
          e.sequence < event.sequence &&
          e.kind === "response" &&
          e.data.artifact?.startsWith(`${stem}-attempt-`),
      )
      .at(-1);
    assert.ok(response, `Missing inference transcript for ${name}`);
    equal(
      artifacts.get(name),
      JSON.parse(artifacts.get(response.data.artifact).text),
      `Model output ${name}`,
    );
  }
  for (const [name, item] of artifacts) {
    if (name.startsWith("arena-routing-")) {
      assert.ok(specialistMode);
      for (const entry of item.candidates) {
        const origin =
          entry.source.runId === run.id
            ? artifacts
            : entry.source.runId === run.summary.sourceRunId
              ? parentArtifacts
              : new Map();
        const source = origin.get(entry.source.artifact);
        if (source) {
          assert.ok(
            /^arena-revision-.*-attempt-\d+\.json$/.test(entry.source.artifact),
            "Expert originates in model transcript",
          );
          equal(
            JSON.parse(source.text).strategy,
            entry.strategy,
            "Exact expert source code",
          );
        } else
          assert.ok(
            parentArtifacts
              .get("arena-state.json")
              ?.specialistPools?.flat()
              .some((v) => hash(v) === hash(entry)),
            "Inherited specialist provenance",
          );
      }
      const learned = learnSpecialists(
        language,
        item.games,
        item.previous,
        item.candidates,
        item.opponents,
      );
      equal(
        learned,
        item.learned,
        "Specialist admission and selector training replay",
      );
      equal(learned.candidate, item.candidate);
      const check = evaluateArenaCandidate(
        language,
        item.games,
        item.previous,
        item.candidate,
        item.others,
        item.opponents,
      );
      equal(check, item.evaluation, "Combined selector promotion replay");
      if (check.accepted) routingPromoted++;
      evaluationMatches +=
        check.before.matches +
        check.after.matches +
        check.trainingBefore.matches +
        check.trainingAfter.matches;
      specialistTrainingMatches += learned.trainingMatches.length;
    }
    if (name.startsWith("arena-grammar-")) {
      const scores = item.forbidden.map((entry) => entry.score);
      equal(
        item.schema,
        constrainRevisionSchema(item.baseSchema, scores),
        "Decoder grammar replay",
      );
      const response = artifacts.get(
        `arena-revision-g${item.generation}-p${item.player}-attempt-${item.attempt}.json`,
      );
      assert.ok(response, "Each grammar has an actual inference response");
      equal(
        response.schema,
        item.schema,
        "Actual request used the exclusion grammar",
      );
      const value = JSON.parse(response.text);
      assert.ok(
        new Ajv().compile(item.schema)(value),
        "Model output conforms to the positive grammar",
      );
      assert.ok(
        !scores.some((s) => hash(s) === hash(value.strategy.score)),
        "No forbidden expression emitted",
      );
      assert.ok(
        emitted.every((s) => scores.some((f) => hash(f) === hash(s))),
        "All earlier drafts remain excluded",
      );
      emitted.push(value.strategy.score);
    }
    if (name.startsWith("arena-novelty-")) {
      equal(
        item.novelty,
        revisionNovelty(
          language,
          item.games,
          item.previous,
          item.candidate,
          item.memory,
        ),
        "Novelty gate replay",
      );
      const response = artifacts.get(
        `arena-revision-g${item.generation}-p${item.player}-attempt-${item.attempt}.json`,
      );
      equal(
        JSON.parse(response.text).strategy,
        item.candidate,
        "Novelty evaluated exact model output",
      );
      equal(
        item.memory,
        artifacts.get(
          `arena-memory-g${item.generation}-p${item.player}-a${item.attempt}.json`,
        ).memory,
        "Novelty uses supplied failed-program memory",
      );
    }
    if (name.startsWith("arena-rules-") && name.endsWith("-compiled.json"))
      equal(
        item,
        expandArenaRules(artifacts.get(name.replace("-compiled", ""))),
        name,
      );
    if (item.engine === "resource-arena-v1" && item.rounds) {
      validateArenaGame(item.gameRules);
      item.strategies.forEach((s) =>
        validateArenaStrategy(language, [item.gameRules], s),
      );
      const replay = playArena(
        language,
        item.gameRules,
        item.strategies,
        item.seed,
      );
      const {
        generation: _generation,
        players: _players,
        gameRules: _rules,
        strategies: _strategies,
        trial: _trial,
        ...saved
      } = item;
      equal(replay, saved, name);
      matches++;
      if (item.trial) trialMatches++;
    }
    if (name.startsWith("arena-diff-")) {
      const check = (
        modelOnly ? evaluateModelRevision : evaluateArenaCandidate
      )(
        language,
        item.games,
        item.previous,
        item.candidate,
        item.others,
        item.opponents,
      );
      equal(check, item.evaluation, name);
      evaluationMatches +=
        check.before.matches +
        check.after.matches +
        check.trainingBefore.matches +
        check.trainingAfter.matches;
      if (check.accepted) promoted++;
      if (modelOnly) {
        assert.equal(item.candidateProvenance, "local_model");
        const attempts = [...artifacts.entries()].filter(([key]) =>
          key.startsWith(
            `arena-revision-g${item.generation}-p${item.player}-attempt-`,
          ),
        );
        assert.ok(
          attempts.some(([, response]) => {
            try {
              return (
                hash(JSON.parse(response.text).strategy) ===
                hash(item.candidate)
              );
            } catch {
              return false;
            }
          }),
          "Candidate must be exact model output",
        );
        if (check.accepted)
          equal(artifacts.get(item.revisionArtifact).strategy, item.candidate);
        const review = artifacts.get(
          `arena-analysis-g${item.generation}-p${item.player}.json`,
        );
        const { generation: _g, player: _p, previous: _s, ...saved } = review;
        equal(
          saved,
          lossReview(language, item.games, item.previous, item.opponents),
          "Executed loss evidence",
        );
      }
    }
    if (name.startsWith("arena-attempt-check-"))
      equal(
        item.evaluation,
        evaluateModelRevision(
          language,
          item.games,
          item.previous,
          item.candidate,
          item.others,
          item.opponents,
        ),
        "Attempt evaluation",
      );
  }
  for (const generation of run.summary.generations) {
    const state = artifacts.get(
      `arena-generation-${generation.generation}.json`,
    );
    const d = diversity(language, state.games, state.strategies);
    equal(d, generation.diversity);
    assert.ok(d.minimum >= DIVERSITY_FLOOR);
    const rows = state.strategies.map((s, player) => ({
      player,
      name: s.name,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
    }));
    const pairwise = [];
    for (let a = 0; a < 3; a++)
      for (let b = a + 1; b < 3; b++)
        pairwise.push({ a, b, aWins: 0, bWins: 0, draws: 0 });
    const games = [...artifacts.values()].filter(
      (a) =>
        a.engine === "resource-arena-v1" &&
        a.rounds &&
        a.generation === generation.generation,
    );
    assert.equal(games.length, state.games.length * 24);
    assert.equal(games.length, generation.matches);
    const coverage = new Set();
    for (const match of games) {
      const pair = pairwise.find(
        (p) => match.players.includes(p.a) && match.players.includes(p.b),
      );
      assert.ok(pair);
      assert.ok(state.games.some((g) => hash(g) === match.gameHash));
      equal(
        match.strategyHashes,
        match.players.map((p) => hash(state.strategies[p])),
      );
      coverage.add(
        `${match.gameHash}:${match.players.join("-")}:${match.seed}`,
      );
      if (match.winner === null) {
        pair.draws++;
        for (const p of match.players) {
          rows[p].draws++;
          rows[p].points++;
        }
      } else {
        const winner = match.players[match.winner],
          loser = match.players[1 - match.winner];
        rows[winner].wins++;
        rows[winner].points += 2;
        rows[loser].losses++;
        if (winner === pair.a) pair.aWins++;
        else pair.bWins++;
      }
    }
    assert.equal(coverage.size, games.length);
    equal(rows, generation.rows);
    equal(pairwise, generation.pairwise);
    if (generation.generation > 0) {
      const previous = artifacts.get(
        `arena-generation-${generation.generation - 1}.json`,
      );
      for (let p = 0; p < 3; p++) {
        const diff = artifacts.get(
          `arena-diff-g${generation.generation}-p${p}.json`,
        );
        if (diff) equal(diff.previous, previous.strategies[p]);
        let expected = diff?.evaluation.accepted
          ? diff.candidate
          : previous.strategies[p];
        const routing = artifacts.get(
          `arena-routing-g${generation.generation}-p${p}.json`,
        );
        if (specialistMode) {
          assert.ok(routing);
          equal(
            routing.previous,
            expected,
            "Selector starts from current installed policy",
          );
          if (routing.evaluation.accepted) expected = routing.candidate;
        }
        equal(state.strategies[p], expected);
      }
    }
  }
  const final = artifacts.get("arena-state.json"),
    last = artifacts.get(
      `arena-generation-${run.summary.generations.at(-1).generation}.json`,
    );
  equal(final.games, last.games);
  equal(final.strategies, last.strategies);
  equal(final.strategies, run.summary.strategies);
  if (specialistMode) {
    for (let p = 0; p < 3; p++) {
      const routing = artifacts.get(
        `arena-routing-g${run.summary.generations.at(-1).generation}-p${p}.json`,
      );
      if (routing)
        equal(
          final.specialistPools[p],
          routing.learned.retained.map(({ strategy, source }) => ({
            strategy,
            source,
          })),
          "Saved specialists persist independently of promotion",
        );
    }
    for (const e of run.events.filter((v) => v.kind === "selection")) {
      const m = artifacts.get(e.data.matchId),
        seat = m.players.indexOf(e.data.player);
      assert.ok(seat >= 0);
      equal(
        e.data.selection,
        m.rounds[e.data.round].selections[seat],
        "Timeline selection matches executed choice",
      );
    }
  }
  if (retryMemory) {
    // A memory entry must point to an actual failed development experiment;
    // held-out tests can never become retry feedback.
    const memorySets = [...artifacts.entries()]
      .filter(([name]) => name.startsWith("arena-memory-g"))
      .map(([, v]) => v.memory)
      .concat(final.failureMemory);
    for (const memory of memorySets) {
      assert.ok(memory.length <= 6);
      assert.equal(
        new Set(memory.map((m) => hash(m.strategy.score))).size,
        memory.length,
      );
      for (const entry of memory) {
        const origin =
          entry.source.runId === run.id
            ? artifacts
            : entry.source.runId === run.summary.sourceRunId
              ? parentArtifacts
              : new Map();
        const source = origin.get(entry.source.artifact);
        // Older inherited ledgers can point farther back than the immediate parent.
        if (!source) {
          assert.ok(
            parentArtifacts
              .get("arena-state.json")
              ?.failureMemory?.flat()
              .some((m) => hash(m) === hash(entry)),
            "Inherited memory must exist in parent",
          );
          continue;
        }
        const policy = source.text
          ? JSON.parse(source.text).strategy
          : source.candidate;
        equal(policy, entry.strategy, "Failure memory model/source identity");
        if (entry.invalid) {
          assert.throws(() =>
            validateArenaStrategy(language, final.games, entry.strategy),
          );
        } else {
          const evidence = source.evaluation
            ? source
            : [...origin.entries()]
                .filter(([name]) => name.startsWith("arena-attempt-check-"))
                .map(([, v]) => v)
                .find(
                  (v) =>
                    hash(v.candidate) === hash(entry.strategy) &&
                    hash(developmentFeedback(v.evaluation, v.games)) ===
                      hash(entry.feedback),
                );
          assert.ok(
            evidence && !evidence.evaluation.accepted,
            "Remember only failed development evaluations",
          );
          equal(
            entry.feedback,
            developmentFeedback(evidence.evaluation, evidence.games),
          );
        }
      }
    }
    if (constrained) {
      const history = final.expressionHistory;
      assert.equal(
        emitted.length,
        run.events.filter(
          (e) =>
            e.kind === "response" &&
            e.data.artifact?.startsWith("arena-revision-"),
        ).length,
        "Every revision used an exclusion grammar",
      );
      assert.equal(
        new Set(history.map((h) => hash(h.score))).size,
        history.length,
      );
      assert.ok(
        emitted.every((s) => history.some((h) => hash(h.score) === hash(s))),
      );
      for (const h of history) {
        if (
          parentArtifacts
            .get("arena-state.json")
            ?.expressionHistory?.some((old) => hash(old) === hash(h))
        )
          continue;
        if (h.source.kind === "active-or-archived") {
          const active = artifacts.get(
            `arena-generation-${h.source.generation - 1}.json`,
          ).strategies;
          const candidates = [
            ...active,
            ...final.archive,
            ...(parentArtifacts.get("arena-state.json")?.archive || []),
          ];
          assert.ok(
            candidates
              .flatMap((s) => [s, ...(s.portfolio?.experts || [])])
              .some((s) => hash(s.score) === hash(h.score)),
          );
        } else {
          const origin =
            h.source.runId === run.id
              ? artifacts
              : h.source.runId === run.summary.sourceRunId
                ? parentArtifacts
                : new Map();
          const source = origin.get(h.source.artifact);
          if (source)
            equal(
              h.score,
              source.text
                ? JSON.parse(source.text).strategy.score
                : source.candidate.score,
            );
          else
            assert.ok(
              parentArtifacts
                .get("arena-state.json")
                ?.expressionHistory?.some((old) => hash(old) === hash(h)) ||
                parentArtifacts
                  .get("arena-state.json")
                  ?.failureMemory?.flat()
                  .some(
                    (old) =>
                      hash(old.strategy.score) === hash(h.score) &&
                      hash(old.source) === hash(h.source),
                  ),
            );
        }
      }
      const inherited =
        parentArtifacts.get("arena-state.json")?.expressionHistory || [];
      assert.ok(
        inherited.every((h) =>
          history.some((v) => hash(v.score) === hash(h.score)),
        ),
        "Inherited exclusions are never dropped",
      );
    }
  }
  if (modelOnly) {
    const initial = artifacts.get("arena-generation-0.json");
    const suite = artifacts.get("arena-holdout-suite.json");
    const seed = parseInt(
      hash({ id: run.id, kind: "unseen-evaluation-v1" }).slice(0, 8),
      16,
    );
    equal(
      suite,
      transferSuite(
        language,
        final.games,
        [...initial.strategies, ...final.strategies, ...final.archive],
        seed,
      ),
      "Fresh deterministic benchmark provenance",
    );
    const frozen = run.events.find((e) => e.kind === "frozen");
    assert.ok(frozen);
    equal(frozen.data.policies, final.strategies.map(policyHash));
    assert.ok(
      !run.events.some(
        (e) => e.sequence > frozen.sequence && e.kind === "inference",
      ),
      "No feedback after freeze",
    );
    assert.ok(
      run.events.find((e) => e.kind === "holdout").sequence > frozen.sequence,
    );
    for (let p = 0; p < 3; p++) {
      const item = artifacts.get(`arena-transfer-p${p}.json`);
      equal(item.previous, initial.strategies[p]);
      equal(item.candidate, final.strategies[p]);
      equal(item.games, final.games);
      equal(item.opponents, initial.strategies);
      const results = transferEvaluation(
        language,
        suite,
        item.games,
        item.opponents,
        item.previous,
        item.candidate,
      );
      equal(item.results, results, "Unseen evaluation replay");
      if (item.proposalResults) {
        const latest = run.events
          .filter(
            (e) =>
              e.data.artifact?.startsWith("arena-diff-") && e.data.player === p,
          )
          .at(-1);
        equal(
          item.proposal,
          artifacts.get(
            specialistMode ? item.proposalArtifact : latest.data.artifact,
          ).candidate,
        );
        const replay = transferEvaluation(
          language,
          suite,
          item.games,
          item.opponents,
          item.previous,
          item.proposal,
        );
        equal(item.proposalResults, replay, "Rejected draft unseen replay");
        transferMatches += replay.reduce(
          (n, r) => n + r.before.matches + r.after.matches,
          0,
        );
      }
      equal(run.summary.transfer[p], {
        player: p,
        results: results.map((r) => ({
          scope: r.scope,
          before: r.before.points,
          after: r.after.points,
          matches: r.before.matches,
        })),
        ...(item.proposalResults
          ? {
              proposalResults: item.proposalResults.map((r) => ({
                scope: r.scope,
                before: r.before.points,
                after: r.after.points,
                matches: r.before.matches,
              })),
            }
          : {}),
      });
      transferMatches += results.reduce(
        (n, r) => n + r.before.matches + r.after.matches,
        0,
      );
    }
  }
  if (artifacts.has("lineage.json")) {
    const lineage = artifacts.get("lineage.json");
    const response = await fetch(
      `http://127.0.0.1:4173/api/lab/runs/${lineage.sourceRunId}`,
    );
    assert.ok(response.ok);
    const parent = await response.json();
    assert.equal(parent.version, lineage.sourceVersion);
    equal(hash(parent), lineage.sourceHash);
  }
  const receipt = {
    checkedAt: new Date().toISOString(),
    runId: run.id,
    mode: "arena",
    matches,
    evaluationMatches,
    transferMatches,
    promoted,
    ...(specialistMode
      ? {
          routingPromoted,
          specialistTrainingMatches,
          trialMatches,
          savedSpecialists: final.specialistPools.map((p) => p.length),
          selectionEvents: run.events.filter((e) => e.kind === "selection")
            .length,
        }
      : {}),
    ...(constrained
      ? {
          generationConstrainedDrafts: emitted.length,
          exactRepeats: emitted.length - new Set(emitted.map(hash)).size,
        }
      : {}),
    ...(retryMemory
      ? {
          novelDrafts: run.events.filter((e) => e.kind === "novelty").length,
          duplicatesBlocked: run.events.filter((e) => e.kind === "duplicate")
            .length,
        }
      : {}),
    games: final.games.map((g) => g.name),
    generations: run.summary.generations.map((g) => ({
      generation: g.generation,
      games: g.games,
      minimumDistance: g.diversity.minimum,
    })),
    calls: run.summary.calls,
    usage: run.summary.usage,
    artifactsChecked: artifacts.size,
    runHash: hash(run),
  };
  await mkdir("runtime/verification", { recursive: true });
  await writeFile(
    `runtime/verification/lab-${run.id}.json`,
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt, null, 2));
}
