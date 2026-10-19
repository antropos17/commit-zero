import { execFile } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  fingerprint,
  inside,
  sourceIndexVersion,
  gitEnvironment,
} from "./project-files.mjs";
import { verificationDirectory } from "./browser-runtime.mjs";
import { browserGroups, browserStats } from "./test-ui.mjs";
import { qualityPlan } from "./quality-plan.mjs";

const execute = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = "antropos17/commit-zero";

function stamped(report, hash) {
  const started = Date.parse(report?.startedAt),
    finished = Date.parse(report?.finishedAt);
  return (
    /^[a-f0-9]{64}$/.test(hash || "") &&
    report?.status === "passed" &&
    report.sourceIndexVersion === sourceIndexVersion &&
    report.stable === true &&
    report.sourceHash === hash &&
    report.finalSourceHash === hash &&
    Number.isFinite(started) &&
    Number.isFinite(finished) &&
    finished >= started
  );
}

export function evaluateLocalChecks({ full, browser, sourceHash }) {
  const requiredStages = qualityPlan("full").map((stage) => stage.name);
  const fullGateCurrent =
    stamped(full, sourceHash) &&
    full.mode === "full" &&
    full.fullGate === true &&
    Array.isArray(full.stages) &&
    full.stages.every(
      (stage) => stage?.code === 0 && typeof stage.name === "string",
    ) &&
    JSON.stringify(full.stages?.map((stage) => stage.name)) ===
      JSON.stringify(requiredStages) &&
    full.stages.every((stage) => stage.code === 0);
  let browserSuiteCurrent =
    stamped(browser, sourceHash) &&
    browser.fullBrowserSuite === true &&
    Array.isArray(browser.groups) &&
    browser.groups?.length === browserGroups.length;
  if (browserSuiteCurrent) {
    browserSuiteCurrent = browser.groups.every((group, index) => {
      const expected = browserGroups[index];
      try {
        return (
          group.name === expected.name &&
          JSON.stringify(group.files) === JSON.stringify(expected.files) &&
          group.exitCode === 0 &&
          group.complete === true &&
          browserStats({ stats: group }).complete
        );
      } catch {
        return false;
      }
    });
  }
  return {
    fullGateCurrent: Boolean(fullGateCurrent),
    browserSuiteCurrent: Boolean(browserSuiteCurrent),
  };
}

export function evaluateEvidence(input) {
  const {
    source,
    publication,
    sourceHash,
    finalSourceHash,
    finalHead,
    finalPublicationHead,
    full,
    browser,
    hosted = { requested: false, status: "not-queried" },
  } = input;
  const issues = [];
  const add = (code, message, nextAction) =>
    issues.push({ code, message, nextAction });
  if (!source?.head || !source.tree)
    add(
      "source-unavailable",
      "Source Git metadata is unavailable.",
      "Run git status in the working repository and inspect the collection error.",
    );
  if (source?.dirty !== false)
    add(
      "source-dirty",
      "The working tree has changes or its state is unknown.",
      "Preserve and review changes; commit only verified work before preparing a handoff.",
    );
  const stable = Boolean(
    sourceHash && sourceHash === finalSourceHash && source?.head === finalHead,
  );
  if (!stable)
    add(
      "source-unstable",
      "Source changed or could not be read consistently.",
      "Stop editing briefly and rerun this read-only preflight.",
    );
  const { fullGateCurrent, browserSuiteCurrent } = evaluateLocalChecks({
    full,
    browser,
    sourceHash,
  });
  if (!fullGateCurrent)
    add(
      "full-gate-not-current",
      "The full-gate receipt is missing, stale, incomplete or failed.",
      "Freeze source and run npm run check. Focused suites do not replace it.",
    );
  if (!browserSuiteCurrent)
    add(
      "browser-suite-not-current",
      "The full browser-suite receipt is missing, stale, incomplete or failed.",
      "Freeze source and run npm run test:ui. A blank-browser probe or focused spec does not replace it.",
    );

  const publicationTreeMatches = Boolean(
    publication?.tree && publication.tree === source?.tree,
  );
  if (
    publication?.status !== "available" ||
    !publication.head ||
    !publication.tree
  )
    add(
      "publication-unavailable",
      "The separate publication checkout is unavailable.",
      "Inspect .cache/publication and the established workflow in docs/RELEASE.md; do not merge histories.",
    );
  else {
    if (publication.dirty !== false)
      add(
        "publication-dirty",
        "The publication checkout has changes.",
        "Review and preserve those changes before publishing; do not reset the checkout.",
      );
    if (!publication.originMatches)
      add(
        "publication-origin",
        "The publication origin does not identify the expected public repository.",
        "Inspect its remote configuration before any write. This command never changes remotes.",
      );
    if (!publicationTreeMatches)
      add(
        "publication-tree",
        "The committed source/public trees differ.",
        "Use the documented copy/compare/normal-push workflow after source verification.",
      );
    if (publication.head !== finalPublicationHead)
      add(
        "publication-unstable",
        "The publication HEAD changed during collection.",
        "Rerun the preflight after the publication operation completes.",
      );
    if (
      publication.cachedRemoteHead !== publication.head &&
      !(hosted.requested && hosted.remoteHead === publication.head)
    )
      add(
        "publication-remote-unconfirmed",
        "Cached origin/main does not equal the publication HEAD.",
        "Fetch and inspect origin/main, then recheck. Cached refs alone are not a fresh remote read.",
      );
  }
  if (hosted.requested) {
    if (hosted.remoteHead !== publication?.head)
      add(
        "hosted-head",
        "The fresh public main read did not confirm this publication HEAD.",
        "Inspect the remote state and preserve newer public work before proceeding.",
      );
    if (hosted.status !== "passed" || hosted.run?.headSha !== publication?.head)
      add(
        "hosted-ci",
        "The requested Verify workflow is not confirmed successful for this public commit.",
        "Inspect the returned CI run or GitHub read error; do not reuse another revision's CI result.",
      );
  }
  return {
    status: issues.length ? "blocked" : "current",
    stable,
    checks: {
      fullGateCurrent: Boolean(fullGateCurrent),
      browserSuiteCurrent: Boolean(browserSuiteCurrent),
      publicationTreeMatches,
    },
    issues,
  };
}

