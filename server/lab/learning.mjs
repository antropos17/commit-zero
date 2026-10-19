import {
  compileLanguage,
  validateGame,
  validateStrategy,
  playMatch,
} from "./language.mjs";
import { hash } from "./store.mjs";
import { outputSchema } from "./schema.mjs";
import { searchPolicies } from "./strategy-search.mjs";

// The verifier solves the bounded games, not the agents' programming task.
// It supplies measured feedback; only model-produced programs can be promoted.
export function assessPolicy(language, game, strategy) {
  const machine = compileLanguage(language),
    { loses } = validateGame(language, game);
  const policy = strategy.policies.find((p) => p.game === game.name);
  const winning = Array.from({ length: 65 }, () => [false, false]);
  const states = [];
  for (let heap = 1; heap <= 64; heap++) {
    for (let turn = 0; turn < 2; turn++) {
      const choices = [];
      for (let move = 1; move <= Math.min(heap, 8); move++) {
        if (!machine.evaluate(game.legal, { heap, move, turn })) continue;
        const after = heap - move;
        choices.push({
          move,
          wins: after === 0 ? !loses : !winning[after][1 - turn],
          score: machine.evaluate(policy.score, { heap, move, after, turn }),
        });
      }
      const good = choices.filter((c) => c.wins).map((c) => c.move);
      winning[heap][turn] = good.length > 0;
      choices.sort((a, b) => b.score - a.score || a.move - b.move);
      states.push({
        heap,
        turn,
        chosen: choices[0].move,
        winningMoves: good,
        mistake: good.length > 0 && !choices[0].wins,
      });
    }
  }
  return {
    game: game.name,
    states,
    trainingErrors: states.filter((s) => s.heap <= 32 && s.mistake).length,
    controlErrors: states.filter((s) => s.heap > 32 && s.mistake).length,
  };
}

export function assessStrategies(language, games, strategies) {
  return strategies.map((strategy) => {
    const reports = games.map((game) => assessPolicy(language, game, strategy));
    return {
      strategyHash: hash(strategy),
      games: reports,
      trainingErrors: reports.reduce((n, r) => n + r.trainingErrors, 0),
      controlErrors: reports.reduce((n, r) => n + r.controlErrors, 0),
    };
  });
}

export function lossFeedback(language, games, strategies, matches, player) {
  const assessment = assessStrategies(language, games, [strategies[player]])[0];
  const losses = matches.filter((m) => m.winner !== player);
  return {
    provenance: "host_verifier",
    player,
    strategyHash: hash(strategies[player]),
    lossCount: losses.length,
    matchCount: matches.length,
    // Complete loss evidence remains in the artifact; a bounded sample enters inference.
    losses: losses.map((m) => ({
      artifact: m.artifact,
      game: m.game,
      opening: m.opening,
      first: m.first,
      moves: m.moves,
    })),
    training: assessment.games.map((g) => ({
      game: g.game,
      errors: g.trainingErrors,
      losingHeapsByTurn: [0, 1].map((turn) =>
        g.states
          .filter(
            (s) =>
              s.heap <= 32 && s.turn === turn && s.winningMoves.length === 0,
          )
          .map((s) => s.heap),
      ),
      examples: g.states.filter((s) => s.heap <= 32 && s.turn === 0),
    })),
    explanation:
      "Winning moves were computed by exhaustive backward induction. A mistake loses a position that has a winning move against perfect play. Forced losses are not mistakes. Control heaps 33..64 are excluded from model feedback.",
  };
}

