import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, copyFile, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { connectDatabase } from "../server/database.mjs";
import { WorkspaceStore } from "../server/store.mjs";
import { CommonsStore, record } from "../server/commons/store.mjs";
import { createApp } from "../server/app.mjs";
import { createGateway } from "../services/gateway.mjs";
import { ExperimentStore } from "../server/lab/store.mjs";
import { revisionTag, versionFromTag } from "../shared/revisions.mjs";

test("Commons migration preserves all legacy evidence across restart and writes only changed records", async () => {
  const root = resolve(".cache/tmp");
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(join(root, "storage-"));
  assert.ok(folder.startsWith(root + sep));
  const migrations = join(folder, "migrations"),
    directory = join(folder, "database");
  let db;
  try {
    await mkdir(migrations);
    for (const name of [
      "001_workspace.sql",
      "002_experiments.sql",
      "003_commons.sql",
    ])
      await copyFile(join("db/migrations", name), join(migrations, name));
    db = await connectDatabase({
      url: null,
      directory,
      migrations: pathToFileURL(migrations + sep),
    });
    const workspace = new WorkspaceStore(db);
    await workspace.initialize();
    const id = (await workspace.read()).runId;
    const original = await new CommonsStore(db, workspace).initial(id);
    const jobId = randomUUID();
    original.jobs.push({
      id: jobId,
      status: "completed",
      repoId: "safe-timer",
      responses: [{ text: "retained raw output", provenance: "test_fixture" }],
    });
    record(original, "message", "builder", "safe-timer", "Retained context", {
      jobId,
    });
    original.jobs[0].sourceMessageId = original.events[0].id;
    original.version = 4;
    await db.query("INSERT INTO commons(run_id,document) VALUES($1,$2)", [
      id,
      JSON.stringify(original),
    ]);
    await db.close();
    db = null;
    db = await connectDatabase({ url: null, directory });
    const sql = [];
    const instrumented = {
      ...db,
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({
            query: (query, values) => {
              sql.push(query);
              return tx.query(query, values);
            },
          }),
        ),
    };
    const store = new CommonsStore(instrumented, new WorkspaceStore(db));
    assert.deepEqual(await store.read(id), original);
    assert.equal(
      (await db.query("SELECT document FROM commons WHERE run_id=$1", [id]))
        .rows[0].document.events,
      undefined,
    );
    sql.length = 0;
    assert.equal(await store.read(id, 4), null);
    assert.equal(sql.length, 1);
    assert.ok(!sql[0].includes("commons_events"));
    const view = await store.read(id);
    view.events[0].text = "tampered view";
    assert.deepEqual(await store.read(id), original);
    sql.length = 0;
    const changed = await store.change(id, 4, (state) =>
      record(state, "message", "operator", "", "New message"),
    );
    assert.equal(changed.version, 5);
    assert.equal(
      sql.filter((query) => /INSERT INTO commons_events/.test(query)).length,
      1,
    );
    assert.equal(
      sql.filter((query) => /INSERT INTO commons_(jobs|projects)/.test(query))
        .length,
      0,
    );
    await assert.rejects(
      () =>
        store.change(id, 5, (state) => {
          state.events[0].text = "rewrite history";
        }),
      /append-only/,
    );
    assert.deepEqual(await store.read(id), changed);
    const competitor = new CommonsStore(db, new WorkspaceStore(db));
    const writes = await Promise.allSettled([
      store.change(id, 5, (state) =>
        record(state, "message", "operator", "", "One"),
      ),
      competitor.change(id, 5, (state) =>
        record(state, "message", "operator", "", "Two"),
      ),
    ]);
    assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      writes.find((r) => r.status === "rejected").reason.statusCode,
      409,
    );
    assert.equal((await store.read(id)).version, 6);
    await store.change(id, 6, (state) =>
      state.jobs.push({
        id: randomUUID(),
        status: "running",
        repoId: "safe-timer",
      }),
    );
    await competitor.recover();
    assert.equal((await store.read(id)).jobs[1].status, "interrupted");
    const final = await store.read(id);
    await db.close();
    db = null;
    db = await connectDatabase({ url: null, directory });
    assert.deepEqual(
      await new CommonsStore(db, new WorkspaceStore(db)).read(id),
      final,
    );
  } finally {
    await db?.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("Conditional reads cross the gateway, remain run-scoped, invalidate on writes and preserve lab exports", async (t) => {
  const db = await connectDatabase({ memory: true, url: null });
  const app = await createApp({ db });
  const gateway = await createGateway({
    services: { workspace: "http://workspace" },
    transport: async (url, options) => {
      const response = await app.inject({
        method: options.method,
        url: new URL(url).pathname + new URL(url).search,
        payload: options.body,
        headers: { host: "localhost", ...options.headers },
      });
      return new Response(response.body || null, {
        status: response.statusCode,
        headers: response.headers,
      });
    },
  });
  t.after(async () => {
    await gateway.close();
    await app.close();
  });
  const get = (url, etag) =>
    gateway.inject({
      url,
      headers: {
        host: "localhost",
        ...(etag ? { "if-none-match": etag } : {}),
      },
    });
  const id = (await get("/api/state")).json().runId;
  const url = `/api/commons?runId=${id}`;
  // A lazy initial snapshot is not immutable at commons revision zero.
  assert.equal((await get(url, revisionTag("commons", id, 0))).statusCode, 200);
  await gateway.inject({
    method: "POST",
    url: "/api/commons/messages",
    headers: { host: "localhost", "x-commit-zero": "local-demo" },
    payload: { runId: id, version: 0, repoId: "", message: "Start history" },
  });
  const first = await get(url);
  const unchanged = await get(url, first.headers.etag);
  assert.equal(unchanged.statusCode, 304);
  assert.equal(unchanged.body, "");
  assert.equal(unchanged.headers.etag, first.headers.etag);
  assert.equal((await get(url, revisionTag("lab", id, 1))).statusCode, 200);
  assert.equal(
    versionFromTag(revisionTag("commons", id, 1), "commons", randomUUID()),
    undefined,
  );
  await gateway.inject({
    method: "POST",
    url: "/api/commons/messages",
    headers: { host: "localhost", "x-commit-zero": "local-demo" },
    payload: { runId: id, version: 1, repoId: "", message: "Change" },
  });
  const changed = await get(url, first.headers.etag);
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().version, 2);
  assert.notEqual(changed.headers.etag, first.headers.etag);
  const firstPage = (
    await get(`/api/commons/events?runId=${id}&limit=1`)
  ).json();
  assert.equal(firstPage.events.length, 1);
  assert.equal(firstPage.hasMore, true);
  const secondPage = (
    await get(
      `/api/commons/events?runId=${id}&limit=1&after=${firstPage.nextAfter}`,
    )
  ).json();
  assert.equal(secondPage.hasMore, false);
  assert.deepEqual(
    [...firstPage.events, ...secondPage.events],
    changed.json().events,
  );
  assert.equal(
    (await get(`/api/commons/events?runId=${id}&limit=101`)).statusCode,
    400,
  );
  assert.equal(
    (await get(`/api/commons/events?runId=${id}&after=-1`)).statusCode,
    400,
  );
  const absent = randomUUID();
  assert.equal(
    (await get(`/api/commons/events?runId=${absent}`)).statusCode,
    404,
  );
  assert.equal(
    (
      await get(
        `/api/commons?runId=${absent}`,
        revisionTag("commons", absent, 0),
      )
    ).statusCode,
    404,
  );
  const lab = new ExperimentStore(db);
  const experiment = await lab.create("fixture", "test_fixture");
  await lab.event(
    experiment.id,
    "runner",
    "done",
    "Fixture",
    {},
    {
      status: "completed",
      artifact: { name: "fixture.json", content: { preserved: true } },
    },
  );
  const labUrl = `/api/lab/runs/${experiment.id}`;
  const sample = await get(labUrl);
  assert.equal((await get(labUrl, sample.headers.etag)).statusCode, 304);
  const exported = await get(`${labUrl}/export`, sample.headers.etag);
  assert.equal(exported.statusCode, 200);
  assert.ok(exported.body.includes('"preserved":true'));
});
