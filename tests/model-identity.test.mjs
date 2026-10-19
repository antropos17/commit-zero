import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { inspectModelArtifact } from "../scripts/model-identity.mjs";

async function fixture(t) {
  const base = resolve(".cache/tmp");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, "model-identity-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(base + sep));
    await rm(directory, { recursive: true, force: true });
  });
  const bytes = Buffer.from("Synthetic file identity fixture, not a model.\n");
  const artifact = { id: "synthetic-fixture", filename: "fixture.gguf", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  await writeFile(join(directory, artifact.filename), bytes);
  return { directory, artifact, bytes };
}

test("artifact metadata and digest checks remain distinct from model readiness", async (t) => {
  const { directory, artifact } = await fixture(t);
  const metadata = await inspectModelArtifact(directory, artifact);
  assert.equal(metadata.identityStatus, "metadata-only");
  assert.equal(metadata.digestVerified, false);
  assert.equal(metadata.hashedBytes, 0);
  const hashed = await inspectModelArtifact(directory, artifact, { hash: true });
  assert.equal(hashed.identityStatus, "digest-matched");
  assert.equal(hashed.digestVerified, true);
  assert.equal(hashed.hashedBytes, artifact.bytes);
  for (const key of ["providerProbed", "modelLoaded", "runtimeVerified", "inferenceStarted"])
    assert.equal(hashed[key], false);
});

test("artifact checks reject missing, changed, wrong-size and escaping inputs", async (t) => {
  const { directory, artifact, bytes } = await fixture(t);
  assert.equal((await inspectModelArtifact(directory, { ...artifact, filename: "missing.gguf" })).identityStatus, "missing");
  await writeFile(join(directory, artifact.filename), Buffer.alloc(bytes.length, 32));
  assert.equal((await inspectModelArtifact(directory, artifact, { hash: true })).identityStatus, "digest-mismatch");
  await writeFile(join(directory, artifact.filename), "short");
  assert.equal((await inspectModelArtifact(directory, artifact)).identityStatus, "size-mismatch");
  await assert.rejects(inspectModelArtifact(directory, { ...artifact, filename: "../fixture.gguf" }), /bounded/);
  await assert.rejects(inspectModelArtifact(directory, { ...artifact, filename: "CON.gguf" }), /bounded/);
});

test("cancelled artifact inspection returns no digest qualification and releases the file", async (t) => {
  const { directory, artifact } = await fixture(t);
  const controller = new AbortController(); controller.abort();
  const result = await inspectModelArtifact(directory, artifact, { hash: true, signal: controller.signal });
  assert.equal(result.identityStatus, "cancelled");
  assert.equal(result.digestVerified, false);
  await rm(join(directory, artifact.filename));
  assert.equal((await inspectModelArtifact(directory, artifact)).identityStatus, "missing");
});
