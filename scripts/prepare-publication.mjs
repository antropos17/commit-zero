import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  fingerprint,
  inside,
  sourceIndexVersion,
  gitEnvironment,
} from "./project-files.mjs";
import { verificationDirectory } from "./browser-runtime.mjs";
import {
  evaluateLocalChecks,
  isPublicationOrigin,
} from "./evidence-status.mjs";

const execute = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const revision = (value) => /^[a-f0-9]{40}$/.test(value || "");

async function git(root, args) {
  const env = gitEnvironment();
  try {
    return (
      await execute(
        "git",
        [
          "-c",
          "core.excludesFile=",
          "-c",
          "core.fsmonitor=false",
          "-c",
          `safe.directory=${root}`,
          "-C",
          root,
          ...args,
        ],
        {
          env,
          encoding: "buffer",
          windowsHide: true,
          timeout: 8000,
          maxBuffer: 32 * 1024 * 1024,
        },
      )
    ).stdout;
  } catch (error) {
    throw new Error(
      `Git ${args[0]} failed (${error.code || "unknown"}). ${String(
        error.stderr || "",
      )
        .slice(0, 1600)
        .trim()}`,
      { cause: error },
    );
  }
}
const value = async (root, args) =>
  (await git(root, args)).toString("utf8").trim();
