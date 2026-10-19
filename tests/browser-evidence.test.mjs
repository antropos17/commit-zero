import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { browserStats } from "../scripts/test-ui.mjs";
import { inside } from "../scripts/project-files.mjs";

test("browser evidence refuses empty, skipped, failed, retried and incomplete reports", () => {
  const stats = { expected: 3, unexpected: 0, skipped: 0, flaky: 0 };
  assert.equal(browserStats({ stats }).complete, true);
  for (const change of [
    { expected: 0 },
    { skipped: 1 },
    { unexpected: 1 },
    { flaky: 1 },
  ])
    assert.equal(
      browserStats({ stats: { ...stats, ...change } }).complete,
      false,
    );
  for (const report of [
    { status: "running" },
    { stats: {} },
    { stats: { ...stats, expected: -1 } },
    { stats: { ...stats, skipped: 0.5 } },
  ])
    assert.throws(() => browserStats(report), /complete numeric/);
});

test("a failed browser source read replaces an earlier green suite receipt", async (t) => {
  const base = resolve(".cache/tmp");
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(resolve(base, "browser-evidence-"));
  t.after(async () => {
    assert.ok(inside(base, fixture) && fixture !== base);
    await rm(fixture, { recursive: true, force: true });
  });
  await mkdir(resolve(fixture, "scripts"));
  for (const name of [
    "test-ui.mjs",
    "browser-runtime.mjs",
    "project-files.mjs",
  ])
    await cp(resolve("scripts", name), resolve(fixture, "scripts", name));
  await mkdir(resolve(fixture, ".cache/verification"), { recursive: true });
  const output = resolve(
    fixture,
    ".cache/verification/latest-browser-suite.json",
  );
  // Explicitly synthetic old receipt; this fixture has no application source.
  await writeFile(
    output,
    JSON.stringify({ status: "passed", fullBrowserSuite: true }),
  );
  const result = spawnSync(
    process.execPath,
    [resolve(fixture, "scripts/test-ui.mjs")],
    { encoding: "utf8", timeout: 10000, windowsHide: true },
  );
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(await readFile(output, "utf8"));
  assert.equal(report.status, "failed");
  assert.equal(report.sourceHash, null);
  assert.equal(report.stable, false);
  assert.deepEqual(report.groups, []);
});
