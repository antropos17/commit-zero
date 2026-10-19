import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBrowserTests } from "./browser-runtime.mjs";

// Each group gets a fresh disposable service cluster. The ordinary 180/minute
// API limiter remains active; no test-only bypass or reset endpoint is used.
export const browserGroups = Object.freeze([
  Object.freeze({
    name: "commons",
    files: Object.freeze([
      "agent-catalog.spec.mjs",
      "commons-first-run.spec.mjs",
      "commons-project-recovery.spec.mjs",
      "commons-provider.spec.mjs",
    ]),
  }),
  Object.freeze({ name: "workspace", files: Object.freeze(["workspace.spec.mjs"]) }),
  Object.freeze({ name: "account-recovery", files: Object.freeze(["account-recovery.spec.mjs"]) }),
  Object.freeze({ name: "history-and-pr", files: Object.freeze([
    "commons-history.spec.mjs", "scenario-pr.spec.mjs", "workspace-recovery.spec.mjs",
  ]) }),
]);

export async function assertBrowserCoverage() {
  const actual = (await readdir(resolve("tests/browser")))
    .filter((name) => name.endsWith(".spec.mjs")).sort();
  const grouped = browserGroups.flatMap((group) => group.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(grouped))
    throw new Error("Every browser spec must appear exactly once in scripts/test-ui.mjs.");
}

async function run() {
  await assertBrowserCoverage();
  for (const group of browserGroups) {
    console.log(`\nBrowser group: ${group.name} (fresh disposable services)`);
    const code = await runBrowserTests(
      group.files.map((name) => `tests/browser/${name}`),
      `runtime/browser-results/${group.name}`,
    );
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
