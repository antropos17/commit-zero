// Constrain only the output encoding, never the generated semantics.
const expr = { $ref: "#/$defs/expression" };
const text = { type: "string" };
export function resultType(node) {
  if (!Array.isArray(node))
    return typeof node === "string" ? "number" : typeof node;
  if (["eq", "lt", "lte", "and", "or", "not"].includes(node[0]))
    return "boolean";
  if (["add", "sub", "mul", "mod"].includes(node[0])) return "number";
  if (node[0] === "if" && resultType(node[2]) === resultType(node[3]))
    return resultType(node[2]);
  return "unknown";
}
const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export function outputSchema(name, language, repairCandidates) {
  const operators = language
    ? language.functions.map((f) => [f.name, f.params.length])
    : [
        ["add", 2],
        ["sub", 2],
        ["mul", 2],
        ["mod", 2],
        ["eq", 2],
        ["lt", 2],
        ["lte", 2],
        ["and", 2],
        ["or", 2],
        ["not", 1],
        ["if", 3],
      ];
  const expression = {
    anyOf: [
      { type: "number" },
      { type: "boolean" },
      language
        ? {
            type: "string",
            enum: name.startsWith("game-")
              ? ["heap", "move", "turn"]
              : ["heap", "move", "after", "turn"],
          }
        : { type: "string", pattern: "^[a-z][a-z0-9_]{0,23}$" },
      ...operators.map(([op, arity]) => ({
        type: "array",
        prefixItems: [
          { const: op },
          ...Array.from({ length: arity }, () => expr),
        ],
        minItems: arity + 1,
        maxItems: arity + 1,
      })),
    ],
  };
  const definitions = { expression };
  const callsOfType = (type) => ({
    anyOf: expression.anyOf
      .slice(3)
      .filter(
        (_, i) => !language || resultType(language.functions[i].body) === type,
      ),
  });
  const functionVariants = [1, 2, 3, 4].map((arity) => {
    const params = ["a", "b", "c", "d"].slice(0, arity);
    const ref = { $ref: `#/$defs/body${arity}` };
    definitions[`body${arity}`] = {
      anyOf: [
        { type: "number" },
        { type: "boolean" },
        { type: "string", enum: params },
        ...operators.map(([op, count]) => ({
          type: "array",
          prefixItems: [
            { const: op },
            ...Array.from({ length: count }, () => ref),
          ],
          minItems: count + 1,
          maxItems: count + 1,
        })),
      ],
    };
    return object({
      name: { type: "string", pattern: "^[a-z][a-z0-9_]{1,23}$" },
      params: { const: params },
      body: ref,
    });
  });
  let value;
  if (name === "language")
    value = object({
      name: text,
      description: text,
      functions: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: { anyOf: functionVariants },
      },
    });
  else if (name.startsWith("game-"))
    value = object({
      name: text,
      description: text,
      initial: { type: "integer", minimum: 8, maximum: 32 },
      legal: repairCandidates?.length
        ? { enum: repairCandidates }
        : callsOfType("boolean"),
      loseAtZero: { const: name === "game-2" },
    });
  else
    value = object({
      name: text,
      explanation: text,
      policies: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: object({
          game: text,
          score: callsOfType("number"),
        }),
      },
    });
  return { ...value, $defs: definitions };
}
