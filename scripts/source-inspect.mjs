import { stat, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  fingerprint,
  sourceFiles,
  sourceIndexVersion,
} from "./project-files.mjs";
import { verificationDirectory } from "./browser-runtime.mjs";

const root = process.cwd();
let output;
const report = {
  status: "running",
  startedAt: new Date().toISOString(),
  sourceIndexVersion,
  scope:
    "Read-only source input/hash inspection. It does not run application tests, providers, models or a code sandbox.",
};
try {
  output = join(
    await verificationDirectory(root),
    "latest-source-inspection.json",
  );
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  const args = process.argv.slice(2);
  const samples =
    args.length === 0
      ? 1
      : args.length === 2 && args[0] === "--samples"
        ? Number(args[1])
        : NaN;
  if (!Number.isInteger(samples) || samples < 1 || samples > 10)
    throw new Error("Use source:inspect [-- --samples <1-10>].");
  const files = await sourceFiles(root);
  report.samples = [];
  for (let index = 0; index < samples; index++) {
    const started = performance.now();
    const hash = await fingerprint(root);
    report.samples.push({
      hash,
      durationMs: Math.round(performance.now() - started),
    });
  }
  report.sourceFiles = files.length;
  report.sourceBytes = (
    await Promise.all(
      files.map(async (path) => (await stat(resolve(root, path))).size),
    )
  ).reduce((sum, size) => sum + size, 0);
  report.sourceHash = report.samples[0].hash;
  report.finalSourceHash = await fingerprint(root);
  report.stable =
    report.samples.every((sample) => sample.hash === report.sourceHash) &&
    report.finalSourceHash === report.sourceHash;
  if (!report.stable)
    throw new Error(
      "Source changed during inspection. Freeze edits and rerun.",
    );
  report.status = "inspected";
} catch (error) {
  report.status = "blocked";
  report.error = error.message;
  process.exitCode = 1;
}
report.finishedAt = new Date().toISOString();
if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
