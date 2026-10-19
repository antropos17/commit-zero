import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fingerprint,
  sourceFiles,
  sourceRoots,
  rootFiles,
  inside,
} from "../scripts/project-files.mjs";

const temporaryRoot = resolve(".cache/tmp");
async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(join(temporaryRoot, "source-index-test-"));
  for (const path of [...sourceRoots, "docs"])
    await mkdir(join(root, path), { recursive: true });
  for (const path of rootFiles) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), "Synthetic source-index fixture.\n");
  }
  await writeFile(
    join(root, ".gitignore"),
    ".cache/\nruntime/\nnode_modules/\ndist/\n.env\n",
  );
  t.after(async () => {
    const target = await realpath(root),
      base = await realpath(temporaryRoot);
    assert(
      inside(base, target) &&
        target !== base &&
        basename(target).startsWith("source-index-test-"),
    );
    await rm(target, { recursive: true, force: true });
  });
  return root;
}
function git(root, ...args) {
  const env = { ...process.env };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
  ])
    delete env[key];
  return execFileSync(
    "git",
    [
      "-c",
      "core.hooksPath=.cache/empty-hooks",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "user.name=Source Index Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-C",
      root,
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}
async function initialize(root) {
  await mkdir(join(root, ".cache/empty-hooks"), { recursive: true });
  git(root, "init", "--template=.cache/empty-hooks", "-b", "fixture-source");
  git(root, "add", "--", ".");
  git(root, "commit", "-m", "Synthetic source index baseline");
}

test("source archives fingerprint root policy, configuration, legacy UI and vendored references", async (t) => {
  const root = await fixture(t);
  const paths = [
    "CONTRIBUTING.md",
    "compose.yaml",
    ".env.example",
    ".agents/skills/reference.md",
    "prototype/legacy.html",
  ];
  let previous = await fingerprint(root);
  for (const path of paths) {
    await writeFile(join(root, path), `Changed synthetic input ${path}\n`);
    const next = await fingerprint(root);
    assert.notEqual(next, previous, path);
    assert((await sourceFiles(root)).includes(path));
    previous = next;
  }
  await mkdir(join(root, "runtime"));
  await mkdir(join(root, ".cache"));
  await writeFile(join(root, ".env"), "FIXTURE_ONLY=private-placeholder\n");
  await writeFile(join(root, "events.jsonl"), "Synthetic runtime record\n");
  await writeFile(
    join(root, "runtime/history.json"),
    "Synthetic retained history\n",
  );
  await writeFile(join(root, ".cache/disposable.log"), "Synthetic output\n");
  assert.equal(await fingerprint(root), previous);
});

test("Git checkouts include tracked extensions and preserve working deletion evidence across commit", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, "extension"));
  await writeFile(
    join(root, "extension/source.txt"),
    "Synthetic extension before\n",
  );
  await initialize(root);
  const before = await fingerprint(root);
  await writeFile(
    join(root, "extension/source.txt"),
    "Synthetic extension after\n",
  );
  assert.notEqual(await fingerprint(root), before);
  assert((await sourceFiles(root)).includes("extension/source.txt"));
  await unlink(join(root, "extension/source.txt"));
  const deleted = await fingerprint(root);
  git(root, "add", "-u");
  git(root, "commit", "-m", "Remove synthetic extension");
  assert.equal(await fingerprint(root), deleted);
});

test("tracked file modes participate and sparse or hidden index changes cannot qualify", async (t) => {
  const root = await fixture(t);
  await initialize(root);
  const before = await fingerprint(root);
  git(root, "update-index", "--chmod=+x", "README.md");
  assert.notEqual(await fingerprint(root), before);
  git(root, "update-index", "--chmod=-x", "README.md");
  assert.equal(await fingerprint(root), before);
  git(root, "update-index", "--assume-unchanged", "README.md");
  await assert.rejects(fingerprint(root), /sparse or assume-unchanged/);
  git(root, "update-index", "--no-assume-unchanged", "README.md");
  git(root, "update-index", "--skip-worktree", "README.md");
  await assert.rejects(fingerprint(root), /sparse or assume-unchanged/);
  git(root, "update-index", "--no-skip-worktree", "README.md");
  assert.equal(await fingerprint(root), before);
});

for (const path of [".env", "runtime/history.json", ".cache/evidence.json"])
  test(`source evidence refuses a forced tracked private/runtime input: ${path}`, async (t) => {
    const root = await fixture(t);
    await initialize(root);
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(
      join(root, path),
      "Synthetic forbidden input, not a real secret.\n",
    );
    git(root, "add", "-f", "--", path);
    await assert.rejects(
      fingerprint(root),
      /tracked runtime or private configuration/,
    );
  });

test("source traversal refuses a directory redirect and leaves its outside fixture intact", async (t) => {
  const root = await fixture(t),
    outside = await fixture(t);
  await writeFile(join(outside, "marker.txt"), "Outside synthetic fixture\n");
  await symlink(
    outside,
    join(root, "docs/redirect"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(fingerprint(root), /symlink/);
  assert.equal(
    await readFile(join(outside, "marker.txt"), "utf8"),
    "Outside synthetic fixture\n",
  );
});

test("source indexing ignores ambient Git redirects and leaves both indexes unchanged", async (t) => {
  const root = await fixture(t),
    other = await fixture(t);
  await initialize(root);
  await writeFile(join(other, "README.md"), "Different synthetic checkout.\n");
  await initialize(other);
  const before = await fingerprint(root);
  const ownIndex = await readFile(join(root, ".git/index")),
    otherIndex = await readFile(join(other, ".git/index"));
  const overrides = {
    GIT_DIR: join(other, ".git"),
    GIT_COMMON_DIR: join(other, ".git"),
    GIT_WORK_TREE: other,
    GIT_INDEX_FILE: join(other, ".git/index"),
  };
  const original = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, overrides);
    assert.equal(await fingerprint(root), before);
    assert.deepEqual(await readFile(join(root, ".git/index")), ownIndex);
    assert.deepEqual(await readFile(join(other, ".git/index")), otherIndex);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("source inspection is distinct from a gate and replaces an earlier inspection after failure", async (t) => {
  const root = await fixture(t);
  const script = fileURLToPath(
    new URL("../scripts/source-inspect.mjs", import.meta.url),
  );
  const inspect = () =>
    execFileSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
    });
  const inspected = JSON.parse(inspect());
  assert.equal(inspected.status, "inspected");
  assert.equal(inspected.stable, true);
  assert.equal(inspected.fullGate, undefined);
  await unlink(join(root, "README.md"));
  assert.throws(inspect);
  const blocked = JSON.parse(
    await readFile(
      join(root, ".cache/verification/latest-source-inspection.json"),
      "utf8",
    ),
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.sourceHash, undefined);
});
