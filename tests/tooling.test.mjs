import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import { qualityPlan, executePlan } from "../scripts/quality-plan.mjs";
import { assertBrowserCoverage } from "../scripts/test-ui.mjs";
import { localLinks } from "../scripts/repo-check.mjs";
import { localBase, diagnose } from "../scripts/doctor.mjs";
import { inside } from "../scripts/project-files.mjs";
import { resolve } from "node:path";
import { mkdir, mkdtemp, cp, writeFile, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("Verification preserves the full gate, focused scope and fail-fast results", async () => {
  await assertBrowserCoverage();
  const full = qualityPlan("full");
  assert.deepEqual(
    full.map((s) => s.name),
    ["lint", "repository", "tests", "build", "dom", "serving"],
  );
  assert.ok(
    full.find((s) => s.name === "tests").args.includes("tests/*.test.mjs"),
  );
  assert.ok(!qualityPlan("fast").some((s) => s.name === "build"));
  assert.ok(
    qualityPlan("commons").at(-1).args.includes("tests/commons.test.mjs"),
  );
  assert.ok(
    !qualityPlan("commons")
      .at(-1)
      .args.some((file) => file.endsWith(".spec.mjs")),
  );
  assert.throws(() => qualityPlan("typo"), /Unknown suite/);
  const called = [];
  const result = await executePlan(full, async (stage) => {
    called.push(stage.name);
    return stage.name === "repository" ? 2 : 0;
  });
  assert.equal(result.ok, false);
  assert.deepEqual(called, ["lint", "repository"]);
  assert.equal(result.stages[1].code, 2);
  assert.ok(result.stages.every((s) => s.durationMs >= 0));
  const thrown = await executePlan(full, async () => {
    throw new Error("spawn failed");
  });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.stages.length, 1);
});

test("A failed source read replaces an earlier green verification report", async () => {
  const cache = resolve(".cache");
  await mkdir(cache, { recursive: true });
  const fixture = await mkdtemp(resolve(cache, "verification-fixture-"));
  try {
    await mkdir(resolve(fixture, "scripts"));
    for (const name of [
      "verify.mjs",
      "quality-plan.mjs",
      "project-map.mjs",
      "project-files.mjs",
    ])
      await cp(resolve("scripts", name), resolve(fixture, "scripts", name));
    await mkdir(resolve(fixture, ".cache/verification"), { recursive: true });
    const report = resolve(fixture, ".cache/verification/latest-full.json");
    await writeFile(report, JSON.stringify({ status: "passed" }));
    // No source files are installed in this fixture: the initial fingerprint must fail.
    const result = spawnSync(
      process.execPath,
      [resolve(fixture, "scripts/verify.mjs"), "full"],
      { encoding: "utf8", timeout: 10000, windowsHide: true },
    );
    assert.equal(result.status, 1, result.stderr);
    const saved = JSON.parse(await readFile(report, "utf8"));
    assert.equal(saved.status, "failed");
    assert.equal(saved.phase, "fingerprint");
  } finally {
    assert.ok(inside(cache, fixture) && fixture !== cache);
    await rm(fixture, { recursive: true, force: true });
  }
});

test("Documentation links and local diagnostics do not escape the workspace or loopback origin", () => {
  assert.deepEqual(
    localLinks(
      "[A](API.md#section) [B](<a%20b.md>) [web](https://example.com)\n```md\n[fake](absent.md)\n```\n",
    ),
    ["API.md", "a b.md"],
  );
  assert.equal(inside(resolve("."), resolve("docs/API.md")), true);
  assert.equal(inside(resolve("."), resolve("../elsewhere")), false);
  assert.equal(
    localBase("http://127.0.0.1:4173").origin,
    "http://127.0.0.1:4173",
  );
  for (const invalid of [
    "https://example.com",
    "http://127.0.0.1@example.com",
    "http://localhost/path",
    "http://localhost/?token=secret",
  ])
    assert.throws(() => localBase(invalid), /loopback/);
});

test("Lint catches browser/server mixups and hidden UI sections before a build", async () => {
  const eslint = new ESLint();
  const [{ messages }] = await eslint.lintText(
    'import fs from "node:fs"; import {x} from "../../../server/store.mjs"; export const View = () => <details>{process.pid}{fs}{x}</details>;',
    { filePath: "prototype/app/pages/guard-fixture.jsx" },
  );
  assert.ok(messages.some((m) => m.ruleId === "no-restricted-imports"));
  assert.ok(messages.some((m) => m.ruleId === "no-restricted-syntax"));
  assert.ok(
    messages.some((m) => m.ruleId === "no-undef" && /process/.test(m.message)),
  );
  const [valid] = await eslint.lintText(
    "export const View = () => <section>{window.location.hash}</section>;",
    { filePath: "prototype/app/pages/guard-fixture.jsx" },
  );
  assert.deepEqual(valid.messages, []);
});

test("Doctor distinguishes a healthy dependency set from partial health and offline runtime", async () => {
  const probe = async (fetcher, version = "24.11.1") =>
    diagnose({ root: resolve("."), fetcher, version });
  const healthy = await probe(
    async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          services: Object.fromEntries(
            ["workspace", "identity", "ranking"].map((name) => [
              name,
              { status: "ok" },
            ]),
          ),
        }),
      ),
  );
  assert.equal(healthy.checks.find((c) => c.name === "Runtime").status, "ok");
  const partial = await probe(
    async () => new Response(JSON.stringify({ status: "ok", services: {} })),
  );
  assert.equal(partial.ok, false);
  assert.equal(
    partial.checks.find((c) => c.name === "Runtime").status,
    "error",
  );
  const offline = await probe(async () => {
    throw new Error("offline fixture");
  }, "22.0.0");
  assert.equal(
    offline.checks.find((c) => c.name === "Runtime").status,
    "warning",
  );
  assert.equal(offline.checks.find((c) => c.name === "Node").status, "error");
  assert.equal(offline.ok, false);
});

test("Doctor treats an archive inside another checkout as source-only rather than inheriting its Git identity", async (t) => {
  const base = resolve(".cache/tmp");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(resolve(base, "doctor-archive-"));
  t.after(async () => {
    assert(inside(base, root) && root !== base);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(resolve(root, "docs"));
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ dependencies: {}, devDependencies: {} }),
  );
  await writeFile(
    resolve(root, "package-lock.json"),
    JSON.stringify({ packages: {} }),
  );
  await writeFile(
    resolve(root, "docs/CONTEXT.md"),
    "Synthetic source-only archive fixture.\n",
  );
  const result = await diagnose({
    root,
    fetcher: async () => {
      throw new Error("offline fixture");
    },
  });
  const git = result.checks.find((check) => check.name === "Git");
  assert.equal(git.status, "warning");
  assert.match(git.message, /Git metadata unavailable/);
  assert(!git.message.includes("codex/development-foundation"));
});
