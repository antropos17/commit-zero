import { areas } from "./project-map.mjs";

const node = (name, ...args) => ({ name, command: process.execPath, args });
const lint = node(
  "lint",
  "node_modules/eslint/bin/eslint.js",
  "server",
  "services",
  "shared",
  "scripts",
  "tests",
  "prototype/app",
  "prototype/social-state.mjs",
  "eslint.config.mjs",
  "vite.config.mjs",
  "playwright.config.mjs",
  "--cache",
  "--cache-location",
  ".cache/eslint",
  "--cache-strategy",
  "content",
);
const structure = node("repository", "scripts/repo-check.mjs");
const test = (name, files) =>
  node(name, "--test", "--test-concurrency=1", ...files);
const ui = [
  node("build", "scripts/build.mjs"),
  test("dom", ["tests/interface.dom.mjs"]),
  node("serving", "scripts/smoke-build.mjs"),
];

export function qualityPlan(mode) {
  if (mode === "lint") return [lint];
  if (mode === "full")
    return [
      lint,
      structure,
      test("tests", ["prototype/social-state.test.mjs", "tests/*.test.mjs"]),
      ...ui,
    ];
  if (mode === "fast")
    return [
      lint,
      structure,
      test("pure tests", [
        "prototype/social-state.test.mjs",
        "tests/arena-decoder.test.mjs",
        "tests/tooling.test.mjs",
      ]),
    ];
  if (mode === "ui") return [lint, structure, ...ui];
  if (Object.hasOwn(areas, mode))
    return [lint, structure, test(mode, areas[mode].tests)];
  throw new Error(
    `Unknown suite: ${mode}. Choose full, fast, lint, ${Object.keys(areas).join(", ")}.`,
  );
}

// Use argv with shell:false; command text and filenames never become shell code.
export async function executePlan(plan, execute) {
  const stages = [];
  for (const stage of plan) {
    const start = performance.now();
    let code;
    try {
      code = await execute(stage);
    } catch {
      code = 1;
    }
    stages.push({
      name: stage.name,
      code,
      durationMs: Math.round(performance.now() - start),
    });
    if (code !== 0) break;
  }
  return {
    ok: stages.length === plan.length && stages.every((s) => s.code === 0),
    stages,
  };
}
