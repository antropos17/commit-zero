import { compileLanguage } from "./language.mjs";
import { resultType } from "./schema.mjs";

// Counterexample-guided repair tool: search executable calls in THIS generated
// language. No saved game programs, model responses or winners are substituted.
export function synthesizePredicates(language) {
  const machine = compileLanguage(language),
    results = [],
    signatures = new Set();
  const atoms = ["move", 2, 3, 4, 8, "heap", "turn", 0, 1, -1];
  let budget = 2048;
  function inspect(call) {
    if (--budget < 0) return;
    let choices = false,
      signature = "";
    try {
      for (let heap = 1; heap <= 64; heap++)
        for (let turn = 0; turn < 2; turn++) {
          let count = 0;
          for (let move = 1; move <= Math.min(8, heap); move++) {
            const value = machine.evaluate(call, { heap, move, turn });
            if (typeof value !== "boolean") return;
            signature += value ? "1" : "0";
            if (value) count++;
          }
          if (!count) return;
          choices ||= count > 1;
        }
    } catch {
      return;
    }
    if (choices && !signatures.has(signature)) {
      signatures.add(signature);
      results.push(call);
    }
  }
  function args(f, values = []) {
    if (budget <= 0 || results.length >= 8) return;
    if (values.length === f.params.length) {
      inspect([f.name, ...values]);
      return;
    }
    for (const atom of atoms) args(f, [...values, atom]);
  }
  for (const f of language.functions)
    if (resultType(f.body) === "boolean") args(f);
  return results;
}
