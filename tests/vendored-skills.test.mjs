import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { verifyVendoredSkills } from "../scripts/verify-vendored-skills.mjs";

function record(path, upstreamPath, bytes) {
  return {
    path,
    upstreamPath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    gitBlob: createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`))
      .update(bytes)
      .digest("hex"),
  };
}
async function fixture(t) {
  const base = resolve(".cache/tmp");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "vendor-identity-"));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(base + sep));
    await rm(root, { recursive: true, force: true });
  });
  const source = Buffer.from("Synthetic source fixture. Never execute.\n");
  const license = Buffer.from(
    "Synthetic identity fixture, not an upstream license.\n",
  );
  const directory = ".agents/skills/fixture";
  await mkdir(join(root, directory), { recursive: true });
  await mkdir(join(root, "docs/vendor-licenses"), { recursive: true });
  await writeFile(join(root, directory, "SKILL.md"), source);
  await writeFile(join(root, "docs/vendor-licenses/fixture.txt"), license);
  const manifest = {
    schemaVersion: 1,
    snapshots: [
      {
        id: "fixture",
        directory,
        repository: "https://github.com/fixture/identity",
        revision: "a".repeat(40),
        upstreamDirectory: "skills/fixture",
        license: "MIT",
        files: [
          record(`${directory}/SKILL.md`, "skills/fixture/SKILL.md", source),
        ],
        notices: [
          record("docs/vendor-licenses/fixture.txt", "LICENSE", license),
        ],
      },
    ],
  };
  return { root, manifest, source, license, directory };
}

test("all retained skill bytes and original upstream notices match the pinned identity ledger", async () => {
  const manifest = JSON.parse(
    await readFile("shared/vendored-skills.json", "utf8"),
  );
  const result = await verifyVendoredSkills(resolve("."), manifest);
  assert.equal(result.status, "offline-identity-matched");
  assert.equal(result.snapshots.length, 3);
  assert.equal(result.sourceFiles, 93);
  assert.equal(result.notices, 4);
});

test("source drift, unrecorded material and missing license evidence fail instead of reusing a match", async (t) => {
  const { root, manifest, source, directory } = await fixture(t);
  await verifyVendoredSkills(root, manifest);
  const target = join(root, directory, "SKILL.md");
  await writeFile(target, "Changed source fixture.\n");
  await assert.rejects(verifyVendoredSkills(root, manifest), /bytes differ/);
  await writeFile(target, source);
  const extra = join(root, directory, "extra.mjs");
  await writeFile(extra, "throw Error('Unrecorded fixture must never run');\n");
  await assert.rejects(
    verifyVendoredSkills(root, manifest),
    /inventory differs/,
  );
  await rm(extra);
  await rm(join(root, "docs/vendor-licenses/fixture.txt"));
  await assert.rejects(verifyVendoredSkills(root, manifest), /ENOENT/);
});

test("manifest duplicates, omitted licenses and outside paths cannot authorize a file read", async (t) => {
  const { root, manifest } = await fixture(t);
  const change = () => structuredClone(manifest);
  let value = change();
  value.snapshots.push(value.snapshots[0]);
  await assert.rejects(
    verifyVendoredSkills(root, value),
    /Invalid vendored snapshot/,
  );
  value = change();
  value.snapshots[0].notices = [];
  await assert.rejects(
    verifyVendoredSkills(root, value),
    /Invalid vendored snapshot/,
  );
  value = change();
  value.snapshots[0].notices[0].path = "../outside-secret.txt";
  await assert.rejects(verifyVendoredSkills(root, value), /escaping/);
  value = change();
  value.snapshots[0].files[0].upstreamPath = "skills/other/SKILL.md";
  await assert.rejects(verifyVendoredSkills(root, value), /escaping/);
});

test("a redirected notice parent is rejected before opening the target fixture", async (t) => {
  const { root, manifest, license } = await fixture(t);
  const original = join(root, "docs/vendor-licenses");
  const target = join(root, "original-notices");
  await rename(original, target);
  await symlink(
    target,
    original,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(verifyVendoredSkills(root, manifest), /redirected/);
  assert.deepEqual(await readFile(join(target, "fixture.txt")), license);
});
