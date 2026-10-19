import { readdir, readFile, lstat, realpath } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

export const sourceRoots = [
  "server",
  "services",
  "shared",
  "scripts",
  "tests",
  "db",
  "prototype",
  ".github",
  ".agents/skills",
];
export const rootFiles = [
  ".editorconfig",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "CONTRIBUTING.md",
  "LICENSE",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "brief-v7.md",
  "compose.yaml",
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

export const sourceIndexVersion = 2;
const execute = promisify(execFile);

function validateSourcePath(root, path) {
  if (
    !path ||
    path.includes("\\") ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    !inside(root, resolve(root, path))
  )
    throw new Error("Source index contains an invalid relative path.");
  const first = path.split("/")[0].toLowerCase();
  if (
    [
      ".git",
      ".cache",
      ".codex",
      ".aws",
      "runtime",
      "node_modules",
      "dist",
      "events.jsonl",
    ].includes(first) ||
    (/^\.env(?:\.|$)/i.test(first) &&
      !/^\.env\.(?:example|sample|template)$/i.test(first)) ||
    first === ".envrc"
  )
    throw new Error(
      `Source index refuses tracked runtime or private configuration: ${path}`,
    );
}

async function trackedInputs(root) {
  let marker;
  try {
    marker = await lstat(resolve(root, ".git"));
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
  if (marker.isSymbolicLink())
    throw new Error("Source index refuses redirected Git metadata.");
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
  ])
    delete env[key];
  const git = (args) =>
    execute(
      "git",
      [
        "-c",
        "core.excludesFile=",
        "-c",
        "core.fsmonitor=false",
        "-C",
        root,
        ...args,
      ],
      {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 8_000_000,
        windowsHide: true,
        env,
      },
    );
  const outcomes = await Promise.allSettled([
    git(["rev-parse", "--show-toplevel"]),
    git(["ls-files", "--cached", "--stage", "-v", "-z"]),
  ]);
  for (const outcome of outcomes)
    if (outcome.status === "rejected")
      throw new Error("Source Git index could not be read.", {
        cause: outcome.reason,
      });
  if (
    relative(
      await realpath(root),
      await realpath(outcomes[0].value.stdout.trim()),
    )
  )
    throw new Error("Source Git metadata belongs to another checkout.");
  const result = new Map();
  for (const record of outcomes[1].value.stdout.split("\0").filter(Boolean)) {
    const separator = record.indexOf("\t"),
      path = record.slice(separator + 1);
    const [flag, mode, , stage] = record.slice(0, separator).split(" ");
    if (separator < 0 || stage !== "0")
      throw new Error("Source index has unresolved or malformed Git entries.");
    if (flag !== "H")
      throw new Error(
        "Source evidence refuses sparse or assume-unchanged Git inputs.",
      );
    validateSourcePath(root, path);
    if (!["100644", "100755"].includes(mode))
      throw new Error(
        `Source index refuses linked or unsupported Git entries: ${path}`,
      );
    result.set(path, mode);
  }
  return result;
}

export async function walk(root, path) {
  const info = await lstat(resolve(root, path));
  if (info.isSymbolicLink())
    throw new Error(`Source index refuses a symlink: ${path}`);
  if (info.isFile()) return [path.replaceAll("\\", "/")];
  if (!info.isDirectory())
    throw new Error(`Source index refuses a non-regular entry: ${path}`);
  const result = [];
  for (const entry of await readdir(resolve(root, path), {
    withFileTypes: true,
  }))
    result.push(...(await walk(root, join(path, entry.name))));
  return result.sort();
}

async function sourceInputs(root) {
  const tracked = await trackedInputs(root);
  const walks = await Promise.allSettled(
    [...sourceRoots, "docs"].map((dir) => walk(root, dir)),
  );
  for (const outcome of walks)
    if (outcome.status === "rejected") throw outcome.reason;
  const required = new Set([
    ...rootFiles,
    ...walks.flatMap((outcome) => outcome.value),
  ]);
  const directories = new Set(),
    result = [];
  for (const path of [...new Set([...required, ...tracked.keys()])].sort()) {
    validateSourcePath(root, path);
    const parts = path.split("/");
    let info;
    try {
      for (let index = 1; index <= parts.length; index++) {
        const prefix = parts.slice(0, index).join("/");
        if (directories.has(prefix)) continue;
        info = await lstat(resolve(root, prefix));
        if (info.isSymbolicLink())
          throw new Error(`Source index refuses a symlink: ${prefix}`);
        if (index < parts.length) {
          if (!info.isDirectory())
            throw new Error(
              `Source index parent is not a directory: ${prefix}`,
            );
          directories.add(prefix);
        }
      }
    } catch (error) {
      // A working-tree deletion may be checked before it is staged. Required
      // inputs still fail closed, including source-only archive installations.
      if (error.code === "ENOENT" && !required.has(path)) continue;
      throw error;
    }
    if (!info.isFile())
      throw new Error(`Source index refuses a non-regular file: ${path}`);
    const mode =
      tracked.get(path) ||
      (process.platform !== "win32" && info.mode & 0o111 ? "100755" : "100644");
    result.push({ path, mode });
  }
  return result;
}

export async function sourceFiles(root) {
  return (await sourceInputs(root)).map((input) => input.path);
}

export async function fingerprint(root) {
  const hash = createHash("sha256").update(
    `commit-zero/source-index/v${sourceIndexVersion}\0`,
  );
  for (const { path, mode } of await sourceInputs(root)) {
    const bytes = await readFile(resolve(root, path));
    hash.update(`${path}\0${mode}\0${bytes.length}\0`).update(bytes);
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
