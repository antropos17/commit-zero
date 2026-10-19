import { compileLanguage, languageContract } from "./language.mjs";
import { outputSchema, resultType } from "./schema.mjs";
import { hash } from "./store.mjs";
import { learnSpecialists } from "./arena-specialists.mjs";
import {
  constrainRevisionSchema,
  rememberExpression,
} from "./arena-decoder.mjs";
import {
  arenaGameContract,
  expandArenaRules,
  arenaGameSchema,
  arenaStrategySchema,
  validateArenaGame,
  validateArenaStrategy,
  evaluateArenaCandidate,
  gameFingerprint,
  diversity,
  DIVERSITY_FLOOR,
  playArena,
  policyHash,
} from "./arena-engine.mjs";
import {
  lossReview,
  compactReview,
  evaluateModelRevision,
  transferSuite,
  transferEvaluation,
} from "./arena-learning.mjs";
import { broadcastMatch } from "./arena-broadcast.mjs";
import {
  RETRY_LIMIT,
  revisionNovelty,
  developmentFeedback,
  rememberFailure,
  revisionPrompt,
} from "./arena-revisions.mjs";

export async function runArena(store, model, id, callerSignal, options = {}) {
  const signal = AbortSignal.any([
    callerSignal,
    AbortSignal.timeout(20 * 60000),
  ]);
  let calls = 0,
    games = [],
    strategies = [],
    archive = [],
    failureMemory = [[], [], []],
    expressionHistory = [],
    specialistPools = [[], [], []];
  const routingResults = [],
    latestProposalSources = [],
    importedCandidates = [[], [], []];
  const generations = [],
    latestProposals = [],
    usage = { prompt: 0, completion: 0 },
    started = Date.now();
  const event = (actor, kind, message, data = {}, opts = {}) => {
    signal.throwIfAborted();
    return store.event(id, actor, kind, message, data, {
      summary: {
        mode: "arena",
        learningProtocol: "model-revision-v5",
        games,
        generations,
        calls,
        usage,
        archive: archive.length,
        routingResults,
        sourceRunId: options.source?.id || null,
      },
      ...opts,
    });
  };
  const save = (actor, kind, message, name, content, data = {}) =>
    event(
      actor,
      kind,
      message,
      { ...data, artifact: name },
      { artifact: { name, content } },
    );
  async function generate(actor, name, prompt, schema, validate, attempts = 3) {
    let feedback = "";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      signal.throwIfAborted();
      if (++calls > 60) throw new Error("Inference budget exhausted.");
      await event(
        actor,
        "inference",
        `Generating ${name}, attempt ${attempt}.`,
      );
      const seed =
        (parseInt(id.replaceAll("-", "").slice(0, 7), 16) + calls * 137) %
        2147483647;
      const input =
          typeof prompt === "function"
            ? await prompt(attempt, feedback)
            : prompt + feedback,
        activeSchema =
          typeof schema === "function" ? await schema(attempt) : schema,
        output = await model.generate(input, signal, seed, activeSchema);
      usage.prompt += output.usage.prompt_tokens || 0;
      usage.completion += output.usage.completion_tokens || 0;
      await save(
        actor,
        "response",
        `Saved actual model response for ${name}.`,
        `${name}-attempt-${attempt}.json`,
        {
          actor,
          prompt: input,
          schema: activeSchema,
          seed,
          ...output,
          provenance: model.provenance,
        },
      );
      try {
        if (output.finishReason === "length")
          throw new Error(
            "Truncated output; return a shorter complete object.",
          );
        const value = JSON.parse(output.text);
        await validate(value, attempt);
        await save(
          actor,
          "accepted",
          `${name} passed executable validation.`,
          `${name}.json`,
          value,
        );
        return value;
      } catch (error) {
        await event("verifier", "rejected", `${name}: ${error.message}`);
        feedback =
          typeof prompt === "function"
            ? error.message
            : `\nRejected output: ${output.text.slice(0, 2500)}\nFix: ${error.message}`;
      }
    }
    throw new Error(`${name} rejected after ${attempts} model attempts.`);
  }
  try {
    await event(
      "runner",
      "started",
      "Resource arena: a rule author and three strategist roles share one real local model.",
    );
    const source = options.source;
    const copy = async (name) =>
      (await store.artifact(source.id, name)).content;
    if (source)
      await save(
        "runner",
        "lineage",
        "Parent history retained; arena continues arena state or inherits only the heap language.",
        "lineage.json",
        {
          sourceRunId: source.id,
          sourceVersion: source.version,
          sourceHash: hash(JSON.parse(JSON.stringify(source))),
          sourceHashEncoding: "json-iso-dates-v1",
          inheritance:
            source.summary.mode === "arena" ? "arena-state" : "language-only",
        },
      );
    const language = source
      ? await copy("language.json")
      : await generate(
          "language-author",
          "language",
          languageContract +
            "\nInclude at least two numeric-result functions useful for scoring energy costs and expected payoffs. One function must compose primitives.",
          outputSchema("language"),
          (value) => {
            compileLanguage(value);
            if (
              value.functions.filter((f) => resultType(f.body) === "number")
                .length < 2
            )
              throw new Error("Include at least two numeric-result functions.");
          },
        );
    if (source)
      await save(
        "language-author",
        "inherited",
        "Inherited generated expression language.",
        "language.json",
        language,
      );
    if (source?.summary.mode === "arena") {
      const state = await copy("arena-state.json");
      games = state.games;
      strategies = state.strategies;
      archive = state.archive;
      failureMemory = state.failureMemory || [[], [], []];
      expressionHistory = structuredClone(state.expressionHistory || []);
      specialistPools = structuredClone(state.specialistPools || [[], [], []]);
      for (const meta of source.artifacts.filter((a) =>
        /^arena-revision-.*-attempt-\d+\.json$/.test(a.name),
      )) {
        const response = await copy(meta.name);
        try {
          const strategy = JSON.parse(response.text).strategy;
          const score = strategy?.score;
          const player = Number(meta.name.match(/-p(\d+)-/)[1]);
          if (score)
            importedCandidates[player].push({
              strategy,
              source: { runId: source.id, artifact: meta.name },
            });
          if (score)
            rememberExpression(expressionHistory, score, {
              runId: source.id,
              artifact: meta.name,
            });
        } catch {
          /* Truncated responses are not executable programs. */
        }
      }
      for (const entry of failureMemory.flat())
        rememberExpression(
          expressionHistory,
          entry.strategy.score,
          entry.source,
        );
      if (!state.failureMemory) {
        for (const meta of source.artifacts.filter((a) =>
          a.name.startsWith("arena-diff-"),
        )) {
          const item = await copy(meta.name);
          if (!item.evaluation.accepted)
            failureMemory[item.player] = rememberFailure(
              failureMemory[item.player],
              {
                source: { runId: source.id, artifact: meta.name },
                strategy: item.candidate,
                feedback: developmentFeedback(item.evaluation, item.games),
              },
            );
        }
      }
      await save(
        "runner",
        "memory",
        "Inherited bounded failed-program memory; unseen results excluded.",
        "arena-memory-initial.json",
        failureMemory,
      );
      games.forEach(validateArenaGame);
      strategies.forEach((s) => validateArenaStrategy(language, games, s));
      if (diversity(language, games, strategies).minimum < DIVERSITY_FLOOR)
        throw new Error("Inherited population fails diversity gate.");
    }
    async function proposeGame(generation) {
      if (games.length >= 5) {
        await event(
          "rule-author",
          "budget",
          "Five active rule sets retained; further rule expansion is bounded.",
          { generation },
        );
        return;
      }
      const draft = await generate(
        "rule-author",
        `arena-rules-g${generation}-${games.length}`,
        `${arenaGameContract}\nExisting numeric rules (invent a different game): ${JSON.stringify(games)}\nLast tournament results: ${JSON.stringify(generations.at(-1) || null)}`,
        arenaGameSchema,
        (draft) => {
          const value = expandArenaRules(draft);
          validateArenaGame(value);
          if (
            games.some(
              (g) =>
                gameFingerprint(g) === gameFingerprint(value) ||
                g.name === value.name,
            )
          )
            throw new Error(
              "Rules and game name must differ from existing games.",
            );
          if (
            strategies.length &&
            diversity(language, [...games, value], strategies).minimum <
              DIVERSITY_FLOOR
          )
            throw new Error(
              "This rule set collapses behavioral diversity below 12%; change executable tradeoffs.",
            );
        },
      );
      const game = expandArenaRules(draft);
      await save(
        "verifier",
        "compiled",
        "Expanded model-authored counter edges into the executable payoff tables.",
        `arena-rules-g${generation}-${games.length}-compiled.json`,
        game,
      );
      games.push(game);
      await event(
        "rule-author",
        "rules",
        "New model-authored executable rules enter the next tournament.",
        {
          generation,
          game: game.name,
          gameHash: hash(game),
          activeGames: games.length,
        },
      );
    }
    if (!games.length) {
      await proposeGame(0);
      await proposeGame(0);
    }
    const strategyPrompt = `Write a strategy using ONLY calls to these generated functions: ${JSON.stringify(language)}. score must be a numeric expression. Variables: action (candidate 0..2), phase, round, energy, oppEnergy, lastSelf, lastOpp, cost, pay0,pay1,pay2 (payoffs against each opponent action), expected (payoff versus observed frequencies), counter (payoff versus last opponent action), opp0,opp1,opp2. Larger score increases action probability through softmax temperature 0.3..3, with 5% exploration. Illegal unaffordable actions are masked. Both choices are simultaneous. Return name, explanation, score, temperature. `;
    while (strategies.length < 3) {
      const player = strategies.length,
        actor = `strategist-${player + 1}`;
      let strategy;
      try {
        strategy = await generate(
          actor,
          `arena-strategy-${player}`,
          `${strategyPrompt}\nRules: ${JSON.stringify(games)}\nSeek a distinct tactical approach from these existing policies: ${JSON.stringify(strategies)}. Role focus: ${["opponent adaptation", "resource conservation", "phase-sensitive pressure"][player]}.`,
          arenaStrategySchema(language),
          (value) => {
            validateArenaStrategy(language, games, value);
            if (
              diversity(language, games, [...strategies, value]).minimum <
              DIVERSITY_FLOOR
            )
              throw new Error(
                "Behavioral clone: change decisions, not just name or description. Minimum distance is 12%.",
              );
          },
        );
      } catch (error) {
        signal.throwIfAborted();
        await event(actor, "repair", error.message);
        throw error;
      }
      strategies.push(strategy);
      await save(
        actor,
        "policy",
        "Initial executable policy saved.",
        `arena-initial-policy-${player}.json`,
        strategy,
      );
    }
    async function tournament(generation) {
      const rows = strategies.map((s, player) => ({
          player,
          name: s.name,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
        })),
        pairwise = [];
      let count = 0;
      for (let a = 0; a < 3; a++)
        for (let b = a + 1; b < 3; b++) {
          const pair = { a, b, aWins: 0, bWins: 0, draws: 0 };
          for (const [gameIndex, game] of games.entries())
            for (const seed of [21, 22, 23, 24])
              for (const swap of [false, true]) {
                signal.throwIfAborted();
                const players = swap ? [b, a] : [a, b];
                const matchId = `arena-match-g${generation}-${count++}.json`;
                const featured =
                  seed === 21 &&
                  !swap &&
                  [
                    [0, 1],
                    [0, 2],
                    [1, 2],
                  ][(gameIndex + generation) % 3].every(
                    (p, i) => p === [a, b][i],
                  );
                const match = featured
                  ? await broadcastMatch({
                      language,
                      game,
                      strategies: players.map((p) => strategies[p]),
                      seed,
                      players,
                      generation,
                      matchId,
                      event,
                      signal,
                      delayMs: options.spectatorDelayMs ?? 650,
                    })
                  : playArena(
                      language,
                      game,
                      players.map((p) => strategies[p]),
                      seed,
                    );
                await save(
                  "arena",
                  "match",
                  `${game.name}: ${match.winner === null ? "draw" : `strategist ${players[match.winner] + 1} wins`}.`,
                  matchId,
                  {
                    ...match,
                    generation,
                    players,
                    gameRules: game,
                    strategies: players.map((p) => strategies[p]),
                  },
                  { generation, players, game: game.name, featured },
                );
                if (match.winner === null) {
                  pair.draws++;
                  for (const p of players) {
                    rows[p].draws++;
                    rows[p].points++;
                  }
                } else {
                  const winner = players[match.winner],
                    loser = players[1 - match.winner];
                  rows[winner].wins++;
                  rows[winner].points += 2;
                  rows[loser].losses++;
                  if (winner === a) pair.aWins++;
                  else pair.bWins++;
                }
              }
          pairwise.push(pair);
        }
      const result = {
        generation,
        games: games.length,
        matches: count,
        rows,
        pairwise,
        diversity: diversity(language, games, strategies),
      };
      generations.push(result);
      await save(
        "arena",
        "generation",
        `Generation ${generation}: ${count} executed matches; minimum behavioral distance ${(result.diversity.minimum * 100).toFixed(1)}%.`,
        `arena-generation-${generation}.json`,
        { ...result, games, strategies },
        { generation, ...result },
      );
      await event(
        "runner",
        "checkpoint",
        "Generation saved.",
        {},
        {
          summary: {
            mode: "arena",
            learningProtocol: "model-revision-v5",
            generations,
            games,
            calls,
            usage,
            sourceRunId: source?.id || null,
          },
        },
      );
    }
    const initialStrategies = structuredClone(strategies);
    await tournament(0);
    for (
      let generation = 1;
      generation <= (options.learningRounds ?? 2);
      generation++
    ) {
      try {
        await proposeGame(generation);
      } catch (error) {
        signal.throwIfAborted();
        await event(
          "rule-author",
          "retained",
          `Rule proposal rejected; existing rules retained. ${error.message}`,
          { generation },
        );
      }
      const frozen = [...strategies],
        opponents = [...frozen, ...archive]
          .filter(
            (s, i, all) =>
              all.findIndex((p) => policyHash(p) === policyHash(s)) === i,
          )
          .slice(0, 9);
      for (const policy of opponents.flatMap((s) => [
        s,
        ...(s.portfolio?.experts || []),
      ]))
        rememberExpression(expressionHistory, policy.score, {
          kind: "active-or-archived",
          generation,
        });
      for (let player = 0; player < 3; player++) {
        const actor = `strategist-${player + 1}`,
          previous = strategies[player],
          others = strategies.filter((_, p) => p !== player);
        const review = lossReview(language, games, previous, opponents);
        await save(
          actor,
          "analysis",
          "Loss review: pre-action observations, energy constraints and hindsight counterfactuals.",
          `arena-analysis-g${generation}-p${player}.json`,
          { generation, player, previous, ...review },
        );
        let candidate,
          evaluation,
          revision,
          revisionAttempt = 0;
        const schema = arenaStrategySchema(language);
        const revisionSchema = {
          type: "object",
          additionalProperties: false,
          required: [
            "lesson",
            "approach",
            "diagnosis",
            "evidence",
            "hypothesis",
            "strategy",
          ],
          properties: {
            lesson: { type: "string", minLength: 10, maxLength: 240 },
            approach: { type: "string", minLength: 10, maxLength: 180 },
            diagnosis: { type: "string", minLength: 10, maxLength: 360 },
            evidence: { type: "string", minLength: 10, maxLength: 240 },
            hypothesis: { type: "string", minLength: 10, maxLength: 240 },
            strategy: {
              type: "object",
              additionalProperties: false,
              required: schema.required,
              properties: schema.properties,
            },
          },
          $defs: schema.$defs,
        };
        try {
          revision = await generate(
            actor,
            `arena-revision-g${generation}-p${player}`,
            async (attempt, feedback) => {
              await save(
                actor,
                "memory",
                `Revision ${attempt}: ${failureMemory[player].length} remembered failures; a distinct approach is required.`,
                `arena-memory-g${generation}-p${player}-a${attempt}.json`,
                { generation, player, attempt, memory: failureMemory[player] },
              );
              return revisionPrompt(
                `${strategyPrompt}
Write your own NEW expression tree, not a choice from a catalogue. No synthesis tool is available. Return diagnosis (why losses happened), evidence (cite game and round), hypothesis (specific executable correction and expected effect), and strategy. Do not copy the incumbent expression. Use a nested expression when needed; function bodies define exact semantics, not their names. Hindsight opponentAction cannot be observed at decision time. Correct only using declared observation variables. A confident explanation is not proof.
Rules: ${JSON.stringify(games.map(({ name, costs, recharge, energyCap, phaseLength, payoffs }) => ({ name, costs, recharge, energyCap, phaseLength, payoffs })))}
Incumbent: ${JSON.stringify({ score: previous.score, temperature: previous.temperature })}
Executed loss review (rounded prompt; exact evidence in saved artifact): ${compactReview(review)}
Other active policies (avoid behavioral clones): ${JSON.stringify(others.map(({ score, temperature }) => ({ score, temperature })))}`,
                failureMemory[player],
                attempt,
                feedback,
              );
            },
            async (attempt) => {
              if (expressionHistory.length > 512)
                throw new Error(
                  "Expression history budget exhausted; no exclusions were dropped.",
                );
              const constrained = constrainRevisionSchema(
                revisionSchema,
                expressionHistory.map((entry) => entry.score),
              );
              await save(
                actor,
                "grammar",
                `Generation-time exclusion: ${expressionHistory.length} known expressions cannot be emitted. Integer literals -100..100; two call layers.`,
                `arena-grammar-g${generation}-p${player}-a${attempt}.json`,
                {
                  generation,
                  player,
                  attempt,
                  baseSchema: revisionSchema,
                  forbidden: structuredClone(expressionHistory),
                  schema: constrained,
                },
              );
              return constrained;
            },
            async (value, attempt) => {
              const sourceRef = {
                runId: id,
                artifact: `arena-revision-g${generation}-p${player}-attempt-${attempt}.json`,
              };
              if (
                expressionHistory.some(
                  (entry) => hash(entry.score) === hash(value.strategy?.score),
                )
              )
                throw new Error(
                  "Decoder contract violation: emitted a forbidden expression.",
                );
              if (value.strategy?.score)
                rememberExpression(
                  expressionHistory,
                  value.strategy.score,
                  sourceRef,
                );
              let novelty;
              try {
                novelty = revisionNovelty(
                  language,
                  games,
                  previous,
                  value.strategy,
                  failureMemory[player],
                );
              } catch (error) {
                if (value.strategy?.score)
                  failureMemory[player] = rememberFailure(
                    failureMemory[player],
                    {
                      source: sourceRef,
                      strategy: value.strategy,
                      invalid: true,
                      feedback: { reason: error.message },
                    },
                  );
                throw error;
              }
              await save(
                "verifier",
                novelty.novel ? "novelty" : "duplicate",
                novelty.novel
                  ? `Draft ${attempt}: new executable behavior; evaluating the model's approach.`
                  : `Draft ${attempt}: ${novelty.reason}; skipped repeated match evaluation.`,
                `arena-novelty-g${generation}-p${player}-a${attempt}.json`,
                {
                  generation,
                  player,
                  attempt,
                  games,
                  previous,
                  candidate: value.strategy,
                  memory: failureMemory[player],
                  novelty,
                },
              );
              if (!novelty.novel)
                throw new Error(
                  `${novelty.reason}. The failed-program memory identifies the earlier source. Abandon this expression and change the approach, not the name or temperature.`,
                );
              if (
                ![
                  value.lesson,
                  value.approach,
                  value.diagnosis,
                  value.evidence,
                  value.hypothesis,
                ].every((v) => typeof v === "string" && v.length >= 10)
              )
                throw new Error(
                  "Provide a diagnosis, concrete evidence and a testable hypothesis.",
                );
              await event(
                actor,
                "hypothesis",
                `${value.approach} Lesson: ${value.lesson}`,
                { generation, player, attempt, artifact: sourceRef.artifact },
              );
              candidate = value.strategy;
              specialistPools[player].push({
                strategy: candidate,
                source: sourceRef,
              });
              latestProposals[player] = structuredClone(candidate);
              evaluation = evaluateModelRevision(
                language,
                games,
                previous,
                candidate,
                others,
                opponents,
              );
              await save(
                "verifier",
                "evaluation",
                `Model draft ${++revisionAttempt}: development points ${evaluation.before.points} -> ${evaluation.after.points}; ${evaluation.accepted ? "passed" : "rejected"}.`,
                `arena-attempt-check-g${generation}-p${player}-${revisionAttempt}.json`,
                { games, previous, candidate, others, opponents, evaluation },
              );
              if (hash(candidate.score) === hash(previous.score))
                throw new Error(
                  "The expression is unchanged. Write a different expression tree; renaming or changing temperature alone is insufficient.",
                );
              if (!evaluation.accepted) {
                failureMemory[player] = rememberFailure(failureMemory[player], {
                  source: sourceRef,
                  strategy: candidate,
                  feedback: developmentFeedback(evaluation, games),
                });
                throw new Error(
                  `Revise your code. Development control points ${evaluation.before.points} -> ${evaluation.after.points}; training ${evaluation.trainingBefore.points} -> ${evaluation.trainingAfter.points}; behavioral distance ${(evaluation.diversity.minimum * 100).toFixed(1)}%. Need higher control, no training regression, distance >=12%. These development checks are feedback, not unseen evaluation.`,
                );
              }
            },
            RETRY_LIMIT,
          );
        } catch (error) {
          signal.throwIfAborted();
          await event(
            actor,
            "retained",
            `Model revision budget ended; no host-generated replacement. ${error.message}`,
            { generation, player },
          );
        }
        if (!candidate || !evaluation) continue;
        // Only a fully validated model response can be installed.
        if (!revision && evaluation.accepted)
          throw new Error("Unaccepted model output cannot promote a policy.");
        if (evaluation.accepted) strategies[player] = candidate;
        await save(
          actor,
          evaluation.accepted ? "promoted" : "retained",
          evaluation.reason,
          `arena-diff-g${generation}-p${player}.json`,
          {
            engine: "resource-arena-v1",
            generation,
            player,
            previous,
            candidate,
            candidateProvenance: "local_model",
            revisionArtifact: revision
              ? `arena-revision-g${generation}-p${player}.json`
              : null,
            analysis: revision?.diagnosis || candidate.explanation,
            hypothesis: revision?.hypothesis,
            games,
            others,
            opponents,
            evaluation,
          },
          { generation, player, accepted: evaluation.accepted },
        );
        latestProposalSources[player] =
          `arena-diff-g${generation}-p${player}.json`;
      }
      for (let player = 0; player < 3; player++) {
        signal.throwIfAborted();
        const previous = strategies[player],
          actor = `strategist-${player + 1}`;
        const candidates = [
          ...specialistPools[player],
          ...importedCandidates[player],
        ].filter(
          (v, i, all) =>
            all.findIndex(
              (p) => policyHash(p.strategy) === policyHash(v.strategy),
            ) === i,
        );
        if (candidates.length > 64)
          throw new Error("Specialist assessment budget exhausted.");
        await event(
          actor,
          "specialization",
          `Assessing ${candidates.length} saved programs for game-specific strengths; unseen results excluded.`,
          { generation, player },
        );
        const learned = learnSpecialists(
          language,
          games,
          previous,
          candidates,
          opponents,
        );
        specialistPools[player] = learned.retained.map(
          ({ strategy, source }) => ({ strategy, source }),
        );
        const artifact = `arena-routing-g${generation}-p${player}.json`;
        const others = strategies.filter((_, p) => p !== player);
        const evaluation = evaluateArenaCandidate(
          language,
          games,
          previous,
          learned.candidate,
          others,
          opponents,
        );
        if (evaluation.accepted) strategies[player] = learned.candidate;
        const item = {
          generation,
          player,
          specialists: learned.retained.length,
          accepted: evaluation.accepted,
          before: evaluation.before.points,
          after: evaluation.after.points,
          strengths: learned.retained.map((s) =>
            s.strengths.map((g) => g.game),
          ),
        };
        routingResults.push(item);
        await save(
          actor,
          "routing",
          `Learned selector: ${learned.retained.length} specialists; control ${item.before} -> ${item.after}; ${item.accepted ? "installed" : "retained baseline"}. Uses rules and past observed actions only.`,
          artifact,
          {
            generation,
            player,
            previous,
            candidates,
            games,
            opponents,
            others,
            learned,
            candidate: learned.candidate,
            evaluation,
          },
          { generation, player },
        );
        for (const [index, expert] of learned.retained.entries())
          await event(
            actor,
            "specialist",
            `Saved specialist ${index + 1}: ${expert.strengths.map((s) => `${s.game} ${s.control[0]} -> ${s.control[1]}`).join("; ")}. Paired specialization checks.`,
            { generation, player, artifact, index },
          );
        if (learned.retained.length) {
          latestProposals[player] = structuredClone(learned.candidate);
          latestProposalSources[player] = artifact;
          const game = games.find(
            (g) => gameFingerprint(g) === learned.retained[0].strengths[0].key,
          );
          const players = [player, (player + 1) % 3],
            policies = [learned.candidate, frozen[players[1]]];
          const matchId = `arena-match-trial-g${generation}-p${player}.json`;
          const match = await broadcastMatch({
            language,
            game,
            strategies: policies,
            seed: 73001 + player,
            players,
            generation: null,
            trial: true,
            matchId,
            event,
            signal,
            delayMs: options.spectatorDelayMs ?? 650,
          });
          await save(
            "arena",
            "match",
            "Selector trial completed; this demonstration does not affect promotion.",
            matchId,
            {
              ...match,
              generation: null,
              trial: true,
              players,
              gameRules: game,
              strategies: policies,
            },
            { generation: null, trial: true, players, game: game.name },
          );
        }
      }
      archive = [...archive, ...frozen]
        .filter(
          (s, i, all) =>
            all.findIndex((p) => policyHash(p) === policyHash(s)) === i,
        )
        .slice(-6);
      await tournament(generation);
    }
    await save(
      "runner",
      "checkpoint",
      "Final policies, rule sets and opponent archive saved.",
      "arena-state.json",
      {
        engine: "resource-arena-v1",
        games,
        strategies,
        archive,
        failureMemory,
        expressionHistory,
        specialistPools,
      },
    );
    await event(
      "verifier",
      "frozen",
      "Strategies frozen. Fresh evaluation fixtures will not be used for model feedback.",
      { policies: strategies.map(policyHash) },
    );
    const seed = parseInt(
      hash({ id, kind: "unseen-evaluation-v1" }).slice(0, 8),
      16,
    );
    const suite = transferSuite(
      language,
      games,
      [...initialStrategies, ...strategies, ...archive],
      seed,
    );
    await save(
      "verifier",
      "holdout",
      "Two new rule sets and three new opponents generated for evaluation only.",
      "arena-holdout-suite.json",
      suite,
    );
    const transfer = [];
    for (let player = 0; player < 3; player++) {
      signal.throwIfAborted();
      const results = transferEvaluation(
        language,
        suite,
        games,
        initialStrategies,
        initialStrategies[player],
        strategies[player],
      );
      const item = {
        version: 1,
        player,
        previous: initialStrategies[player],
        candidate: strategies[player],
        games,
        opponents: initialStrategies,
        results,
      };
      if (
        latestProposals[player] &&
        policyHash(latestProposals[player]) !== policyHash(strategies[player])
      ) {
        item.proposal = latestProposals[player];
        item.proposalArtifact = latestProposalSources[player];
        item.proposalResults = transferEvaluation(
          language,
          suite,
          games,
          initialStrategies,
          initialStrategies[player],
          item.proposal,
        );
      }
      transfer.push({
        player,
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
      await save(
        "verifier",
        "transfer",
        `Strategist ${player + 1}: ${results.map((r) => r.scope + " " + r.before.points + " -> " + r.after.points).join("; ")}. Unseen evaluation; no promotion or feedback.${item.proposalResults ? " Rejected model draft also tested separately: " + item.proposalResults.map((r) => r.scope + " " + r.before.points + " -> " + r.after.points).join("; ") : ""}`,
        `arena-transfer-p${player}.json`,
        item,
      );
    }
    await event(
      "runner",
      "completed",
      "Arena experiment complete; model-authored rules and every executed match are inspectable.",
      {},
      {
        status: "completed",
        summary: {
          mode: "arena",
          games,
          strategies,
          learningProtocol: "model-revision-v5",
          transfer,
          routingResults,
          generations,
          archive: archive.length,
          calls,
          usage,
          elapsedMs: Date.now() - started,
          sourceRunId: source?.id || null,
        },
      },
    );
  } catch (error) {
    await store.event(
      id,
      "runner",
      "failed",
      error.message,
      {},
      {
        status: callerSignal.aborted ? "cancelled" : "failed",
        summary: {
          mode: "arena",
          learningProtocol: "model-revision-v5",
          generations,
          games,
          calls,
          usage,
          error: error.message,
        },
      },
    );
  }
}
