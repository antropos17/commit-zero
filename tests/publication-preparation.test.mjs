import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  realpath,
  rm,
  unlink,
  symlink,
  chmod,
} from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import {
  preparePublication,
  parsePreparationArgs,
} from "../scripts/prepare-publication.mjs";
import {
  fingerprint,
  rootFiles,
  sourceRoots,
  inside,
  sourceIndexVersion,
  gitEnvironment,
} from "../scripts/project-files.mjs";
import { qualityPlan } from "../scripts/quality-plan.mjs";
import { browserGroups } from "../scripts/test-ui.mjs";

const temporary = resolve(".cache/tmp");
function git(root, ...args) {
  return execFileSync(
    "git",
    [
      "-c",
      "core.excludesFile=",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.hooksPath=.cache/empty-hooks",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "user.name=Publication Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-C",
      root,
      ...args,
    ],
    {
      env: gitEnvironment(),
      encoding: "utf8",
      timeout: 8000,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}
async function receipts(root) {
  // Synthetic contract stamps for this disposable Git fixture only. Not actual
  // application gates, never exported to the real project's verification folder.
  const sourceHash = await fingerprint(root);
  const stamp = {
    fixtureOnly: true,
    status: "passed",
    sourceIndexVersion,
    sourceHash,
    finalSourceHash: sourceHash,
    stable: true,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:01:00.000Z",
  };
  const directory = join(root, ".cache/verification");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "latest-full.json"),
    JSON.stringify({
      ...stamp,
      mode: "full",
      fullGate: true,
      stages: qualityPlan("full").map(({ name }) => ({ name, code: 0 })),
    }),
  );
  await writeFile(
    join(directory, "latest-browser-suite.json"),
    JSON.stringify({
      ...stamp,
      fullBrowserSuite: true,
      groups: browserGroups.map(({ name, files }) => ({
        name,
        files,
        exitCode: 0,
        complete: true,
        expected: 1,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
      })),
    }),
  );
}
async function fixture(t, { publicName = "publication" } = {}) {
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(join(temporary, "publication-test-"));
  const publication = join(root, ".cache", publicName);
  t.after(async () => {
    const target = await realpath(root),
      base = await realpath(temporary);
    assert(
      inside(base, target) &&
        target !== base &&
        basename(target).startsWith("publication-test-"),
    );
    await rm(target, { recursive: true, force: true });
  });
  const files = new Map(
    rootFiles.map((path) => [path, `Synthetic source fixture ${path}\n`]),
  );
  files.set(
    ".gitignore",
    ".cache/\nruntime/\nnode_modules/\ndist/\n.env\nextra\n",
  );
  files.set(".gitattributes", "* text=auto eol=lf\n*.bin binary\n");
  files.set("scripts/plain.txt", "Original fixture text\n");
  files.set("scripts/deleted.txt", "Synthetic removal fixture\n");
  files.set("docs/image.bin", Buffer.from([0, 1, 255]));
  for (const [directory, message] of [
    [root, "Independent local fixture history"],
    [publication, "Independent public fixture history"],
  ]) {
    await mkdir(directory, { recursive: true });
    for (const path of [...sourceRoots, "docs"])
      await mkdir(join(directory, path), { recursive: true });
    for (const [path, bytes] of files) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), bytes);
    }
    git(directory, "init", "-b", "main");
    git(directory, "add", ".");
    git(directory, "commit", "-m", message);
  }
  const baseLocal = git(root, "rev-parse", "HEAD"),
    expectedPublic = git(publication, "rev-parse", "HEAD");
  assert.notEqual(baseLocal, expectedPublic);
  assert.equal(
    git(root, "rev-parse", "HEAD^{tree}"),
    git(publication, "rev-parse", "HEAD^{tree}"),
  );
  git(
    publication,
    "remote",
    "add",
    "origin",
    "https://github.com/antropos17/commit-zero.git",
  );
  git(publication, "update-ref", "refs/remotes/origin/main", expectedPublic);
  await writeFile(
    join(root, "scripts/plain.txt"),
    "Changed synthetic fixture text\n",
  );
  await writeFile(
    join(root, "scripts/new space file.txt"),
    "Added synthetic file\n",
  );
  await writeFile(
    join(root, "docs/image.bin"),
    Buffer.from([0, 65, 2, 254, 255]),
  );
  await unlink(join(root, "scripts/deleted.txt"));
  git(root, "add", ".");
  git(root, "update-index", "--chmod=+x", "scripts/plain.txt");
  if (process.platform !== "win32")
    await chmod(join(root, "scripts/plain.txt"), 0o755);
  git(root, "commit", "-m", "Verified synthetic change envelope");
  await receipts(root);
  return { root, publication, options: { baseLocal, expectedPublic } };
}
const indexes = async (root, publication) => [
  await readFile(join(root, ".git/index")),
  await readFile(join(publication, ".git/index")),
];

