import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { qwenArtifact } from "../shared/local-model-artifact.mjs";
import { fingerprint } from "./project-files.mjs";

export async function inspectModelArtifact(directory, artifact, { hash = false, signal } = {}) {
  if (!artifact || typeof artifact.id !== "string" || !artifact.id || artifact.id.length > 200 ||
      typeof artifact.filename !== "string" || artifact.filename.length > 128 || basename(artifact.filename) !== artifact.filename ||
      !/^[a-z0-9][a-z0-9._-]*\.gguf$/i.test(artifact.filename) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(artifact.filename) ||
      !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1)
    throw new Error("A bounded GGUF filename, byte length and SHA-256 are required.");
  const result = { artifactId: artifact.id, filename: artifact.filename,
    expectedBytes: artifact.bytes, expectedSha256: artifact.sha256,
    identityStatus: "missing", artifactPresent: false, digestVerified: false, hashedBytes: 0,
    providerProbed: false, modelLoaded: false, runtimeVerified: false, inferenceStarted: false };
  try {
    signal?.throwIfAborted();
    const root = await realpath(directory);
    const target = await realpath(resolve(root, artifact.filename));
    if (!target.startsWith(root + sep)) return { ...result, identityStatus: "outside-artifact-directory" };
    const before = await stat(target);
    if (!before.isFile()) return { ...result, identityStatus: "not-a-file" };
    result.artifactPresent = true;
    result.bytes = before.size;
    if (before.size !== artifact.bytes) return { ...result, identityStatus: "size-mismatch" };
    if (!hash) return { ...result, identityStatus: "metadata-only" };
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(target, { signal })) {
      digest.update(chunk);
      result.hashedBytes += chunk.length;
    }
    const after = await stat(target);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      return { ...result, identityStatus: "changed-during-inspection" };
    result.sha256 = digest.digest("hex");
    result.digestVerified = result.sha256 === artifact.sha256;
    return { ...result, identityStatus: result.digestVerified ? "digest-matched" : "digest-mismatch" };
  } catch (error) {
    if (error.name === "AbortError" || signal?.aborted)
      return { ...result, identityStatus: "cancelled" };
    if (error.code === "ENOENT") return result;
    throw error;
  }
}

async function run() {
  const { values } = parseArgs({ options: { hash: { type: "boolean", default: false } } });
  const startedAt = new Date().toISOString(), output = ".cache/verification/latest-model-identity.json";
  await mkdir(".cache/verification", { recursive: true });
  await writeFile(output, JSON.stringify({ status: "running", startedAt }) + "\n");
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    const workspace = await realpath(process.cwd()), directory = resolve(workspace, "runtime/local-model");
    let result;
    try {
      const actualDirectory = await realpath(directory);
      result = actualDirectory.startsWith(workspace + sep)
        ? await inspectModelArtifact(actualDirectory, qwenArtifact, { hash: values.hash, signal: controller.signal })
        : { identityStatus: "outside-workspace", runtimeVerified: false, inferenceStarted: false };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      result = { identityStatus: "missing", runtimeVerified: false, inferenceStarted: false };
    }
    const status = ["metadata-only", "digest-matched"].includes(result.identityStatus) ? "completed" : "blocked";
    const nextAction = result.identityStatus === "metadata-only"
      ? "Run model:inspect -- --hash to compare bytes. Provider and hardware qualification remain separate."
      : result.identityStatus === "digest-matched"
        ? "Artifact identity matches. Explicit provider, tokenizer, hardware and role qualification are still required."
        : result.identityStatus === "missing"
          ? "Review setup requirements, then use model:setup to install the pinned artifact. Inspection never starts the provider."
          : result.identityStatus === "cancelled"
            ? "Inspection was cancelled. Retry explicitly when ready."
            : "Preserve the current file and review its path, size and pinned digest before replacement.";
    const report = { status, startedAt, at: new Date().toISOString(),
      sourceHash: await fingerprint(process.cwd()), ...result, nextAction,
      scope: "Read-only artifact identity. No token read, model loading, provider request, inference, hardware-fit qualification or activation." };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    if (status === "blocked") process.exitCode = result.identityStatus === "cancelled" ? 130 : 1;
  } catch (error) {
    await writeFile(output, JSON.stringify({ status: "failed", startedAt, error: error.message }) + "\n");
    throw error;
  } finally {
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
