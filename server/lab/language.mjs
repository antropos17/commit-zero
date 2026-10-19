// A deliberately finite host calculus. Model output is data, never JavaScript.
const core = new Map([
  ["add", [2, (a, b) => a + b]],
  ["sub", [2, (a, b) => a - b]],
  ["mul", [2, (a, b) => a * b]],
  ["mod", [2, (a, b) => (b === 0 ? 0 : a % b)]],
  ["eq", [2, (a, b) => a === b]],
  ["lt", [2, (a, b) => a < b]],
  ["lte", [2, (a, b) => a <= b]],
  ["and", [2, (a, b) => Boolean(a && b)]],
  ["or", [2, (a, b) => Boolean(a || b)]],
  ["not", [1, (a) => !a]],
  ["if", [3, (a, b, c) => (a ? b : c)]],
]);
const identifier = /^[a-z][a-z0-9_]{1,23}$/;
function insist(ok, message) {
  if (!ok) throw new Error(message);
}
export function fields(value, keys) {
  insist(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected an object.",
  );
  insist(
    Object.keys(value).every((k) => keys.includes(k)) &&
      keys.every((k) => Object.hasOwn(value, k)),
    `Expected fields: ${keys.join(", ")}.`,
  );
}
function text(value, max = 300) {
  insist(
    typeof value === "string" &&
      value.trim().length >= 2 &&
      value.length <= max,
    "Invalid text length.",
  );
}
export function compileLanguage(language) {
  fields(language, ["name", "description", "functions"]);
  text(language.name, 48);
  text(language.description);
  insist(
    Array.isArray(language.functions) &&
      language.functions.length >= 3 &&
      language.functions.length <= 8,
    "Define 3–8 functions.",
  );
  const functions = new Map();
  for (const f of language.functions) {
    fields(f, ["name", "params", "body"]);
    insist(
      identifier.test(f.name) && !core.has(f.name) && !functions.has(f.name),
      "Function names must be unique lowercase identifiers, distinct from core operations.",
    );
    insist(
      Array.isArray(f.params) &&
        f.params.length >= 1 &&
        f.params.length <= 4 &&
        f.params.every(
          (p) => typeof p === "string" && /^[a-z][a-z0-9_]{0,23}$/.test(p),
        ) &&
        new Set(f.params).size === f.params.length,
      "Use 1–4 distinct lowercase parameter identifiers; no uppercase letters.",
    );
    functions.set(f.name, f);
  }
  function inspect(node, variables, internal, depth = 0) {
    insist(depth <= 16, "Expression exceeds depth 16.");
    if (typeof node === "number") {
      insist(
        Number.isFinite(node) && Math.abs(node) <= 100000,
        "Numeric literal out of range.",
      );
      return;
    }
    if (typeof node === "boolean") return;
    if (typeof node === "string") {
      insist(variables.includes(node), `Unknown variable ${node}.`);
      return;
    }
    insist(
      Array.isArray(node) &&
        node.length >= 2 &&
        node.length <= 5 &&
        typeof node[0] === "string",
      "An expression is a value, variable or [operator, ...arguments].",
    );
    const arity = internal
      ? core.get(node[0])?.[0]
      : functions.get(node[0])?.params.length;
    insist(
      arity !== undefined && arity === node.length - 1,
      `Unknown operator or wrong arity: ${node[0]}.`,
    );
    for (const child of node.slice(1))
      inspect(child, variables, internal, depth + 1);
  }
  for (const f of functions.values()) inspect(f.body, f.params, true);
  insist(
    language.functions.some(
      (f) => Array.isArray(f.body) && f.body.slice(1).some(Array.isArray),
    ),
    "Include at least one composed abstraction, not only renamed primitives.",
  );
  function run(
    node,
    variables = {},
    internal = false,
    fuel = { left: 2048 },
    depth = 0,
  ) {
    insist(--fuel.left >= 0 && depth <= 32, "Execution budget exceeded.");
    if (typeof node === "number" || typeof node === "boolean") return node;
    if (typeof node === "string") return variables[node];
    const args = node
      .slice(1)
      .map((n) => run(n, variables, internal, fuel, depth + 1));
    let result;
    if (internal) {
      // Type checks prevent JavaScript coercion from defining accidental semantics.
      if (["add", "sub", "mul", "mod", "lt", "lte"].includes(node[0]))
        insist(
          args.every((a) => typeof a === "number"),
          "Arithmetic requires numeric arguments.",
        );
      result = core.get(node[0])[1](...args);
    } else {
      const f = functions.get(node[0]);
      result = run(
        f.body,
        Object.fromEntries(f.params.map((p, i) => [p, args[i]])),
        true,
        fuel,
        depth + 1,
      );
    }
    insist(
      typeof result === "boolean" ||
        (typeof result === "number" &&
          Number.isFinite(result) &&
          Math.abs(result) <= 1e9),
      "Invalid expression result.",
    );
    return result;
  }
  return {
    evaluate(expression, variables = {}) {
      inspect(expression, Object.keys(variables), false);
      return run(expression, variables);
    },
    inspect,
  };
}
export function validateGame(language, game) {
  fields(game, ["name", "description", "initial", "legal", "loseAtZero"]);
  text(game.name, 48);
  text(game.description);
  insist(
    Array.isArray(game.legal),
    "Legal moves must call a function in the generated language.",
  );
  const machine = compileLanguage(language),
    initial = machine.evaluate(game.initial),
    loses = machine.evaluate(game.loseAtZero);
  insist(
    Number.isInteger(initial) && initial >= 8 && initial <= 32,
    "Initial heap must be an integer from 8 through 32.",
  );
  insist(typeof loses === "boolean", "loseAtZero must evaluate to boolean.");
  // Exhaustive conformance for the finite game domain, not an LLM assertion.
  let distinct = false;
  for (let heap = 1; heap <= 64; heap++)
    for (let turn = 0; turn <= 1; turn++) {
      let count = 0;
      for (let move = 1; move <= Math.min(8, heap); move++) {
        const value = machine.evaluate(game.legal, { heap, move, turn });
        insist(
          typeof value === "boolean",
          "Legal-move predicate must return boolean.",
        );
        if (value) count++;
      }
      insist(
        count > 0,
        `Game deadlocks at heap ${heap}, turn ${turn}: every move from 1 to ${Math.min(8, heap)} makes ${JSON.stringify(game.legal)} false. Heap can exceed 8 but move cannot; check argument order and bounds in the actual function body. The game must permit moves for all heaps 1..64.`,
      );
      distinct ||= count > 1;
    }
  insist(distinct, "Game must offer choices.");
  return { initial, loses };
}
export function validateStrategy(language, games, strategy) {
  fields(strategy, ["name", "explanation", "policies"]);
  text(strategy.name, 48);
  text(strategy.explanation, 600);
  insist(
    Array.isArray(strategy.policies) &&
      strategy.policies.length === games.length,
    "Supply one policy for each game.",
  );
  const machine = compileLanguage(language);
  for (const game of games) {
    const matches = strategy.policies.filter((p) => p.game === game.name);
    insist(
      matches.length === 1,
      `Missing or duplicated policy for ${game.name}.`,
    );
    fields(matches[0], ["game", "score"]);
    insist(
      Array.isArray(matches[0].score),
      "Policy scores must call a function in the generated language.",
    );
    for (let heap = 1; heap <= 64; heap++)
      for (let move = 1; move <= Math.min(8, heap); move++)
        for (let turn = 0; turn <= 1; turn++)
          insist(
            typeof machine.evaluate(matches[0].score, {
              heap,
              move,
              after: heap - move,
              turn,
            }) === "number",
            "Policy score must be numeric.",
          );
  }
}
export function playMatch(language, game, strategies, opening, first = 0) {
  const machine = compileLanguage(language),
    { loses } = validateGame(language, game);
  let heap = opening,
    turn = 0;
  const moves = [];
  insist(
    Number.isInteger(opening) && opening >= 1 && opening <= 64,
    "Invalid opening.",
  );
  while (heap > 0 && moves.length < 64) {
    const player = (first + turn) % 2,
      policy = strategies[player].policies.find((p) => p.game === game.name);
    const legal = [];
    for (let move = 1; move <= Math.min(heap, 8); move++)
      if (machine.evaluate(game.legal, { heap, move, turn: turn % 2 }))
        legal.push({
          move,
          score: machine.evaluate(policy.score, {
            heap,
            move,
            after: heap - move,
            turn: turn % 2,
          }),
        });
    insist(legal.length > 0, "No legal move.");
    legal.sort((a, b) => b.score - a.score || a.move - b.move);
    const move = legal[0].move;
    moves.push({
      player,
      before: heap,
      move,
      after: heap - move,
      score: legal[0].score,
    });
    heap -= move;
    if (heap === 0)
      return { opening, first, winner: loses ? 1 - player : player, moves };
    turn++;
  }
  throw new Error("Match failed to terminate.");
}
export const languageContract = `Invent a small named language represented by JSON expression arrays. Return exactly {"name":string,"description":string,"functions":[{"name":string,"params":[string],"body":expression}]}. Define 3–8 functions with 1–4 arguments; prefer four small useful functions. A heap is ONE INTEGER counting stones, never a list or collection. There are no lists, indexing, map, reduce or strings as data. Choose 1–4 parameters using the canonical positional names a,b,c,d in order: one parameter is ["a"], two are ["a","b"], and so on. Bodies may reference only the parameters you declare. Function names use lowercase letters and underscores. Function names are not core names. Expressions are JSON arrays, NEVER code strings: for example ["add","x",1] is an expression encoding, while "add(x,1)" is invalid. At least one body must compose multiple core operations. Bodies use ONLY core operators: add/sub/mul/mod/eq/lt/lte/and/or (2 arguments), not (1), if (3). A body is a number, boolean, parameter name string, or [coreOperator,...expressions]. There is NO JavaScript, recursion, function-to-function calls, strings as data, or IO. mod(a,0)=0. Arithmetic is numeric; if is eager. Design useful abstractions for heap-removal games: bounds, remainder tests, scoring choices. Client programs can use ONLY your named functions, nested calls, numbers, booleans and their input variables. Include a boolean bounds predicate that can accept move 1 and multiple larger moves, a numeric remainder function, and a numeric conditional score function. Ensure their bodies match their names. Do not include any fields beyond the schema.`;
export const gameContract = `Write a game in the supplied language. Read function BODIES to determine their actual semantics; names may be misleading. Choose arguments that make legal true for at least move 1 at every heap. Return exactly {"name":string,"description":string,"initial":expression,"legal":expression,"loseAtZero":expression}. The host supplies a single heap. Each player removes move=1..min(8,heap). Your legal expression receives heap,move,turn (turn=0 or 1), returns boolean, and must permit at least one move for EVERY heap 1..64 on both turns. Permit several choices. initial has no variables and evaluates to integer 8..32. loseAtZero has no variables and returns boolean: false means last remover wins; true means last remover loses. Client expressions use ONLY supplied language function names, numbers, booleans and permitted variables; never core names. No extra fields.`;
