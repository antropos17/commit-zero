import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { request } from "../prototype/app/api.mjs";

async function fixture(t, handler, onResponse) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (path, options) => {
    const response = await realFetch(new URL(path, origin), options);
    onResponse?.();
    return response;
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
}

test("browser requests retain HTTP failure details for dependency recovery", async (t) => {
  const body = {
    message: "Fixture dependency unavailable.",
    services: { workspace: { status: "unavailable" } },
  };
  await fixture(t, (_req, res) => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await assert.rejects(request("health"), (error) => {
    assert.equal(error.status, 503);
    assert.deepEqual(error.details, body);
    assert.equal(error.message, body.message);
    return true;
  });
});

test("a supplied deadline also bounds reading an unfinished JSON body", async (t) => {
  let receivedHeaders = false;
  await fixture(
    t,
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"unfinished":');
    },
    () => {
      receivedHeaders = true;
    },
  );
  await assert.rejects(
    request("fixture", { signal: AbortSignal.timeout(1000) }),
    (error) => {
      assert.equal(error.status, 0);
      assert.match(error.message, /request timed out/i);
      return true;
    },
  );
  assert.equal(receivedHeaders, true);
});

test("caller cancellation stays distinguishable from a failed connection", async (t) => {
  const controller = new AbortController();
  await fixture(
    t,
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"unfinished":');
    },
    () => controller.abort(),
  );
  await assert.rejects(request("fixture", { signal: controller.signal }), {
    name: "AbortError",
  });
});

test("invalid service JSON produces an explicit recoverable response error", async (t) => {
  await fixture(t, (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{");
  });
  await assert.rejects(request("fixture"), (error) => {
    assert.equal(error.status, 0);
    assert.match(error.message, /invalid JSON response/);
    return true;
  });
});
