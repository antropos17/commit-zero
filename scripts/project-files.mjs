import { readdir, readFile, lstat } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

export const sourceRoots = [
  "server",
  "services",
  "shared",
  "scripts",
  "tests",
  "db",
  "prototype/app",
  ".github",
];
export const rootFiles = [
  "package.json",
  "package-lock.json",
  "eslint.config.mjs",
  "vite.config.mjs",
  "playwright.config.mjs",
  ".npmrc",
  "AGENTS.md",
  "DESIGN.md",
  "README.md",
  "prototype/social.html",
  "prototype/social.css",
  "prototype/workspace.css",
  "prototype/theme.css",
  "prototype/typography.css",
  "prototype/social-state.mjs",
  "prototype/social-state.test.mjs",
];

export async function walk(root, path) {
  const info = await lstat(resolve(root, path));
  if (info.isSymbolicLink())
    throw new Error(`Source index refuses a symlink: ${path}`);
  if (info.isFile()) return [path.replaceAll("\\", "/")];
  const result = [];
  for (const entry of await readdir(resolve(root, path), {
    withFileTypes: true,
  }))
    result.push(...(await walk(root, join(path, entry.name))));
  return result.sort();
}

export async function fingerprint(root) {
  const files = [...rootFiles];
  for (const dir of [...sourceRoots, "docs", "prototype/assets"])
    files.push(...(await walk(root, dir)));
  const hash = createHash("sha256");
  for (const file of [...new Set(files)].sort()) {
    const bytes = await readFile(resolve(root, file));
    hash.update(`${file}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest("hex");
}

export function inside(root, file) {
  const local = relative(resolve(root), resolve(file));
  return (
    !isAbsolute(local) &&
    local !== ".." &&
    !local.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  );
}
