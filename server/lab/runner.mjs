import {
  compileLanguage,
  validateGame,
  validateStrategy,
  languageContract,
  gameContract,
} from "./language.mjs";
import { hash } from "./store.mjs";
import { outputSchema, resultType } from "./schema.mjs";
import { learn, tournament } from "./learning.mjs";
import { synthesizePredicates } from "./synthesis.mjs";
export async function runExperiment(store, model, id, signal, options = {}) {
  const callerSignal = signal;
  signal = AbortSignal.any([signal, AbortSignal.timeout(20 * 60000)]);
  let calls = 0;
  const started = Date.now(),
    usage = { prompt: 0, completion: 0 };
  const event = (actor, kind, message, data = {}, options = {}) =>
    store.event(id, actor, kind, message, data, options);
  const guard = () => {
    signal.throwIfAborted();
    if (Date.now() - started > 20 * 60000)
      throw new Error("Experiment exceeded its 20-minute wall-clock budget.");
  };
  async function generate(
    actor,
    name,
    prompt,
    validate,
    language,
    repairCandidates,
    customSchema,
  ) {
    let feedback = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      guard();
      if (++calls > 51) throw new Error("Inference call budget exhausted.");
      await event(
        actor,
        "inference",
        `Generating ${name} · attempt ${attempt}.`,
        { model: model.name, attempt },
      );
      const assisted = attempt > 1 && repairCandidates?.length;
      if (assisted && attempt === 2)
        await event(
          "verifier",
          "synthesis",
          "Repair tool enumerated executable predicates in the generated language; the game author selects a candidate.",
          {
            artifact: `${name}-repair-candidates.json`,
            candidates: repairCandidates.length,
          },
          {
            artifact: {
              name: `${name}-repair-candidates.json`,
              content: {
                provenance: "host_synthesis",
                candidates: repairCandidates,
              },
            },
          },
        );
      const input =
        prompt +
        feedback +
        (assisted
          ? `\nThe repair tool found these valid legal predicates by actual exhaustive execution. Choose one verbatim for legal: ${JSON.stringify(repairCandidates)}`
          : "");
      const seed =
        (Number.parseInt(id.replaceAll("-", "").slice(0, 7), 16) +
          calls * 137) %
        2147483647;
      const schema =
        customSchema ||
        outputSchema(name, language, assisted ? repairCandidates : undefined);
      const output = await model.generate(input, signal, seed, schema);
      guard();
      usage.prompt += output.usage.prompt_tokens || 0;
      usage.completion += output.usage.completion_tokens || 0;
      const transcript = {
        actor,
        prompt: input,
        seed,
        schema,
        ...output,
        provenance: model.provenance,
      };
      const transcriptName = `${name}-attempt-${attempt}.json`;
      await event(
        actor,
        "response",
        `Model response saved for ${name}.`,
        {
          artifact: transcriptName,
          tokens: output.usage,
          elapsedMs: output.elapsedMs,
        },
        { artifact: { name: transcriptName, content: transcript } },
      );
      try {
        if (output.finishReason === "length")
          throw new Error(
            "Output was truncated. Use a shorter complete JSON object.",
          );
        const value = JSON.parse(output.text);
        validate(value);
        await event(
          "verifier",
          "accepted",
          `${name} passed executable validation.`,
          { artifact: `${name}.json`, sha256: hash(value) },
          { artifact: { name: `${name}.json`, content: value } },
        );
        return value;
      } catch (error) {
        await event(
          "verifier",
          "rejected",
          `${name} failed validation: ${error.message}`,
          { attempt },
        );
        feedback = `\nPrevious output (invalid data): ${output.text}\nCORRECTION REQUIRED: ${error.message}\nReturn a corrected complete object fixing this error. Do not repeat the invalid expression. Keep it concise.`;
      }
    }
    throw new Error(
      `${name} did not pass validation after three actual model attempts.`,
    );
  }
  try {
    await event(
      "runner",
      "started",
      "Local experiment started. Five roles share one model with separate prompts.",
      {
        model: model.name,
        provenance: model.provenance,
        maxCalls: 51,
        maxMinutes: 20,
      },
    );
    const source = options.source;
    const copy = async (name) => {
      const value = (await store.artifact(source.id, name)).content;
      return value;
    };
    const retain = async (name, content) =>
      event(
        "runner",
        "inherited",
        `Inherited ${name} from completed parent run.`,
        { artifact: name, sourceRunId: source.id },
        { artifact: { name, content } },
      );
    if (source)
      await event(
        "runner",
        "lineage",
        "Continuing saved strategies; parent history is immutable.",
        { artifact: "lineage.json" },
        {
          artifact: {
            name: "lineage.json",
            content: {
              sourceRunId: source.id,
              sourceVersion: source.version,
              sourceHash: hash(JSON.parse(JSON.stringify(source))),
              sourceHashEncoding: "json-iso-dates-v1",
              rounds: options.learningRounds,
            },
          },
        },
      );
    const language = source
      ? await copy("language.json")
      : await generate(
          "language-author",
          "language",
          languageContract,
          (value) => {
            compileLanguage(value);
            for (const type of ["boolean", "number"]) {
              if (!value.functions.some((f) => resultType(f.body) === type))
                throw new Error(
                  `Language must include a function with a definite ${type} result for numeric inputs.`,
                );
            }
          },
        );
    if (source) await retain("language.json", language);
    const machine = compileLanguage(language);
    const examples = language.functions.map((f) => ({
      function: f.name,
      calls: [-1, 0, 1, 2, 4, 8].map((x) => {
        const args = f.params.map((_, i) => (i === 0 ? x : 3));
        try {
          return { args, result: machine.evaluate([f.name, ...args]) };
        } catch (error) {
          return { args, error: error.message };
        }
      }),
    }));
    const context = `\nLANGUAGE DATA:\n${JSON.stringify(language)}\nHOST-MEASURED FUNCTION EXAMPLES (actual execution, not suggestions):\n${JSON.stringify(examples)}`;
    const games = [];
    const repairCandidates = synthesizePredicates(language);
    for (let i = 0; i < 2; i++)
      games.push(
        source
          ? await copy(`game-${i + 1}.json`)
          : await generate(
              `game-author-${i + 1}`,
              `game-${i + 1}`,
              gameContract +
                context +
                `\nGame ${i + 1}: ${i === 0 ? "last remover wins" : "last remover loses"}. Choose a distinct name and interesting bounded legal moves.`,
              (game) => {
                const validated = validateGame(language, game);
                if (validated.loses !== (i === 1))
                  throw new Error(`loseAtZero must evaluate to ${i === 1}.`);
                if (games.some((g) => g.name === game.name))
                  throw new Error("Choose a different game name.");
              },
              language,
              repairCandidates,
            ),
      );
    if (source)
      for (let i = 0; i < games.length; i++)
        await retain(`game-${i + 1}.json`, games[i]);
    const strategyPrompt =
      `Design a strong strategy for BOTH games using ONLY the supplied language. Return exactly {"name":string,"explanation":string,"policies":[{"game":exactGameName,"score":expression}]}. A score expression receives heap,move,after=heap-move,turn (0 or 1). Evaluate every legal move and maximize numeric score. Ties choose the smallest move. Client operators must be language function names, never core names. Numeric constants and variables are permitted. Think about winning heap residues and last-move rules. Include exactly one policy for each game. No code strings or extra fields.` +
      context +
      `\nGAME DATA:\n${JSON.stringify(games)}`;
    const strategies = [];
    for (let i = 0; i < 2; i++)
      strategies.push(
        source
          ? await copy(
              `${source.summary.generations?.length > 1 ? `g${source.summary.generations.length - 1}-` : ""}strategy-${i + 1}.json`,
            )
          : await generate(
              `strategist-${i + 1}`,
              `strategy-${i + 1}`,
              strategyPrompt +
                `\nIndependent role ${i + 1}. ${i === 0 ? "Favor exact endgame planning." : "Seek robust tactical residue patterns."}`,
              (s) => validateStrategy(language, games, s),
              language,
            ),
      );
    if (source)
      for (let i = 0; i < strategies.length; i++)
        await retain(`strategy-${i + 1}.json`, strategies[i]);
    const firstTournament = await tournament({
      language,
      games,
      strategies,
      generation: 0,
      event,
      guard,
    });
    await event(
      "referee",
      "generation",
      "Baseline tournament completed; preparing loss reviews.",
      {
        generation: 0,
        scores: firstTournament.scores,
        metrics: firstTournament.metrics,
      },
    );
    const learning = await learn({
      language,
      games,
      strategies,
      rounds: options.learningRounds ?? 2,
      event,
      guard,
      generate,
      firstTournament,
      initialMemory: source?.artifacts.some(
        (a) => a.name === "learning-memory.json",
      )
        ? await copy("learning-memory.json")
        : [[], []],
    });
    await event(
      "runner",
      "memory",
      "Saved strategy feedback for the next learning cycle.",
      { artifact: "learning-memory.json" },
      { artifact: { name: "learning-memory.json", content: learning.memory } },
    );
    const final = learning.generations.at(-1);
    const summary = {
      scores: final.scores,
      strategies: learning.strategies.map((s) => s.name),
      games: games.map((g) => g.name),
      matches: final.results.length,
      totalTournamentMatches: learning.generations.length * 64,
      sourceRunId: source?.id || null,
      learningRounds: options.learningRounds ?? 2,
      learningBoundary:
        "Programs adapt to measured feedback; model weights are unchanged. Control heaps are reused across generations, not an independent benchmark.",
      decisions: learning.decisions,
      generations: learning.generations.map((g) => ({
        generation: g.generation,
        scores: g.scores,
        results: g.results,
        metrics: g.metrics,
        strategyHashes: g.strategyHashes,
      })),
      calls,
      usage,
      elapsedMs: Date.now() - started,
      identicalPolicies:
        hash(learning.strategies[0].policies) ===
        hash(learning.strategies[1].policies),
      results: final.results,
    };
    await event(
      "runner",
      "completed",
      "Experiment completed. Scores come from executed matches, not model judgments.",
      summary,
      {
        status: "completed",
        summary,
        artifact: { name: "tournament.json", content: summary },
      },
    );
  } catch (error) {
    const cancelled = callerSignal.aborted;
    await event(
      "runner",
      cancelled ? "cancelled" : "failed",
      cancelled
        ? "Experiment stopped. Generated artifacts and completed matches are retained."
        : error.message,
      { calls, usage },
      {
        status: cancelled ? "cancelled" : "failed",
        summary: { calls, usage, elapsedMs: Date.now() - started },
      },
    );
  }
}