test("publication preparation dry run preserves both histories/indexes and staging transfers the exact committed tree", async (t) => {
  const { root, publication, options } = await fixture(t);
  // Model a clean Windows working copy whose committed text is normalized LF.
  await writeFile(
    join(publication, "scripts/plain.txt"),
    "Original fixture text\r\n",
  );
  git(publication, "add", "scripts/plain.txt");
  assert.equal(
    git(publication, "write-tree"),
    git(publication, "rev-parse", "HEAD^{tree}"),
  );
  assert.equal(
    git(publication, "status", "--porcelain"),
    "",
    git(publication, "diff", "--", "scripts/plain.txt") +
      git(publication, "check-attr", "-a", "--", "scripts/plain.txt"),
  );
  const before = await indexes(root, publication),
    sourceHead = git(root, "rev-parse", "HEAD");
  const started = Date.now(),
    ready = await preparePublication(root, options);
  assert.equal(ready.status, "ready", ready.error);
  assert.equal(ready.stageAttempted, false);
  assert.equal(ready.dryRunIndexesUnchanged, true);
  assert.deepEqual(await indexes(root, publication), before);
  assert.equal(git(publication, "status", "--porcelain"), "");
  assert(ready.patch.paths.includes("scripts/deleted.txt"));
  assert.match(await readFile(ready.patch.path, "utf8"), /GIT binary patch/);
  const staged = await preparePublication(root, { ...options, stage: true });
  assert.equal(staged.status, "staged", staged.error);
  assert.equal(staged.mutationOutcome, "staged-exact-tree");
  assert.equal(staged.stagedTree, git(root, "rev-parse", "HEAD^{tree}"));
  assert.equal(git(publication, "rev-parse", "HEAD"), options.expectedPublic);
  assert.equal(git(root, "rev-parse", "HEAD"), sourceHead);
  assert.deepEqual(await readFile(join(root, ".git/index")), before[0]);
  assert.deepEqual(
    await readFile(join(publication, "docs/image.bin")),
    Buffer.from([0, 65, 2, 254, 255]),
  );
  assert.equal(
    git(publication, "ls-files", "--stage", "scripts/plain.txt").slice(0, 6),
    "100755",
  );
  await assert.rejects(readFile(join(publication, "scripts/deleted.txt")), {
    code: "ENOENT",
  });
  t.diagnostic(
    `Disposable fixture dry-run + staging: ${Date.now() - started} ms; not a comparative speedup measurement.`,
  );
});