// Paired seats against the SAME frozen opponents. Scores are never compared
// between changing opponent populations. This is a reusable control suite,
// not an independent statistical generalization benchmark.
export function compareCandidate(
  language,
  games,
  previous,
  candidate,
  opponents,
) {
  validateStrategy(language, games, candidate);
  const [before, after] = assessStrategies(language, games, [
    previous,
    candidate,
  ]);
  const league = [];
  for (const [opponent, frozen] of opponents.entries())
    for (const [game, rules] of games.entries())
      for (let opening = 33; opening <= 48; opening++)
        for (let first = 0; first < 2; first++) {
          const oldMatch = playMatch(
            language,
            rules,
            [previous, frozen],
            opening,
            first,
          );
          const newMatch = playMatch(
            language,
            rules,
            [candidate, frozen],
            opening,
            first,
          );
          league.push({
            opponent,
            game,
            opening,
            first,
            before: oldMatch,
            after: newMatch,
          });
        }
  const oldWins = league.filter((m) => m.before.winner === 0).length;
  const newWins = league.filter((m) => m.after.winner === 0).length;
  const changed = hash(previous.policies) !== hash(candidate.policies);
  const accepted =
    changed &&
    after.controlErrors < before.controlErrors &&
    after.trainingErrors <= before.trainingErrors &&
    newWins >= oldWins;
  return {
    provenance: "host_verifier",
    accepted,
    changed,
    before: {
      trainingErrors: before.trainingErrors,
      controlErrors: before.controlErrors,
      wins: oldWins,
    },
    after: {
      trainingErrors: after.trainingErrors,
      controlErrors: after.controlErrors,
      wins: newWins,
    },
    matchesPerVersion: league.length,
    previousHash: hash(previous),
    candidateHash: hash(candidate),
    opponentHashes: opponents.map(hash),
    league,
    reason: accepted
      ? "Fewer control mistakes, no training regression, no loss of wins against frozen opponents."
      : "Not promoted: requires fewer control mistakes, no training regression, and at least as many wins against the same frozen opponents.",
  };
}

export async function tournament({
  language,
  games,
  strategies,
  generation,
  event,
  guard,
}) {
  const scores = [0, 0],
    results = [],
    matches = [];
  const prefix = generation ? `g${generation}-` : "";
  await event(
    "referee",
    "tournament",
    `Generation ${generation}: starting 64 executable matches.`,
    { generation },
  );
  for (const [g, game] of games.entries()) {
    const { initial } = validateGame(language, game);
    for (let offset = 0; offset < 16; offset++)
      for (let first = 0; first < 2; first++) {
        guard();
        const match = playMatch(
          language,
          game,
          strategies,
          ((initial - 1 + offset) % 32) + 1,
          first,
        );
        scores[match.winner]++;
        const name = `${prefix}match-${results.length + 1}.json`;
        const content = {
          game: game.name,
          ...match,
          languageHash: hash(language),
          gameHash: hash(game),
          strategyHashes: strategies.map(hash),
        };
        results.push({
          artifact: name,
          game: g,
          opening: match.opening,
          first,
          winner: match.winner,
          turns: match.moves.length,
        });
        matches.push({ ...match, artifact: name, game: g });
        await event(
          "referee",
          "match",
          `G${generation} · strategist ${match.winner + 1} won ${game.name} from heap ${match.opening}.`,
          {
            artifact: name,
            generation,
            winner: match.winner,
            turns: match.moves.length,
          },
          { artifact: { name, content } },
        );
        await new Promise((resolve) => setImmediate(resolve));
      }
  }
  const metrics = assessStrategies(language, games, strategies).map(
    ({ strategyHash, trainingErrors, controlErrors }) => ({
      strategyHash,
      trainingErrors,
      controlErrors,
    }),
  );
  return {
    generation,
    scores,
    results,
    matches,
    metrics,
    strategyHashes: strategies.map(hash),
  };
}

function revisionSchema(language) {
  const strategy = outputSchema("strategy", language);
  const { $defs, ...body } = strategy;
  body.properties.name = { type: "string", minLength: 2, maxLength: 48 };
  body.properties.explanation = {
    type: "string",
    minLength: 2,
    maxLength: 600,
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["analysis", "strategy"],
    properties: {
      analysis: { type: "string", minLength: 1, maxLength: 1200 },
      strategy: body,
    },
    $defs,
  };
}

