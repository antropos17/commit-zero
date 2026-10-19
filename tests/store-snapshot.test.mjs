import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import lockfile from "proper-lockfile";
import { snapshotStores, verifySnapshot } from "../scripts/store-snapshot.mjs";
test("Cold snapshots refuse active writers, preserve both stores and detect changed or extra files", async () => {
  const root = await mkdtemp(resolve(".cache/tmp/snapshot-test-"));
  try {
    const database = resolve(root, "runtime/database"),
      identity = resolve(root, "runtime/identity");
    await mkdir(database, { recursive: true });
    await mkdir(identity, { recursive: true });
    await writeFile(resolve(database, "data"), "workspace fixture");
    await writeFile(resolve(identity, "data"), "identity fixture");
    const release = await lockfile.lock(database);
    try {
      await assert.rejects(snapshotStores(root), /Stop the services/);
    } finally {
      await release();
    }
    const snapshot = await snapshotStores(root);
    assert.equal(snapshot.files, 2);
    assert.equal(snapshot.status, "verified");
    await writeFile(resolve(snapshot.directory, "database/data"), "changed");
    await assert.rejects(
      verifySnapshot(snapshot.directory),
      /verification failed/,
    );
    await writeFile(
      resolve(snapshot.directory, "database/data"),
      "workspace fixture",
    );
    assert.equal((await verifySnapshot(snapshot.directory)).status, "verified");
    await writeFile(resolve(snapshot.directory, "unexpected"), "extra");
    await assert.rejects(verifySnapshot(snapshot.directory), /file count/);
  } finally {
    assert.ok(root.startsWith(resolve(".cache/tmp") + sep));
    await rm(root, { recursive: true, force: true });
  }
});