test("publication preparation refuses source and publication changes without discarding either", async (t) => {
  const { root, publication, options } = await fixture(t);
  const original = await readFile(join(root, "scripts/plain.txt"));
  await writeFile(join(root, "scripts/plain.txt"), "Unrelated local draft\n");
  let report = await preparePublication(root, { ...options, stage: true });
  assert.equal(report.status, "blocked");
  assert.match(report.error, /Source checkout has changes/);
  assert.equal(
    await readFile(join(root, "scripts/plain.txt"), "utf8"),
    "Unrelated local draft\n",
  );
  await writeFile(join(root, "scripts/plain.txt"), original);
  await writeFile(
    join(publication, "scripts/plain.txt"),
    "Unrelated public draft\n",
  );
  const before = await indexes(root, publication);
  report = await preparePublication(root, { ...options, stage: true });
  assert.equal(report.status, "blocked");
  assert.match(report.error, /Publication checkout has changes/);
  assert.deepEqual(await indexes(root, publication), before);
  assert.equal(
    await readFile(join(publication, "scripts/plain.txt"), "utf8"),
    "Unrelated public draft\n",
  );
});

test("publication preparation refuses stale heads, unmatched bases, wrong origin and incomplete receipts", async (t) => {
  const { root, publication, options } = await fixture(t);
  const before = await indexes(root, publication);
  let report = await preparePublication(root, {
    ...options,
    expectedPublic: options.baseLocal,
    stage: true,
  });
  assert.match(report.error, /expected commit/);
  assert.equal(report.stageAttempted, false);
  report = await preparePublication(root, {
    ...options,
    baseLocal: git(root, "rev-parse", "HEAD"),
    stage: true,
  });
  assert.match(report.error, /different trees/);
  assert.equal(report.stageAttempted, false);
  git(
    publication,
    "remote",
    "set-url",
    "origin",
    "https://github.com/example/unrelated.git",
  );
  report = await preparePublication(root, { ...options, stage: true });
  assert.match(report.error, /origin does not identify/);
  git(
    publication,
    "remote",
    "set-url",
    "origin",
    "https://github.com/antropos17/commit-zero.git",
  );
  await writeFile(
    join(root, ".cache/verification/latest-full.json"),
    JSON.stringify({ status: "passed", fullGate: false }),
  );
  report = await preparePublication(root, { ...options, stage: true });
  assert.match(report.error, /complete full-gate and browser receipts/);
  assert.equal(report.status, "blocked");
  assert.equal(report.stageAttempted, false);
  assert.deepEqual(await indexes(root, publication), before);
});

