import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const relativePath = (value) =>
  typeof value === "string" &&
  value.length <= 240 &&
  value
    .split("/")
    .every(
      (part) => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..",
    );
const digest = (algorithm, bytes) =>
  createHash(algorithm).update(bytes).digest("hex");

async function regularPath(root, path, directory = false) {
  let current = root;
  const parts = path.split("/");
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const info = await lstat(current);
    const isDirectory = directory || index < parts.length - 1;
    if (
      info.isSymbolicLink() ||
      (isDirectory ? !info.isDirectory() : !info.isFile())
    )
      throw new Error(
        `Vendored identity refuses a redirected or non-regular path: ${path}`,
      );
  }
  return current;
}
async function inventory(root, path) {
  const directory = await regularPath(root, path, true);
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const next = `${path}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await inventory(root, next)));
    else {
      await regularPath(root, next);
      files.push(next);
    }
  }
  return files.sort();
}

export async function verifyVendoredSkills(root, manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    !Array.isArray(manifest.snapshots) ||
    !manifest.snapshots.length ||
    manifest.snapshots.length > 16
  )
    throw new Error("Invalid vendored identity manifest.");
  const seen = new Set(),
    ids = new Set(),
    snapshots = [];
  let sourceFiles = 0,
    notices = 0;
  for (const snapshot of manifest.snapshots) {
    if (
      !/^[a-z][a-z0-9-]{1,60}$/.test(snapshot.id || "") ||
      ids.has(snapshot.id) ||
      snapshot.directory !== `.agents/skills/${snapshot.id}` ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(
        snapshot.repository || "",
      ) ||
      !/^[a-f0-9]{40}$/.test(snapshot.revision || "") ||
      !relativePath(snapshot.upstreamDirectory) ||
      !["MIT", "Apache-2.0"].includes(snapshot.license) ||
      !Array.isArray(snapshot.files) ||
      !snapshot.files.length ||
      snapshot.files.length > 1000 ||
      !Array.isArray(snapshot.notices) ||
      !snapshot.notices.length ||
      snapshot.notices.length > 16 ||
      !snapshot.notices.some((notice) => notice.upstreamPath === "LICENSE")
    )
      throw new Error("Invalid vendored snapshot identity or license record.");
    ids.add(snapshot.id);
    const actual = await inventory(root, snapshot.directory);
    const expected = snapshot.files.map((file) => file.path).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(
        `Vendored inventory differs from its pinned record: ${snapshot.id}`,
      );
    for (const [kind, files] of [
      ["source", snapshot.files],
      ["notice", snapshot.notices],
    ]) {
      for (const file of files) {
        const prefix =
          kind === "source"
            ? `${snapshot.directory}/`
            : "docs/vendor-licenses/";
        if (
          !relativePath(file.path) ||
          !file.path.startsWith(prefix) ||
          seen.has(file.path) ||
          !relativePath(file.upstreamPath) ||
          (kind === "source" &&
            file.upstreamPath !==
              `${snapshot.upstreamDirectory}${file.path.slice(snapshot.directory.length)}`) ||
          !Number.isSafeInteger(file.bytes) ||
          file.bytes < 1 ||
          file.bytes > 10_000_000 ||
          !/^[a-f0-9]{40}$/.test(file.gitBlob || "") ||
          !/^[a-f0-9]{64}$/.test(file.sha256 || "")
        )
          throw new Error(
            "Invalid, duplicate or escaping vendored file record.",
          );
        seen.add(file.path);
        const bytes = await readFile(await regularPath(root, file.path));
        const blob = Buffer.concat([
          Buffer.from(`blob ${bytes.length}\0`),
          bytes,
        ]);
        if (
          bytes.length !== file.bytes ||
          digest("sha256", bytes) !== file.sha256 ||
          digest("sha1", blob) !== file.gitBlob
        )
          throw new Error(
            `Vendored bytes differ from the pinned upstream record: ${file.path}`,
          );
        if (kind === "source") sourceFiles++;
        else notices++;
      }
    }
    snapshots.push({
      id: snapshot.id,
      revision: snapshot.revision,
      license: snapshot.license,
      sourceFiles: snapshot.files.length,
    });
  }
  return {
    status: "offline-identity-matched",
    snapshots,
    sourceFiles,
    notices,
    scope:
      "Local bytes match recorded upstream Git blobs and SHA-256 values. No network, vendored executable, model or agent was run.",
  };
}

const root = fileURLToPath(new URL("../", import.meta.url));
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 2)
      throw new Error("skills:verify takes no arguments.");
    const manifest = JSON.parse(
      await readFile(join(root, "shared/vendored-skills.json"), "utf8"),
    );
    console.log(
      JSON.stringify(await verifyVendoredSkills(root, manifest), null, 2),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
