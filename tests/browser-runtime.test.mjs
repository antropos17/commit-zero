import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { browserEnvironment } from "../scripts/browser-runtime.mjs";
import { inside } from "../scripts/project-files.mjs";

async function fixture(t) {
  const base = resolve(".cache/tmp");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(resolve(base, "browser-env-"));
  t.after(async () => {
    assert.ok(inside(base, directory) && directory !== base);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test("browser environment scopes temporary files without mutating its caller", async (t) => {
  const directory = await fixture(t);
  const inherited = {
    TEMP: "inherited-temp",
    TMP: "inherited-tmp",
    TMPDIR: "inherited-tmpdir",
    FIXTURE_VALUE: "retained",
  };
  const before = { ...inherited },
    processTemp = process.env.TEMP;
  const result = await browserEnvironment(directory, inherited);
  const temporary = resolve(directory, ".cache/tmp");
  assert.equal(result.TEMP, temporary);
  assert.equal(result.TMP, temporary);
  assert.equal(result.TMPDIR, temporary);
  assert.equal(result.FIXTURE_VALUE, "retained");
  assert.ok((await lstat(temporary)).isDirectory());
  assert.deepEqual(inherited, before);
  assert.equal(process.env.TEMP, processTemp);
});

test("browser environment rejects file and redirected cache directories", async (t) => {
  const fileRoot = await fixture(t);
  await writeFile(resolve(fileRoot, ".cache"), "Synthetic directory conflict.");
  await assert.rejects(
    browserEnvironment(fileRoot, {}),
    /ordinary workspace directory/,
  );
  const linkRoot = await fixture(t);
  const target = resolve(linkRoot, "fixture-target");
  await mkdir(target);
  await symlink(
    target,
    resolve(linkRoot, ".cache"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    browserEnvironment(linkRoot, {}),
    /ordinary workspace directory/,
  );
  await assert.rejects(lstat(resolve(target, "tmp")), { code: "ENOENT" });
  const tempRoot = await fixture(t);
  await mkdir(resolve(tempRoot, ".cache"));
  const redirectedTemp = resolve(tempRoot, "redirected-temp");
  await mkdir(redirectedTemp);
  await symlink(
    redirectedTemp,
    resolve(tempRoot, ".cache/tmp"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    browserEnvironment(tempRoot, {}),
    /ordinary workspace directory/,
  );
});
