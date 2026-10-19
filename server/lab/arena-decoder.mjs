import { hash } from "./store.mjs";

// Positive JSON Schema only: llama.cpp silently ignores `not`. Integer literals
// give the revision grammar a finite canonical domain; observations stay real.
function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (!node || typeof node !== "object") return node;
  const result = Object.fromEntries(
    Object.entries(node).map(([k, v]) => [
      k === "prefixItems" ? "items" : k,
      normalize(v),
    ]),
  );
  if (result.type === "number" && result.minimum === -100)
    return { enum: Array.from({ length: 201 }, (_, i) => i - 100) };
  return result;
}
const unique = (values) => [
  ...new Map(values.map((v) => [hash(v), v])).values(),
];
const union = (branches) => {
  const kept = branches.filter(Boolean);
  return kept.length === 0
    ? null
    : kept.length === 1
      ? kept[0]
      : { anyOf: kept };
};

export function constrainRevisionSchema(schema, forbidden) {
  const result = normalize(schema);
  const resolve = (node) =>
    node.$ref ? resolve(result.$defs[node.$ref.split("/").at(-1)]) : node;
  const accepts = (schemaNode, value) => {
    const node = resolve(schemaNode);
    if (node.anyOf) return node.anyOf.some((n) => accepts(n, value));
    if (Object.hasOwn(node, "const")) return hash(node.const) === hash(value);
    if (node.enum) return node.enum.some((v) => hash(v) === hash(value));
    if (node.type === "boolean") return typeof value === "boolean";
    if (node.type === "array")
      return (
        Array.isArray(value) &&
        value.length === node.items.length &&
        node.items.every((s, i) => accepts(s, value[i]))
      );
    throw new Error("Unsupported expression schema in decoder exclusion.");
  };
  function subtract(schemaNode, banned) {
    const values = unique(banned.filter((v) => accepts(schemaNode, v)));
    if (!values.length) return schemaNode;
    const node = resolve(schemaNode);
    if (node.anyOf) return union(node.anyOf.map((n) => subtract(n, values)));
    if (Object.hasOwn(node, "const")) return null;
    if (node.enum || node.type === "boolean") {
      const allowed = (node.enum || [true, false]).filter(
        (v) => !values.some((b) => hash(v) === hash(b)),
      );
      return allowed.length ? { enum: allowed } : null;
    }
    // A prefix trie partitions tuples by their first differing child. This
    // subtracts forbidden trees without enumerating or ranking allowed programs.
    const variants = [];
    function walk(index, remaining, prefix) {
      if (index === node.items.length) return;
      const childValues = unique(remaining.map((v) => v[index]));
      const different = subtract(node.items[index], childValues);
      if (different)
        variants.push({
          ...node,
          items: [...prefix, different, ...node.items.slice(index + 1)],
        });
      for (const value of childValues)
        walk(
          index + 1,
          remaining.filter((v) => hash(v[index]) === hash(value)),
          [...prefix, { const: value }],
        );
    }
    walk(0, values, []);
    return union(variants);
  }
  const score = subtract(
    result.properties.strategy.properties.score,
    forbidden,
  );
  if (!score)
    throw new Error("No unused expressions remain in the revision grammar.");
  result.properties.strategy.properties.score = score;
  return result;
}

export function rememberExpression(history, score, source) {
  if (!history.some((item) => hash(item.score) === hash(score)))
    history.push({ score: structuredClone(score), source });
}
