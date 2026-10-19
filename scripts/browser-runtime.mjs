import { spawn } from "node:child_process";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, inside } from "./project-files.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function cacheDirectory(root, name) {
  const canonicalRoot = await realpath(root);
  let directory = canonicalRoot;
  for (const part of [".cache", name]) {
    directory = resolve(directory, part);
    try {
      const info = await lstat(directory);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new Error(
          `Browser tools require an ordinary workspace directory: ${directory}`,
        );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(directory);
    }
    directory = await realpath(directory);
    if (!inside(canonicalRoot, directory) || directory === canonicalRoot)
      throw new Error(
        "Browser temporary paths must stay inside the workspace.",
      );
  }
  return directory;
}

export async function browserEnvironment(
  root = projectRoot,
  inherited = process.env,
) {
  const temporary = await cacheDirectory(root, "tmp");
  return { ...inherited, TEMP: temporary, TMP: temporary, TMPDIR: temporary };
}

export async function verificationDirectory(root = projectRoot) {
  return cacheDirectory(root, "verification");
}

// Call before importing Playwright: some temporary paths are set at import time.
// These are process-local settings, not operating-system environment changes.
export async function browserTools() {
  const env = await browserEnvironment();
  for (const key of ["TEMP", "TMP", "TMPDIR"]) process.env[key] = env[key];
  const { chromium, expect } = await import("@playwright/test");
  return { chromium, expect, temporaryDirectory: env.TMP };
}

export async function runBrowserTests(args, outputDirectory, reportFile) {
  const env = await browserEnvironment();
  if (outputDirectory) env.CZ_BROWSER_OUTPUT_DIR = outputDirectory;
  if (reportFile) env.CZ_BROWSER_JSON_OUTPUT = reportFile;
  return new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(projectRoot, "node_modules/playwright/cli.js"), "test", ...args],
      {
        cwd: projectRoot,
        stdio: "inherit",
        shell: false,
        windowsHide: true,
        env,
      },
    );
    child.once("error", reject);
    child.once("exit", (status, signal) => done(signal ? 1 : (status ?? 1)));
  });
}

async function doctor() {
  const output = resolve(
    await cacheDirectory(projectRoot, "verification"),
    "latest-browser.json",
  );
  const startedAt = new Date().toISOString(),
    started = performance.now();
  await writeFile(
    output,
    JSON.stringify({ status: "running", startedAt }) + "\n",
  );
  const report = {
    startedAt,
    status: "failed",
    browserLaunched: false,
    profileInsideWorkspace: false,
    profileRemovedAfterClose: false,
    applicationVerified: false,
    securityBoundary: false,
    inferenceStarted: false,
    scope:
      "Fresh about:blank Chromium process and temporary-profile cleanup only. No application, provider, model or code sandbox qualification.",
  };
  let browser, profile;
  try {
    report.sourceHash = await fingerprint(projectRoot);
    const { chromium, temporaryDirectory } = await browserTools();
    report.temporaryDirectory = temporaryDirectory;
    report.executable =
      process.env.CZ_BROWSER_EXECUTABLE || chromium.executablePath();
    try {
      await lstat(report.executable);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      report.status = "blocked";
      throw new Error(
        "Browser executable is unavailable. Set CZ_BROWSER_EXECUTABLE to installed Chrome or install Playwright Chromium explicitly.",
        { cause: error },
      );
    }
    browser = await chromium.launch({
      timeout: 15000,
      args: ["--enable-automation"],
      ...(process.env.CZ_BROWSER_EXECUTABLE
        ? { executablePath: process.env.CZ_BROWSER_EXECUTABLE }
        : {}),
    });
    report.browserLaunched = true;
    report.browser = browser.version();
    const session = await browser.newBrowserCDPSession();
    const command = await session.send("Browser.getBrowserCommandLine");
    const argument = command.arguments.find((value) =>
      value.startsWith("--user-data-dir="),
    );
    if (!argument)
      throw new Error(
        "The launched browser did not expose its temporary-profile path.",
      );
    profile = await realpath(argument.slice("--user-data-dir=".length));
    report.profile = profile;
    report.profileInsideWorkspace =
      inside(temporaryDirectory, profile) && profile !== temporaryDirectory;
    if (!report.profileInsideWorkspace)
      throw new Error(
        "The browser profile is outside the workspace temporary directory.",
      );
    const page = await browser.newPage();
    await page.goto("about:blank");
    report.pageOpened = page.url() === "about:blank";
    await session.detach();
  } catch (error) {
    report.error = error.message.slice(0, 2500);
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      report.error = `Browser cleanup failed: ${error.message}`.slice(0, 2500);
    }
    if (profile) {
      try {
        await lstat(profile);
      } catch (error) {
        if (error.code === "ENOENT") report.profileRemovedAfterClose = true;
        else
          report.error = `Profile cleanup could not be checked: ${error.message}`;
      }
    }
  }
  try {
    report.finalSourceHash = await fingerprint(projectRoot);
  } catch (error) {
    report.error = `Source fingerprint unavailable: ${error.message}`;
  }
  report.stable = Boolean(
    report.sourceHash && report.sourceHash === report.finalSourceHash,
  );
  if (
    !report.error &&
    report.browserLaunched &&
    report.profileInsideWorkspace &&
    report.profileRemovedAfterClose &&
    report.pageOpened &&
    report.stable
  )
    report.status = "passed";
  report.at = new Date().toISOString();
  report.durationMs = Math.round(performance.now() - started);
  report.nextAction =
    report.status === "passed"
      ? "Build the app, then run test:browser for a focused journey or test:ui for all groups. This probe does not verify the application."
      : "Check the executable and workspace temporary paths, then rerun browser:doctor. No browser is installed automatically.";
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}

async function run() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "doctor" && !args.length) return doctor();
  if (mode === "test" && args.length) {
    process.exitCode = await runBrowserTests(args);
    return;
  }
  throw new Error(
    "Use browser:doctor, test:browser -- <spec/options>, or test:ui for all independent groups.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
