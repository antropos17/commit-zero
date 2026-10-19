import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { connectDatabase } from "../server/database.mjs";
import { WorkspaceStore } from "../server/store.mjs";

test("PGlite survives a close/reopen and rejects a second writer process", async () => {
  const root = resolve("runtime/tests");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "persistence-"));
  let db;
  assert.ok(
    directory.startsWith(root + (process.platform === "win32" ? "\\" : "/")),
  );
  try {
    db = await connectDatabase({ directory, url: null });
    const store = new WorkspaceStore(db);
    await store.initialize();
    const original = await store.read();
    await store.change({ runId: original.runId, version: 0 });
    await assert.rejects(
      () => connectDatabase({ directory, url: null }),
      /already being held/i,
    );
    await db.close();
    db = null;
    db = await connectDatabase({ directory, url: null });
    const reopened = await new WorkspaceStore(db).read();
    assert.equal(reopened.runId, original.runId);
    assert.equal(reopened.step, 1);
    assert.equal(reopened.version, 1);
  } finally {
    await db?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
