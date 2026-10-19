import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { arenaStrategySchema } from "../server/lab/arena-engine.mjs";
import { constrainRevisionSchema } from "../server/lab/arena-decoder.mjs";

// Independent Draft-07 validator already pinned by the project's ESLint toolchain.
const Ajv = createRequire(import.meta.resolve("eslint"))("ajv");
const language = {
  functions: [
    { name: "sum", params: ["a", "b"], body: ["add", "a", "b"] },
    { name: "diff", params: ["a", "b"], body: ["sub", "a", "b"] },
  ],
};
const policy = arenaStrategySchema(language);
const base = {
  type: "object",
  properties: {
    strategy: {
      type: "object",
      properties: policy.properties,
      required: policy.required,
      additionalProperties: false,
    },
  },
  required: ["strategy"],
  additionalProperties: false,
  $defs: policy.$defs,
};
const value = (score) => ({
  strategy: {
    name: "Fixture",
    explanation: "Fixture only",
    score,
    temperature: 1,
  },
});

test("Generation grammar subtracts exact nested programs without excluding unrelated compositions", () => {
  const forbidden = [
    ["sum", "pay0", 0],
    ["sum", "pay0", 1],
    ["diff", ["sum", "energy", -2], "cost"],
  ];
  const schema = constrainRevisionSchema(base, forbidden);
  const validate = new Ajv().compile(schema);
  for (const expr of forbidden) assert.equal(validate(value(expr)), false);
  for (const op of ["sum", "diff"])
    for (const a of ["pay0", "energy", -2, 0, 1])
      for (const b of ["cost", "pay0", -2, 0, 1]) {
        const expr = [op, a, b];
        assert.equal(
          validate(value(expr)),
          !forbidden.some((f) => JSON.stringify(f) === JSON.stringify(expr)),
          JSON.stringify(expr),
        );
      }
  assert.equal(validate(value(["diff", ["sum", "energy", -1], "cost"])), true);
  assert.equal(validate(value(["diff", ["sum", "energy", -2], "pay0"])), true);
  assert.equal(validate(value(["sum", "pay0", 0.5])), false);
  assert.equal(validate(value(["sum", "pay0", 101])), false);
  assert.equal(
    validate(value(["sum", "pay0", ["sum", "energy", ["sum", 1, 2]]])),
    false,
  );
  assert.deepEqual(constrainRevisionSchema(base, forbidden), schema);
  assert.ok(!JSON.stringify(schema).includes('"not":'));
});
