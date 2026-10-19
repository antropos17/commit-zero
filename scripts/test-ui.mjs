import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBrowserTests, verificationDirectory } from "./browser-runtime.mjs";
import { fingerprint } from "./project-files.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

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
  Object.freeze({
    name: "workspace",
    files: Object.freeze(["workspace.spec.mjs"]),
  }),
  Object.freeze({
    name: "account-recovery",
    files: Object.freeze(["account-recovery.spec.mjs"]),
  }),
  Object.freeze({
    name: "scenario-keyboard",
    files: Object.freeze(["scenario-keyboard.spec.mjs"]),
  }),
  Object.freeze({
    name: "history-and-pr",
    files: Object.freeze([
      "commons-history.spec.mjs",
      "scenario-pr.spec.mjs",
      "workspace-recovery.spec.mjs",
      "service-health.spec.mjs",
    ]),
  }),
]);

export async function assertBrowserCoverage() {
  const actual = (await readdir(resolve(projectRoot, "tests/browser")))
    .filter((name) => name.endsWith(".spec.mjs"))
    .sort();
  const grouped = browserGroups.flatMap((group) => group.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(grouped))
    throw new Error(
      "Every browser spec must appear exactly once in scripts/test-ui.mjs.",
    );
}

export function browserStats(report) {
  const stats = report?.stats;
  if (
    !stats ||
    ["expected", "unexpected", "skipped", "flaky"].some(
      (key) => !Number.isSafeInteger(stats[key]) || stats[key] < 0,
    )
  )
    throw new Error(
      "Playwright did not produce a complete numeric test report.",
    );
  const { expected, unexpected, skipped, flaky } = stats;
  return {
    expected,
    unexpected,
    skipped,
    flaky,
    complete: expected > 0 && unexpected === 0 && skipped === 0 && flaky === 0,
  };
}

async function run() {
  const directory = await verificationDirectory();
  const output = resolve(directory, "latest-browser-suite.json");
  const report = {
    status: "running",
    fullBrowserSuite: true,
    startedAt: new Date().toISOString(),
    sourceHash: null,
    finalSourceHash: null,
    stable: false,
    groups: [],
    scope:
      "Full configured Chrome/Chromium journey groups with no skipped or retried tests. Separate from npm run check; no model inference or sandbox qualification.",
    environment: {
      node: process.version,
      platform: process.platform,
      configuredExecutable:
        process.env.CZ_BROWSER_EXECUTABLE || "playwright-default",
    },
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  try {
    report.sourceHash = await fingerprint(projectRoot);
    await assertBrowserCoverage();
    for (const group of browserGroups) {
      console.log(`\nBrowser group: ${group.name} (fresh disposable services)`);
      const reportFile = resolve(directory, `browser-${group.name}.json`);
      await writeFile(reportFile, JSON.stringify({ status: "running" }) + "\n");
      const exitCode = await runBrowserTests(
        group.files.map((name) => `tests/browser/${name}`),
        `runtime/browser-results/${group.name}`,
        reportFile,
      );
      const outcome = {
        name: group.name,
        files: group.files,
        exitCode,
        complete: false,
      };
      report.groups.push(outcome);
      Object.assign(
        outcome,
        browserStats(JSON.parse(await readFile(reportFile, "utf8"))),
      );
      if (exitCode !== 0 || !outcome.complete)
        throw new Error(
          `Browser group ${group.name} did not complete all selected tests without failures, skips or retries.`,
        );
    }
    report.finalSourceHash = await fingerprint(projectRoot);
    report.stable = report.sourceHash === report.finalSourceHash;
    report.status = report.stable ? "passed" : "failed";
    if (!report.stable)
      report.error =
        "Source changed during browser verification. Freeze source and rerun.";
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    try {
      report.finalSourceHash = await fingerprint(projectRoot);
    } catch {
      report.finalSourceHash = null;
    }
    report.stable = Boolean(
      report.sourceHash && report.sourceHash === report.finalSourceHash,
    );
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `${report.status === "passed" ? "PASS" : "FAIL"} browser suite - ${output}`,
  );
  if (report.error) console.error(report.error);
  if (report.status !== "passed") process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
