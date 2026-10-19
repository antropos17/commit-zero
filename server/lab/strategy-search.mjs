import { compileLanguage, validateGame } from "./language.mjs";
import { assessPolicy } from "./learning.mjs";
import { resultType } from "./schema.mjs";

// Bounded program enumeration, exposed as a tool rather than model authorship.
// The search sees only training heaps 1..32. No fixed game strategy is injected.
export function searchPolicies(language, games, previous) {
  const machine = compileLanguage(language);
  const numeric = language.functions.filter(
    (f) => resultType(f.body) === "number",
  );
  return games.map((game) => {
    validateGame(language, game);
    const old = previous.policies.find((p) => p.game === game.name).score;
    const target = assessPolicy(language, game, previous).states.filter(
      (s) => s.heap <= 32,
    );
    const samples = target.map((state) => ({
      ...state,
      moves: Array.from(
        { length: Math.min(8, state.heap) },
        (_, i) => i + 1,
      ).filter((move) =>
        machine.evaluate(game.legal, {
          heap: state.heap,
          turn: state.turn,
          move,
        }),
      ),
    }));
    const seen = new Set(),
      best = [];
    let evaluated = 0;
    function consider(score) {
      const key = JSON.stringify(score);
      if (seen.has(key) || evaluated >= 3000) return;
      seen.add(key);
      evaluated++;
      try {
        let errors = 0;
        for (const state of samples) {
          const choices = state.moves.map((move) => ({
            move,
            score: machine.evaluate(score, {
              heap: state.heap,
              move,
              after: state.heap - move,
              turn: state.turn,
            }),
          }));
          if (choices.some((c) => typeof c.score !== "number")) return;
          choices.sort((a, b) => b.score - a.score || a.move - b.move);
          if (
            state.winningMoves.length &&
            !state.winningMoves.includes(choices[0].move)
          )
            errors++;
        }
        best.push({ score, trainingErrors: errors });
        best.sort(
          (a, b) =>
            a.trainingErrors - b.trainingErrors ||
            JSON.stringify(a.score).length - JSON.stringify(b.score).length,
        );
        best.splice(3);
      } catch {
        /* Invalid generated expressions are discarded, never executed outside the DSL. */
      }
    }
    consider(old);
    const inner = [];
    for (const f of numeric) {
      for (const variable of ["after", "move", "heap"])
        for (let constant = -1; constant <= 12; constant++) {
          const args = f.params.map((_, i) => (i === 0 ? variable : constant));
          const node = [f.name, ...args];
          inner.push(node);
          consider(node);
        }
    }
    for (const node of inner)
      for (const f of numeric)
        for (const constant of [-1, 0, 1, 2])
          for (let position = 0; position < f.params.length; position++)
            consider([
              f.name,
              ...f.params.map((_, i) => (i === position ? node : constant)),
            ]);
    return { game: game.name, evaluated, candidates: best };
  });
}