export async function learn({
  language,
  games,
  strategies,
  rounds,
  event,
  guard,
  generate,
  firstTournament,
  initialMemory = [[], []],
}) {
  const generations = [firstTournament],
    decisions = [],
    memory = structuredClone(initialMemory);
  let current = strategies;
  for (let generation = 1; generation <= rounds; generation++) {
    guard();
    const frozen = structuredClone(current),
      next = [...current];
    for (let player = 0; player < 2; player++) {
      guard();
      const actor = `strategist-${player + 1}`,
        prefix = `g${generation}-s${player + 1}`;
      const feedback = lossFeedback(
        language,
        games,
        frozen,
        generations.at(-1).matches,
        player,
      );
      await event(
        "verifier",
        "loss-review",
        `G${generation} · strategist ${player + 1}: ${feedback.lossCount} losses available for analysis.`,
        { generation, player, artifact: `${prefix}-losses.json` },
        { artifact: { name: `${prefix}-losses.json`, content: feedback } },
      );
      const input = {
        language,
        games,
        previousPolicies: frozen[player].policies,
        functionExamples: language.functions.map((f) => ({
          name: f.name,
          samples: [
            [1, 0, 3, 4],
            [1, 2, 3, 4],
            [0, 2, 3, 4],
            [10, 9, 3, 4],
          ].map((values) => {
            const args = values.slice(0, f.params.length);
            try {
              return {
                args,
                result: compileLanguage(language).evaluate([f.name, ...args]),
              };
            } catch (error) {
              return { args, error: error.message };
            }
          }),
        })),
        losses: feedback.losses
          .slice(0, 2)
          .map((m) => ({ ...m, moves: m.moves.slice(-8) })),
        training: feedback.training.map((g) => ({
          ...g,
          examples: g.examples.filter((s) => s.mistake).slice(0, 4),
        })),
        memory: memory[player]
          .slice(-2)
          .map(({ policies, accepted, trainingErrors, error }) => ({
            policies,
            accepted,
            trainingErrors,
            error,
          })),
      };
      let revision;
      try {
        revision = await generate(
          actor,
          `${prefix}-revision`,
          `Analyze your tournament losses and improve your executable strategy. Return exactly {"analysis":string,"strategy":{"name":string,"explanation":string,"policies":[{"game":exactGameName,"score":expression}]}}. Analysis must explain a concrete mistaken move and your correction, or why no improvement is found. Use both game policies. Maximize score(heap,move,after=heap-move,turn); ties take smallest move. Read actual function BODIES. Use ONLY the language's function names, numbers, booleans and variables. No core operators. Look for patterns in host-measured winningMoves; forced losses have no winning moves. Use losingHeapsByTurn to find the repeating period and offset from measured data, NOT a remembered rule. A winning move leaves the opponent a losing heap. Taking the final stone wins only in the normal game. Score candidate AFTER heaps, not the current heap. Normal and last-remover-loses games need different target residues. The turn variable matters only when the legal predicate depends on turn. Compute the value of your expression for two different moves to ensure the preferred move gets the HIGHER score. A score must depend on the candidate move or after, not just heap. Keep expressions short. The host computed feedback, but YOU must author the program. No weight training occurs. Avoid prior rejected programs. INPUT DATA:\n${JSON.stringify(input)}`,
          (value) => {
            if (
              !value ||
              Object.keys(value).sort().join() !== "analysis,strategy" ||
              typeof value.analysis !== "string" ||
              !value.analysis.trim() ||
              value.analysis.length > 1200
            )
              throw new Error(
                "Return a concise analysis and a strategy, with no extra fields.",
              );
            validateStrategy(language, games, value.strategy);
          },
          language,
          undefined,
          revisionSchema(language),
        );
      } catch (error) {
        guard();
        // Invalid proposals do not replace the last known executable program.
        if (!error.message.includes("did not pass validation")) throw error;
        await event(
          actor,
          "retained",
          `G${generation}: invalid proposals; previous strategy retained.`,
          { generation, player },
        );
        memory[player].push({ error: error.message });
        decisions.push({
          generation,
          player,
          accepted: false,
          reason: error.message,
        });
        continue;
      }
      await event(actor, "analysis", revision.analysis, {
        generation,
        player,
        artifact: `${prefix}-revision.json`,
      });
      let evaluation = compareCandidate(
        language,
        games,
        frozen[player],
        revision.strategy,
        frozen,
      );
      let assisted = false;
      if (!evaluation.accepted && evaluation.before.trainingErrors > 0) {
        await event(
          "verifier",
          "evaluated",
          "Unaided proposal did not pass the promotion gate.",
          { generation, player, artifact: `${prefix}-model-check.json` },
          {
            artifact: {
              name: `${prefix}-model-check.json`,
              content: {
                previous: frozen[player],
                candidate: revision.strategy,
                opponents: frozen,
                evaluation,
              },
            },
          },
        );
        const search = searchPolicies(language, games, frozen[player]);
        guard();
        await event(
          "verifier",
          "strategy-search",
          "Program-search tool tested expressions in the generated language using training heaps only. Candidate authorship: host synthesis; selection: local model.",
          { generation, player, artifact: `${prefix}-search.json` },
          {
            artifact: {
              name: `${prefix}-search.json`,
              content: {
                provenance: "host_synthesis",
                trainingHeaps: [1, 32],
                search,
              },
            },
          },
        );
        if (
          search.reduce((n, game) => n + game.candidates[0].trainingErrors, 0) <
          evaluation.before.trainingErrors
        ) {
          const assistedSchema = revisionSchema(language);
          assistedSchema.properties.strategy.properties.policies = {
            type: "array",
            minItems: games.length,
            maxItems: games.length,
            prefixItems: search.map((game) => ({
              type: "object",
              additionalProperties: false,
              required: ["game", "score"],
              properties: {
                game: { const: game.game },
                score: { enum: game.candidates.map((c) => c.score) },
              },
            })),
          };
          try {
            revision = await generate(
              actor,
              `${prefix}-assisted-revision`,
              `Your unaided revision failed measured evaluation. Use the program-search tool results below to select one exact score expression per game, preferring fewer trainingErrors. Return analysis and strategy in the schema. Explain that the TOOL synthesized candidates and you selected them using measured errors; do not claim you invented these expressions. Do not modify the selected expressions. Previous training errors: ${evaluation.before.trainingErrors}. TOOL RESULTS:\n${JSON.stringify(search)}`,
              (value) => {
                if (
                  typeof value.analysis !== "string" ||
                  !value.analysis.trim() ||
                  value.analysis.length > 1200
                )
                  throw new Error("Supply concise analysis.");
                validateStrategy(language, games, value.strategy);
                for (const policy of value.strategy.policies) {
                  if (
                    !search
                      .find((g) => g.game === policy.game)
                      ?.candidates.some(
                        (c) => hash(c.score) === hash(policy.score),
                      )
                  )
                    throw new Error("Select an exact tool candidate.");
                }
              },
              language,
              undefined,
              assistedSchema,
            );
            await event(actor, "analysis", revision.analysis, {
              generation,
              player,
              artifact: `${prefix}-assisted-revision.json`,
              assistance: "host_synthesis",
            });
            evaluation = compareCandidate(
              language,
              games,
              frozen[player],
              revision.strategy,
              frozen,
            );
            assisted = true;
          } catch (error) {
            guard();
            if (!error.message.includes("did not pass validation")) throw error;
            await event(
              actor,
              "rejected",
              "Tool-assisted revision was invalid; retaining the measured unaided proposal for the final gate.",
              { generation, player },
            );
          }
        }
      }
      guard();
      const changes = games.map((g) => ({
        game: g.name,
        before: frozen[player].policies.find((p) => p.game === g.name).score,
        after: revision.strategy.policies.find((p) => p.game === g.name).score,
      }));
      const change = {
        generation,
        player,
        candidateProvenance: assisted
          ? "host_synthesis_selected_by_model"
          : "local_model",
        analysis: revision.analysis,
        changes,
        previous: frozen[player],
        candidate: revision.strategy,
        opponents: frozen,
        evaluation,
      };
      await event(
        actor,
        evaluation.accepted ? "promoted" : "retained",
        `G${generation} · ${evaluation.accepted ? "Candidate promoted" : "Previous strategy retained"}. Control mistakes ${evaluation.before.controlErrors} → ${evaluation.after.controlErrors}; frozen-opponent wins ${evaluation.before.wins} → ${evaluation.after.wins}/${evaluation.matchesPerVersion}.`,
        {
          generation,
          player,
          changes,
          assistance: assisted ? "host_synthesis" : null,
          artifact: `${prefix}-change.json`,
        },
        { artifact: { name: `${prefix}-change.json`, content: change } },
      );
      if (evaluation.accepted) next[player] = revision.strategy;
      const decision = {
        generation,
        player,
        accepted: evaluation.accepted,
        artifact: `${prefix}-change.json`,
        before: evaluation.before,
        after: evaluation.after,
        reason: evaluation.reason,
      };
      decisions.push(decision);
      memory[player].push({
        policies: revision.strategy.policies,
        analysis: revision.analysis,
        accepted: evaluation.accepted,
        trainingErrors: evaluation.after.trainingErrors,
      });
    }
    current = next;
    for (let player = 0; player < 2; player++) {
      const name = `g${generation}-strategy-${player + 1}.json`;
      await event(
        `strategist-${player + 1}`,
        "checkpoint",
        `Generation ${generation} strategy saved.`,
        { generation, artifact: name },
        { artifact: { name, content: current[player] } },
      );
    }
    const result = await tournament({
      language,
      games,
      strategies: current,
      generation,
      event,
      guard,
    });
    generations.push(result);
    await event(
      "referee",
      "generation",
      `Generation ${generation} completed: ${result.scores.join(" : ")}.`,
      { generation, metrics: result.metrics, scores: result.scores },
    );
  }
  return {
    strategies: current,
    decisions,
    generations,
    memory: memory.map((entries) => entries.slice(-2)),
  };
}