async function git(root, args) {
  const env = gitEnvironment();
  const stdout = (
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
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 2_000_000,
        windowsHide: true,
        env,
      },
    )
  ).stdout;
  return args[0] === "status" ? stdout.trimEnd() : stdout.trim();
}

export function isPublicationOrigin(value) {
  if (/^git@github\.com:antropos17\/commit-zero(?:\.git)?$/i.test(value))
    return true;
  try {
    const url = new URL(value);
    return (
      ["https:", "ssh:"].includes(url.protocol) &&
      url.hostname.toLowerCase() === "github.com" &&
      !url.search &&
      !url.hash &&
      url.pathname
        .replace(/^\//, "")
        .replace(/\.git\/?$/, "")
        .replace(/\/$/, "")
        .toLowerCase() === repository
    );
  } catch {
    return false;
  }
}

async function gitMetadata(root, publication = false) {
  const canonical = await realpath(root);
  if (publication) {
    const workspace = await realpath(projectRoot);
    if (!inside(workspace, canonical) || canonical === workspace)
      throw new Error(
        "The separate publication checkout must stay inside this workspace.",
      );
  }
  const top = await realpath(await git(root, ["rev-parse", "--show-toplevel"]));
  if (relative(canonical, top))
    throw new Error("The selected directory is not its own Git checkout.");
  const requests = [
    ["head", ["rev-parse", "HEAD"]],
    ["tree", ["rev-parse", "HEAD^{tree}"]],
    ["branch", ["branch", "--show-current"]],
    ["changes", ["status", "--porcelain=v1", "--untracked-files=normal"]],
  ];
  const outcomes = await Promise.allSettled(
    requests.map(([, args]) => git(root, args)),
  );
  const result = { status: "available", path: canonical };
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") throw outcome.reason;
    result[requests[index][0]] = outcome.value;
  });
  result.dirty = Boolean(result.changes);
  result.changes = result.changes ? result.changes.split(/\r?\n/) : [];
  if (publication) {
    const extra = await Promise.allSettled([
      git(root, ["rev-parse", "--verify", "refs/remotes/origin/main"]),
      git(root, ["config", "--get", "remote.origin.url"]),
    ]);
    result.cachedRemoteHead =
      extra[0].status === "fulfilled" ? extra[0].value : null;
    // Never print an origin URL that could contain embedded credentials.
    result.originMatches =
      extra[1].status === "fulfilled" && isPublicationOrigin(extra[1].value);
  }
  return result;
}