test("publication preparation blocks redirected checkout and target parents without touching the outside fixture", async (t) => {
  const { root, publication, options } = await fixture(t, {
    publicName: "outside-fixture",
  });
  const redirect = join(root, ".cache/publication");
  await symlink(
    publication,
    redirect,
    process.platform === "win32" ? "junction" : "dir",
  );
  let report = await preparePublication(root, { ...options, stage: true });
  assert.equal(report.status, "blocked");
  assert.match(report.error, /ordinary directory/);
  await unlink(redirect);
  // Use a second fixture to exercise a clean ignored parent link on an added path.
  const next = await fixture(t);
  await mkdir(join(next.root, "extra"));
  await writeFile(join(next.root, "extra/new.txt"), "New source fixture\n");
  git(next.root, "add", "-f", "extra/new.txt");
  git(next.root, "commit", "-m", "Add ignored-root source fixture");
  await receipts(next.root);
  const outside = join(next.root, ".cache/outside");
  await mkdir(outside);
  await writeFile(join(outside, "keep.txt"), "Outside fixture unchanged\n");
  const parentLink = join(next.publication, "extra");
  await symlink(
    outside,
    parentLink,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(git(next.publication, "status", "--porcelain"), "");
  report = await preparePublication(next.root, {
    ...next.options,
    stage: true,
  });
  assert.equal(report.status, "blocked");
  assert.match(report.error, /ordinary directory/);
  assert.equal(
    await readFile(join(outside, "keep.txt"), "utf8"),
    "Outside fixture unchanged\n",
  );
  await assert.rejects(readFile(join(outside, "new.txt")), { code: "ENOENT" });
  await unlink(parentLink);
});

test("a previous ready report is replaced when later preparation is invalid", async (t) => {
  const { root, options } = await fixture(t);
  assert.equal((await preparePublication(root, options)).status, "ready");
  const report = await preparePublication(root, {
    baseLocal: "HEAD^",
    expectedPublic: options.expectedPublic,
    stage: true,
  });
  assert.equal(report.status, "blocked");
  assert.equal(report.stageAttempted, false);
  const saved = JSON.parse(
    await readFile(
      join(root, ".cache/verification/latest-publication-preparation.json"),
      "utf8",
    ),
  );
  assert.equal(saved.status, "blocked");
  assert.match(saved.error, /full lowercase/);
  const parsed = await preparePublication(root, {
    argumentError: "Unknown CLI option fixture.",
  });
  assert.equal(parsed.status, "blocked");
  assert.equal(parsed.error, "Unknown CLI option fixture.");
});

test("publication CLI permits only exact base/head selection and explicit staging", () => {
  assert.deepEqual(
    parsePreparationArgs([
      "--base-local",
      "a".repeat(40),
      "--expected-public",
      "b".repeat(40),
    ]),
    { stage: false, baseLocal: "a".repeat(40), expectedPublic: "b".repeat(40) },
  );
  assert.equal(parsePreparationArgs(["--stage"]).stage, true);
  for (const args of [
    ["--push"],
    ["--target", "outside"],
    ["--stage", "--stage"],
    ["--base-local", "a", "--base-local", "b"],
  ])
    assert.throws(() => parsePreparationArgs(args));
});

test("a forced tracked private input blocks preparation without exposing or transferring its contents", async (t) => {
  const { root, publication, options } = await fixture(t);
  await writeFile(
    join(root, ".env"),
    "SYNTHETIC_SECRET_NEVER_PRINT=fixture-only\n",
  );
  git(root, "add", "-f", ".env");
  git(root, "commit", "-m", "Invalid synthetic private input fixture");
  const before = await indexes(root, publication);
  const report = await preparePublication(root, { ...options, stage: true });
  assert.equal(report.status, "blocked");
  assert.match(report.error, /runtime or private configuration/);
  assert(!JSON.stringify(report).includes("SYNTHETIC_SECRET_NEVER_PRINT"));
  assert.deepEqual(await indexes(root, publication), before);
  await assert.rejects(readFile(join(publication, ".env")), { code: "ENOENT" });
});

test("Git patch rejection leaves binary, deletion, addition, index and HEAD unchanged", async (t) => {
  const { root, publication, options } = await fixture(t);
  const ready = await preparePublication(root, options);
  assert.equal(ready.status, "ready", ready.error);
  await writeFile(
    join(publication, "scripts/plain.txt"),
    "Concurrent incompatible public content\n",
  );
  git(publication, "add", "scripts/plain.txt");
  git(publication, "commit", "-m", "Incompatible public fixture edit");
  const head = git(publication, "rev-parse", "HEAD"),
    before = await indexes(root, publication);
  // Exercise the actual Git primitive's rejection separately. The preparation
  // tool refuses this changed HEAD before attempting application.
  assert.throws(() => git(publication, "apply", "--index", ready.patch.path));
  assert.deepEqual(await indexes(root, publication), before);
  assert.equal(git(publication, "rev-parse", "HEAD"), head);
  assert.equal(
    await readFile(join(publication, "scripts/plain.txt"), "utf8"),
    "Concurrent incompatible public content\n",
  );
  assert.deepEqual(
    await readFile(join(publication, "docs/image.bin")),
    Buffer.from([0, 1, 255]),
  );
  assert.equal(
    await readFile(join(publication, "scripts/deleted.txt"), "utf8"),
    "Synthetic removal fixture\n",
  );
  await assert.rejects(
    readFile(join(publication, "scripts/new space file.txt")),
    { code: "ENOENT" },
  );
});
