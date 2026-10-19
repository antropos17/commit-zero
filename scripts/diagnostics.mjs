import { readdir, stat, lstat, statfs, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(".");
async function size(dir) {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.isSymbolicLink()) continue;
    const p = join(dir, e.name);
    total += e.isDirectory()
      ? await size(p)
      : e.isFile()
        ? (await stat(p)).size
        : 0;
  }
  return total;
}
// Only this script's known disposable, flat diagnostic folder is eligible for retention.
const folder = resolve(root, "runtime/diagnostics");
for (const path of [root, resolve(root, "runtime"), folder]) {
  const info = await lstat(path).catch(() => null);
  if (info?.isSymbolicLink())
    throw new Error("Diagnostic retention refuses reparse points.");
}
const entries = [];
for (const entry of await readdir(folder, { withFileTypes: true }).catch(
  () => [],
)) {
  if (
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    !/^qa-.*\.(png|json|txt)$/.test(entry.name)
  )
    continue;
  const path = join(folder, entry.name),
    info = await stat(path);
  entries.push({ path, ...info });
}
entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
let retained = 0;
for (const entry of entries) {
  retained += entry.size;
  if (
    Date.now() - entry.mtimeMs > 7 * 86400000 ||
    retained > 50 * 1024 * 1024
  ) {
    try {
      await unlink(entry.path);
    } catch {
      /* Locked files remain untouched. */
    }
  }
}
const disk = await statfs(root);
console.log(
  JSON.stringify(
    {
      freeGB: Math.round((disk.bavail * disk.bsize) / 1e9),
      directories: Object.fromEntries(
        await Promise.all(
          [
            "runtime/diagnostics",
            "runtime/browser-results",
            ".cache",
            "runtime/database",
            "runtime/identity",
            "runtime/backups",
            "runtime/local-model",
          ].map(async (p) => [p, await size(resolve(p))]),
        ),
      ),
      retention:
        "qa-* diagnostics: 7 days / 50 MB; databases and backups are never removed",
    },
    null,
    2,
  ),
);