async function hostedMetadata(head) {
  const result = {
    requested: true,
    status: "unavailable",
    checkedAt: new Date().toISOString(),
  };
  if (!head)
    return {
      ...result,
      error: "Publication HEAD is unavailable; no GitHub request was made.",
    };
  const requests = [
    ["api", `repos/${repository}/commits/main`, "--jq", ".sha"],
    [
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      "ci.yml",
      "--commit",
      head,
      "--limit",
      "1",
      "--json",
      "databaseId,status,conclusion,url,headSha",
    ],
  ];
  const outcomes = await Promise.allSettled(
    requests.map((args) =>
      execute("gh", args, {
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 1_000_000,
        windowsHide: true,
      }),
    ),
  );
  const errors = [];
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      errors.push(
        `GitHub read ${index + 1} failed; check gh authentication/network.`,
      );
      return;
    }
    if (index === 0) result.remoteHead = outcome.value.stdout.trim();
    else {
      try {
        result.run = JSON.parse(outcome.value.stdout)[0] || null;
      } catch {
        errors.push("GitHub returned an invalid workflow response.");
      }
    }
  });
  if (errors.length) result.error = errors.join(" ");
  else
    result.status =
      result.run?.status === "completed" && result.run.conclusion === "success"
        ? "passed"
        : "not-passed";
  return result;
}

async function readReceipt(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function run() {
  const flags = process.argv.slice(2);
  if (
    flags.some((flag) => !["--github", "--json"].includes(flag)) ||
    new Set(flags).size !== flags.length
  )
    throw new Error(
      "Use --github for fresh remote reads and --json for machine output. The default makes no network request.",
    );
  const outputDirectory = await verificationDirectory();
  const output = resolve(outputDirectory, "latest-evidence-status.json");
  const startedAt = new Date().toISOString();
  await writeFile(
    output,
    JSON.stringify({ status: "running", startedAt }) + "\n",
  );
  const publicationRoot = resolve(projectRoot, ".cache/publication");
  if (!inside(projectRoot, publicationRoot))
    throw new Error("Publication path escaped the workspace.");
  const requests = [
    ["source", gitMetadata(projectRoot)],
    ["publication", gitMetadata(publicationRoot, true)],
    ["sourceHash", fingerprint(projectRoot)],
    ["full", readReceipt(resolve(outputDirectory, "latest-full.json"))],
    [
      "browser",
      readReceipt(resolve(outputDirectory, "latest-browser-suite.json")),
    ],
  ];
  const outcomes = await Promise.allSettled(
    requests.map(([, promise]) => promise),
  );
  const facts = { readErrors: [] };
  outcomes.forEach((outcome, index) => {
    const key = requests[index][0];
    if (outcome.status === "fulfilled") facts[key] = outcome.value;
    else {
      facts[key] = null;
      facts.readErrors.push({
        item: key,
        message: outcome.reason.message.slice(0, 500),
      });
    }
  });
  facts.hosted = flags.includes("--github")
    ? await hostedMetadata(facts.publication?.head)
    : {
        requested: false,
        status: "not-queried",
        note: "origin/main is cached metadata. Use --github for fresh public main and CI reads.",
      };
  const after = await Promise.allSettled([
    fingerprint(projectRoot),
    git(projectRoot, ["rev-parse", "HEAD"]),
    facts.publication
      ? git(publicationRoot, ["rev-parse", "HEAD"])
      : Promise.resolve(null),
  ]);
  ["finalSourceHash", "finalHead", "finalPublicationHead"].forEach(
    (key, index) => {
      facts[key] =
        after[index].status === "fulfilled" ? after[index].value : null;
      if (after[index].status === "rejected")
        facts.readErrors.push({
          item: key,
          message: after[index].reason.message.slice(0, 500),
        });
    },
  );
  const report = {
    startedAt,
    at: new Date().toISOString(),
    ...facts,
    ...evaluateEvidence(facts),
    scope:
      "Read-only source/check-receipt/publication preflight. No fetch, commit, copy, push, model, provider or sandbox execution. Current means matching source evidence, not hosted-service or model qualification.",
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  if (flags.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Source evidence: ${report.status}`);
    console.log(
      `Local: ${facts.source?.head || "unavailable"} (${facts.source?.branch || "detached/unknown"}), ${facts.source?.dirty === false ? "clean" : "changed/unknown"}`,
    );
    console.log(`Source hash: ${facts.sourceHash || "unavailable"}`);
    console.log(
      `Full gate: ${report.checks.fullGateCurrent ? "current" : "not current"}; full browser suite: ${report.checks.browserSuiteCurrent ? "current" : "not current"}`,
    );
    console.log(
      `Public checkout: ${facts.publication?.head || "unavailable"}; tree ${report.checks.publicationTreeMatches ? "matches" : "differs/unavailable"}`,
    );
    console.log(
      `Hosted Verify: ${facts.hosted.status}${facts.hosted.run?.url ? ` - ${facts.hosted.run.url}` : ""}`,
    );
    for (const issue of report.issues)
      console.log(`${issue.code}: ${issue.message} ${issue.nextAction}`);
    console.log(`Receipt: ${output}`);
    console.log(
      "Scope: source/check evidence only; model, sandbox and hosted-service qualification remain separate.",
    );
  }
  if (report.status !== "current") process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
