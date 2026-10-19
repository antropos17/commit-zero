import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  Object.freeze({ name: "history-and-pr", files: Object.freeze([
    "commons-history.spec.mjs", "scenario-pr.spec.mjs",
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
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [
        "node_modules/playwright/cli.js", "test",
        ...group.files.map((name) => `tests/browser/${name}`),
      ], {
        cwd: resolve("."), stdio: "inherit", shell: false,
        env: { ...process.env, CZ_BROWSER_OUTPUT_DIR: `runtime/browser-results/${group.name}` },
      });
      child.once("error", reject);
      child.once("exit", (status, signal) => done(signal ? 1 : (status ?? 1)));
    });
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
