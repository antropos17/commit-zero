import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  lstat,
  cp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import lockfile from "proper-lockfile";

async function files(root, current = root) {
  const entries = [];
  for (const name of await readdir(current)) {
    const path = resolve(current, name),
      stat = await lstat(path);
    if (stat.isSymbolicLink())
      throw new Error("Snapshot refuses symbolic links and junctions.");
    if (stat.isDirectory()) entries.push(...(await files(root, path)));
    else if (stat.isFile())
      entries.push({
        path: relative(root, path).split(sep).join("/"),
        bytes: stat.size,
      });
    else throw new Error("Snapshot refuses special files.");
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function verifySnapshot(directory) {
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error("Snapshot directory cannot be a link.");
  const manifest = JSON.parse(
    await readFile(resolve(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.format !== "commit-zero-stores/1" ||
    !Array.isArray(manifest.files)
  )
    throw new Error("Unknown snapshot format.");
  const actual = (await files(directory)).filter(
    (item) => item.path !== "manifest.json",
  );
  if (actual.length !== manifest.files.length)
    throw new Error("Snapshot file count differs from manifest.");
  const listed = new Map(manifest.files.map((item) => [item.path, item]));
  if (listed.size !== manifest.files.length)
    throw new Error("Snapshot manifest contains duplicate paths.");
  for (const item of actual) {
    const expected = listed.get(item.path);
    if (
      !expected ||
      expected.bytes !== item.bytes ||
      expected.sha256 !== (await digest(resolve(directory, item.path)))
    )
      throw new Error(`Snapshot verification failed: ${item.path}`);
  }
  return {
    directory,
    files: actual.length,
    bytes: actual.reduce((n, item) => n + item.bytes, 0),
    status: "verified",
  };
}
export async function snapshotStores(root = process.cwd()) {
  if (process.env.DATABASE_URL || process.env.IDENTITY_DATABASE_URL)
    throw new Error(
      "External PostgreSQL requires pg_dump; this command copies embedded stores only.",
    );
  const sources = [
    process.env.DATABASE_DIR || "runtime/database",
    process.env.IDENTITY_DATABASE_DIR || "runtime/identity",
  ].map((path) => resolve(root, path));
  const boundary = resolve(root) + sep;
  if (sources.some((path) => !path.startsWith(boundary)))
    throw new Error("Embedded store paths must remain inside this workspace.");
  const releases = [];
  let destination;
  try {
    for (const source of sources) {
      if ((await lstat(source)).isSymbolicLink())
        throw new Error("Store directory cannot be a link.");
      await files(source); // Reject linked/special entries before copying.
      releases.push(await lockfile.lock(source, { retries: 0, stale: 30000 }));
    }
    const parent = resolve(root, "runtime/backups");
    await mkdir(parent, { recursive: true });
    if ((await lstat(parent)).isSymbolicLink())
      throw new Error("Backup directory cannot be a link.");
    destination = resolve(
      parent,
      `stores-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`,
    );
    await mkdir(destination);
    for (const [index, source] of sources.entries())
      await cp(source, resolve(destination, index ? "identity" : "database"), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    const manifest = {
      format: "commit-zero-stores/1",
      at: new Date().toISOString(),
      files: [],
    };
    for (const item of await files(destination))
      manifest.files.push({
        ...item,
        sha256: await digest(resolve(destination, item.path)),
      });
    await writeFile(
      resolve(destination, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { flag: "wx" },
    );
    return await verifySnapshot(destination);
  } catch (error) {
    throw new Error(
      `${error.message}. Stop the services before taking a snapshot.${destination ? ` Partial output retained at ${destination}.` : ""}`,
      { cause: error },
    );
  } finally {
    for (const release of releases.reverse()) await release();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [mode = "create", path] = process.argv.slice(2);
    if (mode !== "create" && (mode !== "verify" || !path))
      throw new Error("Use create | verify <snapshot-directory>.");
    console.log(
      JSON.stringify(
        mode === "create"
          ? await snapshotStores()
          : await verifySnapshot(resolve(path)),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
