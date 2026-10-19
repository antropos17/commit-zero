import {
  readFile,
  access,
  statfs,
  stat,
  lstat,
  realpath,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walk, gitEnvironment } from "./project-files.mjs";

export function localBase(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use a loopback HTTP origin without credentials, path, query or fragment.",
    );
  return url;
}

export async function diagnose({
  root,
  url = "http://127.0.0.1:4173",
  fetcher = fetch,
  version = process.versions.node,
}) {
  const base = localBase(url);
  const checks = [];
  const record = (name, status, message) =>
    checks.push({ name, status, message });
  const [major, minor] = version.split(".").map(Number);
  record(
    "Node",
    major === 24 && minor >= 11 ? "ok" : "error",
    `${version}; requires 24.11+ in Node 24`,
  );
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const lock = JSON.parse(
    await readFile(resolve(root, "package-lock.json"), "utf8"),
  );
  let missing = 0;
  for (const [name, expected] of Object.entries({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  })) {
    try {
      const installed = JSON.parse(
        await readFile(
          resolve(root, "node_modules", name, "package.json"),
          "utf8",
        ),
      );
      if (
        installed.version !== expected ||
        lock.packages?.[`node_modules/${name}`]?.version !== expected
      )
        missing++;
    } catch {
      missing++;
    }
  }
  record(
    "Dependencies",
    missing ? "error" : "ok",
    missing
      ? `${missing} missing/mismatched direct dependencies. Run npm ci.`
      : "Installed direct versions match package and lockfile.",
  );
  const disk = await statfs(root);
  const freeGB = (disk.bavail * disk.bsize) / 1e9;
  record(
    "Disk",
    freeGB < 2 ? "error" : freeGB < 10 ? "warning" : "ok",
    `${freeGB.toFixed(1)} GB free on the workspace volume`,
  );
  try {
    const marker = await lstat(resolve(root, ".git"));
    if (marker.isSymbolicLink() || (!marker.isDirectory() && !marker.isFile()))
      throw new Error("No ordinary local Git metadata.");
    const git = (args) =>
      execFileSync(
        "git",
        ["-c", `safe.directory=${root}`, "-C", root, ...args],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 8000,
          env: gitEnvironment(),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    if (
      (await realpath(git(["rev-parse", "--show-toplevel"]).trim())) !==
      (await realpath(root))
    )
      throw new Error("Git metadata belongs to another checkout.");
    const status = git(["status", "--porcelain=v1", "-z"]);
    const branch = git(["branch", "--show-current"]).trim();
    record(
      "Git",
      "ok",
      `${branch || "detached HEAD"}; ${status ? "uncommitted work present; preserve it" : "clean checkout"}`,
    );
  } catch {
    record("Git", "warning", "Git metadata unavailable.");
  }
  try {
    const build = await stat(resolve(root, "dist/index.html"));
    const files = [];
    for (const path of [
      "prototype/app",
      "prototype/assets",
      "shared",
      "prototype/social.html",
      "prototype/social.css",
      "prototype/workspace.css",
      "prototype/theme.css",
      "prototype/typography.css",
      "vite.config.mjs",
      "scripts/build.mjs",
      "package.json",
      "package-lock.json",
    ])
      files.push(...(await walk(root, path)));
    const newest = Math.max(
      ...(await Promise.all(
        files.map(async (file) => (await stat(resolve(root, file))).mtimeMs),
      )),
    );
    record(
      "Build",
      build.mtimeMs >= newest ? "ok" : "warning",
      build.mtimeMs >= newest
        ? "Compiled output is newer than indexed frontend inputs."
        : "Source is newer than dist. Use npm run build for compiled preview, or npm run dev for HMR.",
    );
  } catch {
    record(
      "Build",
      "warning",
      "No complete compiled build. Run npm run build before npm start.",
    );
  }
  try {
    const response = await fetcher(new URL("/api/health", base), {
      signal: AbortSignal.timeout(3000),
      redirect: "error",
    });
    const health = await response.json();
    const expected = ["workspace", "identity", "ranking"];
    const healthy =
      response.ok &&
      health.status === "ok" &&
      expected.every((name) => health.services?.[name]?.status === "ok");
    record(
      "Runtime",
      healthy ? "ok" : "error",
      healthy
        ? `Gateway and all three dependencies healthy at ${base.origin}`
        : "Gateway returned incomplete/degraded health. Inspect npm run db:status and service terminal output.",
    );
  } catch {
    record(
      "Runtime",
      "warning",
      `No healthy response at ${base.origin}. Start this project or pass --url with its configured loopback origin.`,
    );
  }
  const context = await readFile(resolve(root, "docs/CONTEXT.md"), "utf8");
  const lines = context.split(/\r?\n/).length;
  record(
    "Context",
    lines > 120 ? "warning" : "ok",
    `${lines} lines (current handoff target: at most 120)`,
  );
  try {
    await access(resolve(root, "runtime/local-model"));
    record(
      "Model",
      "info",
      "Local model files exist; inference/provider readiness was not probed.",
    );
  } catch {
    record(
      "Model",
      "info",
      "Local model optional; not required for mocked tests.",
    );
  }
  return { checks, ok: !checks.some((check) => check.status === "error") };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.some(
        (arg, index) =>
          arg !== "--json" &&
          arg !== "--strict" &&
          arg !== "--url" &&
          args[index - 1] !== "--url",
      )
    )
      throw new Error(
        "Usage: npm run doctor -- [--json] [--strict] [--url http://127.0.0.1:4173]",
      );
    const at = args.indexOf("--url");
    if (at !== -1 && !args[at + 1])
      throw new Error("--url requires a loopback origin.");
    const result = await diagnose({
      root: fileURLToPath(new URL("../", import.meta.url)),
      ...(at !== -1 ? { url: args[at + 1] } : {}),
    });
    if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else console.table(result.checks);
    process.exitCode =
      !result.ok ||
      (args.includes("--strict") &&
        result.checks.some((c) => c.status === "warning"))
        ? 1
        : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