const dirty = async (root) =>
  Boolean(
    await value(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
  );
const indexHash = async (root) =>
  digest(await readFile(resolve(root, ".git/index")));

async function ordinary(path, directory = false) {
  const info = await lstat(path);
  if (
    info.isSymbolicLink() ||
    (directory ? !info.isDirectory() : !info.isFile())
  )
    throw new Error(
      `Publication preparation requires an ordinary ${directory ? "directory" : "file"}: ${path}`,
    );
}
async function repositoryRoot(root) {
  await ordinary(root, true);
  await ordinary(resolve(root, ".git"), true);
  await ordinary(resolve(root, ".git/index"));
  if (
    (await realpath(await value(root, ["rev-parse", "--show-toplevel"]))) !==
    (await realpath(root))
  )
    throw new Error("Git must identify the requested checkout's own root.");
}
async function safeDestination(root, path) {
  const parts = path.split("/");
  if (
    !path ||
    path.includes("\\") ||
    parts.some((part) => !part || part === "." || part === "..") ||
    !inside(root, resolve(root, path))
  )
    throw new Error("Publication patch contains an invalid relative path.");
  let cursor = root;
  for (let index = 0; index < parts.length; index++) {
    cursor = resolve(cursor, parts[index]);
    try {
      await ordinary(cursor, index < parts.length - 1);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}
async function saveReport(path, report) {
  try {
    await ordinary(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
}
async function savePatch(path, patch) {
  try {
    await writeFile(path, patch, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    await ordinary(path);
    if (!patch.equals(await readFile(path)))
      throw new Error("Existing content-addressed patch has different bytes.", {
        cause: error,
      });
  }
}

export async function preparePublication(
  root,
  { baseLocal, expectedPublic, stage = false, argumentError } = {},
) {
  const directory = await verificationDirectory(root);
  const output = resolve(directory, "latest-publication-preparation.json");
  const report = {
    status: "running",
    sourceIndexVersion,
    startedAt: new Date().toISOString(),
    mode: stage ? "stage" : "dry-run",
    baseLocal,
    expectedPublic,
    stageAttempted: false,
    mutationOutcome: "not-attempted",
    source: null,
    publication: null,
    patch: null,
    scope:
      "Prepare the fixed separate publication checkout only. No fetch, commit, push, merge, reset, tag, release, model or sandbox execution. Cached refs are not fresh remote evidence.",
  };
  await saveReport(output, report);
  let publication, before;
  try {
    if (argumentError) throw new Error(argumentError);
    if (
      !revision(baseLocal) ||
      !revision(expectedPublic) ||
      typeof stage !== "boolean"
    )
      throw new Error(
        "Provide full lowercase 40-character --base-local and --expected-public commit IDs; --stage is optional.",
      );
    root = await realpath(root);
    const requested = resolve(root, ".cache/publication");
    await ordinary(requested, true);
    publication = await realpath(requested);
    if (publication !== requested || !inside(root, publication))
      throw new Error(
        "Publication checkout must be the ordinary workspace .cache/publication directory.",
      );
    await repositoryRoot(root);
    await repositoryRoot(publication);
    if (await dirty(root))
      throw new Error(
        "Source checkout has changes; preserve them and commit verified source first.",
      );
    if (await dirty(publication))
      throw new Error(
        "Publication checkout has changes; preserve and review them before preparation.",
      );
    if (
      (await value(publication, ["symbolic-ref", "--short", "HEAD"])) !== "main"
    )
      throw new Error("Publication checkout must be on main.");
    if (
      !isPublicationOrigin(
        await value(publication, ["remote", "get-url", "origin"]),
      )
    )
      throw new Error(
        "Publication origin does not identify antropos17/commit-zero.",
      );
    const head = await value(root, ["rev-parse", "HEAD"]);
    const tree = await value(root, ["rev-parse", "HEAD^{tree}"]);
    report.source = { head, tree, sourceHash: await fingerprint(root) };
    report.publication = {
      head: await value(publication, ["rev-parse", "HEAD"]),
      tree: await value(publication, ["rev-parse", "HEAD^{tree}"]),
      cachedRemoteHead: await value(publication, [
        "rev-parse",
        "refs/remotes/origin/main",
      ]),
    };
    if (
      report.publication.head !== expectedPublic ||
      report.publication.cachedRemoteHead !== expectedPublic
    )
      throw new Error(
        "Publication HEAD or cached origin/main differs from the explicitly expected commit. Fetch and inspect separately.",
      );
    await git(root, ["merge-base", "--is-ancestor", baseLocal, head]);
    if (
      (await value(root, ["rev-parse", `${baseLocal}^{tree}`])) !==
      report.publication.tree
    )
      throw new Error(
        "The selected local base and expected public commit have different trees. Do not merge histories or overwrite newer work.",
      );
    const full = JSON.parse(
      await readFile(resolve(directory, "latest-full.json"), "utf8"),
    );
    const browser = JSON.parse(
      await readFile(resolve(directory, "latest-browser-suite.json"), "utf8"),
    );
    report.checks = evaluateLocalChecks({
      full,
      browser,
      sourceHash: report.source.sourceHash,
    });
    if (!report.checks.fullGateCurrent || !report.checks.browserSuiteCurrent)
      throw new Error(
        "Current complete full-gate and browser receipts are required on this exact source/index version.",
      );
    const paths = (
      await git(root, [
        "diff",
        "--name-only",
        "-z",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        baseLocal,
        head,
        "--",
      ])
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    if (!paths.length)
      throw new Error("There are no committed changes to prepare.");
    for (const path of paths) await safeDestination(publication, path);
    // This also refuses private/linked/hidden tracked inputs in the old checkout.
    const publicationHash = await fingerprint(publication);
    const patch = await git(root, [
      "diff",
      "--binary",
      "--full-index",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      baseLocal,
      head,
      "--",
    ]);
    if (!patch.length || patch.length > 16 * 1024 * 1024)
      throw new Error(
        "Publication patches must contain at most 16 MiB; split larger coherent changes.",
      );
    const patchHash = digest(patch);
    const patchPath = resolve(
      directory,
      `publication-${head.slice(0, 12)}-${patchHash.slice(0, 16)}.patch`,
    );
    await savePatch(patchPath, patch);
    report.patch = {
      path: patchPath,
      bytes: patch.length,
      sha256: patchHash,
      paths,
    };
    before = {
      sourceIndex: await indexHash(root),
      publicationIndex: await indexHash(publication),
      publicationHash,
    };
    await git(publication, ["apply", "--check", "--index", patchPath]);
    const stable = async () =>
      (await value(root, ["rev-parse", "HEAD"])) === head &&
      (await value(publication, ["rev-parse", "HEAD"])) === expectedPublic &&
      (await value(publication, ["rev-parse", "refs/remotes/origin/main"])) ===
        expectedPublic &&
      !(await dirty(root)) &&
      !(await dirty(publication)) &&
      (await fingerprint(root)) === report.source.sourceHash &&
      (await fingerprint(publication)) === publicationHash &&
      (await indexHash(root)) === before.sourceIndex &&
      (await indexHash(publication)) === before.publicationIndex;
    if (!(await stable()))
      throw new Error(
        "Checkouts changed during preparation. Preserve state and inspect before retrying.",
      );
    report.dryRunIndexesUnchanged = true;
    if (stage) {
      for (const path of paths) await safeDestination(publication, path);
      await saveReport(output, {
        ...report,
        stageAttempted: true,
        mutationOutcome: "uncertain",
      });
      report.stageAttempted = true;
      report.mutationOutcome = "uncertain";
      await git(publication, [
        "apply",
        "--index",
        "--whitespace=nowarn",
        patchPath,
      ]);
      report.stagedTree = await value(publication, ["write-tree"]);
      const stagedPaths = (
        await git(publication, [
          "diff",
          "--cached",
          "--name-only",
          "-z",
          "--no-ext-diff",
          "--no-textconv",
          "--no-renames",
          "HEAD",
          "--",
        ])
      )
        .toString("utf8")
        .split("\0")
        .filter(Boolean);
      await git(publication, [
        "diff",
        "--quiet",
        "--no-ext-diff",
        "--no-textconv",
        "--",
      ]);
      const untracked = await value(publication, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
      ]);
      if (
        report.stagedTree !== tree ||
        untracked ||
        JSON.stringify([...stagedPaths].sort()) !==
          JSON.stringify([...paths].sort()) ||
        (await value(publication, ["rev-parse", "HEAD"])) !== expectedPublic ||
        (await value(publication, [
          "rev-parse",
          "refs/remotes/origin/main",
        ])) !== expectedPublic ||
        (await value(root, ["rev-parse", "HEAD"])) !== head ||
        (await dirty(root)) ||
        (await indexHash(root)) !== before.sourceIndex ||
        (await fingerprint(root)) !== report.source.sourceHash
      )
        throw new Error(
          "Staging verification failed. Preserve publication state; do not reset or commit until inspected.",
        );
      report.mutationOutcome = "staged-exact-tree";
      report.status = "staged";
    } else report.status = "ready";
  } catch (error) {
    report.status = report.stageAttempted ? "failed" : "blocked";
    report.error = error.message;
    if (report.stageAttempted && before) {
      try {
        if (
          (await indexHash(publication)) === before.publicationIndex &&
          (await fingerprint(publication)) === before.publicationHash &&
          (await value(publication, ["rev-parse", "HEAD"])) === expectedPublic
        )
          report.mutationOutcome = "confirmed-unchanged";
      } catch {
        /* Preserve uncertainty when post-failure inspection is unavailable. */
      }
    }
  }
  report.finishedAt = new Date().toISOString();
  report.nextAction =
    report.status === "staged"
      ? "Review the staged diff and exact tree, then commit in the publication checkout and push normally. Inspect exact CI and rerun evidence:status -- --github. No release/tag was created."
      : report.status === "ready"
        ? "Review the patch/heads, fetch and inspect public main separately, then repeat the same command with --stage. This dry run made no Git change."
        : "Inspect the stated blocker and both Git states; preserve changes. No automatic reset or retry is performed.";
  await saveReport(output, report);
  return report;
}

export function parsePreparationArgs(args) {
  const options = { stage: false };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--stage" && !options.stage) options.stage = true;
    else if (["--base-local", "--expected-public"].includes(flag)) {
      const key = flag === "--base-local" ? "baseLocal" : "expectedPublic";
      if (options[key] !== undefined)
        throw new Error(`Duplicate option: ${flag}`);
      options[key] = args[++index];
    } else
      throw new Error(
        "Use --base-local <full-sha> --expected-public <full-sha> [--stage]. No target or network override is available.",
      );
  }
  return options;
}
async function run() {
  let options;
  try {
    options = parsePreparationArgs(process.argv.slice(2));
  } catch (error) {
    options = { argumentError: error.message };
  }
  const report = await preparePublication(projectRoot, options);
  console.log(JSON.stringify(report, null, 2));
  if (!["ready", "staged"].includes(report.status)) process.exitCode = 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
