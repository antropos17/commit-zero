import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createTestSystem } from "./harness.mjs";
import {
  createIdentityApp,
  identityDatabase,
} from "../services/identity/app.mjs";
import { oauthConfig } from "../services/identity/oauth.mjs";

const headers = { host: "localhost", "x-commit-zero": "local-demo" };
test("Timeline pagination and agent protocol preserve event identity, scope and revisions", async (t) => {
  const system = await createTestSystem();
  t.after(() => system.close());
  const call = (method, url, payload) =>
    system.gateway.inject({ method, url, payload, headers });
  const initial = (await call("GET", "/api/state")).json();
  const first = (await call("GET", "/api/timeline?limit=2")).json();
  assert.equal(first.items.length, 2);
  assert.equal(first.total, 4);
  const second = (
    await call("GET", `/api/timeline?before=${first.nextBefore}&limit=2`)
  ).json();
  assert.equal(
    new Set([...first.items, ...second.items].map((e) => e.id)).size,
    4,
  );
  assert.equal(second.nextBefore, null);
  const filtered = (
    await call("GET", "/api/timeline?actor=claude&repo=orbit&kind=pr")
  ).json();
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].pr, 12);
  assert.ok(
    filtered.items.every((e) => e.provenance === "simulation" && e.recordedAt),
  );
  assert.equal((await call("GET", "/api/timeline?limit=101")).statusCode, 400);
  assert.equal(
    (await call("GET", "/api/timeline?kind=run-shell")).statusCode,
    400,
  );
  const envelope = {
    protocol: "cz-agent/1",
    requestId: randomUUID(),
    runId: initial.runId,
    revision: initial.version,
    operation: "repository.read",
    arguments: { repository: "orbit" },
  };
  const read = await call("POST", "/api/agent/v1/query", envelope);
  assert.equal(read.statusCode, 200, read.body);
  assert.ok(read.json().result.files["orbit.js"]);
  assert.equal(
    (
      await call("POST", "/api/agent/v1/query", {
        ...envelope,
        arguments: { repository: "orbit", shell: "whoami" },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call("POST", "/api/agent/v1/query", {
        ...envelope,
        operation: "repository.write",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call("POST", "/api/agent/v1/query", {
        ...envelope,
        operation: "change.read",
        arguments: { number: 12 },
      })
    ).statusCode,
    200,
  );
  assert.equal((await call("GET", "/api/agent/v1")).json().mutations, false);
  await call("POST", "/api/advance", {
    runId: initial.runId,
    version: initial.version,
  });
  const updated = (await call("GET", "/api/timeline")).json();
  assert.equal(updated.version, 1);
  assert.equal(updated.total, 5);
  assert.deepEqual(
    updated.items.slice(1).map((e) => e.id),
    [...first.items, ...second.items].map((e) => e.id),
  );
  assert.equal(
    (await call("POST", "/api/agent/v1/query", envelope)).statusCode,
    409,
  );
  await call("POST", "/api/runs", { runId: initial.runId, version: 1 });
  const historical = (
    await call("GET", `/api/timeline?runId=${initial.runId}`)
  ).json();
  assert.equal(historical.total, 5);
  assert.equal(historical.runId, initial.runId);
  assert.notEqual(
    (await call("GET", "/api/timeline")).json().runId,
    initial.runId,
  );
});

test("OAuth code flow validates browser/state, PKCE, provider identity and single-use callbacks through gateway", async (t) => {
  const calls = [];
  let fail = false;
  const config = oauthConfig({
    OAUTH_ORIGIN: "http://localhost",
    GITHUB_CLIENT_ID: "github-client",
    GITHUB_CLIENT_SECRET: "github-secret",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
  });
  const system = await createTestSystem({
    oauth: {
      config,
      transport: async (url, options) => {
        calls.push({ url, options });
        if (fail)
          return new Response(
            JSON.stringify({ error: "secret-provider-error" }),
            { status: 500 },
          );
        if (
          url.includes("access_token") ||
          url.includes("oauth2.googleapis.com/token")
        )
          return Response.json({
            access_token: "provider-token",
            token_type: "bearer",
          });
        return Response.json(
          url.includes("api.github.com")
            ? { id: 123, name: "Same Name", email: "same@example.test" }
            : {
                sub: "google-123",
                name: "Same Name",
                email: "same@example.test",
              },
        );
      },
    },
  });
  t.after(() => system.close());
  const call = (method, url, payload, cookie = "") =>
    system.gateway.inject({
      method,
      url,
      payload,
      headers: { ...headers, cookie },
    });
  const start = async (provider = "github", next = "profile") => {
    const response = await call("POST", `/api/auth/oauth/${provider}/start`, {
      next,
    });
    assert.equal(response.statusCode, 200, response.body);
    const url = new URL(response.json().authorizationUrl);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `http://localhost/api/auth/oauth/${provider}/callback`,
    );
    return {
      url,
      cookie: String(response.headers["set-cookie"]).split(";")[0],
      callback: `/api/auth/oauth/${provider}/callback?state=${url.searchParams.get("state")}&code=one-use-code`,
    };
  };
  const first = await start();
  assert.match(first.cookie, /cz_oauth_github=/);
  const noCookie = await call("GET", first.callback);
  assert.match(noCookie.headers.location, /oauth=invalid/);
  assert.equal(calls.length, 0);
  const wrongState = await call(
    "GET",
    first.callback.replace(/state=[^&]+/, "state=" + "x".repeat(43)),
    undefined,
    first.cookie,
  );
  assert.match(wrongState.headers.location, /oauth=invalid/);
  assert.equal(calls.length, 0);
  const success = await call("GET", first.callback, undefined, first.cookie);
  assert.equal(success.statusCode, 303);
  assert.equal(success.headers["referrer-policy"], "no-referrer");
  assert.equal(success.headers.location, "/#/profile");
  assert.equal(success.headers["set-cookie"].length, 2);
  const session = success.headers["set-cookie"]
    .find((c) => c.startsWith("cz_session="))
    .split(";")[0];
  const account = (
    await call("GET", "/api/auth/session", undefined, session)
  ).json().user;
  assert.equal(account.displayName, "Same Name");
  assert.equal(account.password_hash, undefined);
  const tokenRequest = calls.find((c) => c.url.includes("access_token"));
  const tokenBody = new URLSearchParams(tokenRequest.options.body);
  assert.equal(
    createHash("sha256")
      .update(tokenBody.get("code_verifier"))
      .digest("base64url"),
    first.url.searchParams.get("code_challenge"),
  );
  assert.equal(tokenRequest.options.redirect, "error");
  assert.match(
    (await call("GET", first.callback, undefined, first.cookie)).headers
      .location,
    /oauth=invalid/,
  );
  assert.equal(calls.length, 2);
  const again = await start();
  const repeat = await call("GET", again.callback, undefined, again.cookie);
  const repeatCookie = repeat.headers["set-cookie"]
    .find((c) => c.startsWith("cz_session="))
    .split(";")[0];
  assert.equal(
    (await call("GET", "/api/auth/session", undefined, repeatCookie)).json()
      .user.id,
    account.id,
  );
  const google = await start("google", "agents");
  const other = await call("GET", google.callback, undefined, google.cookie);
  assert.equal(other.headers.location, "/#/my-agents/new");
  const otherCookie = other.headers["set-cookie"]
    .find((c) => c.startsWith("cz_session="))
    .split(";")[0];
  assert.notEqual(
    (await call("GET", "/api/auth/session", undefined, otherCookie)).json().user
      .id,
    account.id,
    "Email/name must never auto-link providers",
  );
  const denied = await start();
  const count = calls.length;
  assert.match(
    (
      await call(
        "GET",
        denied.callback + "&error=access_denied",
        undefined,
        denied.cookie,
      )
    ).headers.location,
    /oauth=cancelled/,
  );
  assert.equal(calls.length, count);
  fail = true;
  const failed = await start();
  const failedResult = await call(
    "GET",
    failed.callback,
    undefined,
    failed.cookie,
  );
  assert.equal(failedResult.headers.location, "/#/login?oauth=failed");
  assert.doesNotMatch(
    failedResult.body,
    /secret-provider-error|provider-token/,
  );
  assert.equal(
    (
      await call("POST", "/api/auth/login", {
        username: account.username,
        password: "cannot-login-with-password",
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await call("POST", "/api/auth/oauth/github/start", {
        next: "https://evil.test",
      })
    ).statusCode,
    400,
  );
});

test("OAuth fails closed when unconfigured, expired or bound to a different provider", async (t) => {
  assert.throws(() => oauthConfig({ OAUTH_ORIGIN: "https://public.example" }));
  const db = await identityDatabase({ memory: true, url: null });
  let providerCalls = 0;
  const app = await createIdentityApp({
    db,
    oauth: {
      config: oauthConfig({
        GITHUB_CLIENT_ID: "id",
        GITHUB_CLIENT_SECRET: "secret",
      }),
      transport: () => {
        providerCalls++;
        throw new Error("Must not call");
      },
    },
  });
  t.after(() => app.close());
  const get = (url, cookie = "") =>
    app.inject({ url, headers: { ...headers, cookie } });
  const providers = (await get("/api/auth/providers")).json().providers;
  assert.equal(providers.find((p) => p.id === "google").available, false);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/oauth/google/start",
        headers,
        payload: { next: "profile" },
      })
    ).statusCode,
    503,
  );
  const started = await app.inject({
    method: "POST",
    url: "/api/auth/oauth/github/start",
    headers,
    payload: { next: "profile" },
  });
  const state = new URL(started.json().authorizationUrl).searchParams.get(
    "state",
  );
  const cookie = String(started.headers["set-cookie"]).split(";")[0];
  await db.query(
    "UPDATE oauth_attempts SET expires_at=now()-interval '1 minute'",
  );
  assert.match(
    (await get(`/api/auth/oauth/github/callback?code=x&state=${state}`, cookie))
      .headers.location,
    /invalid/,
  );
  assert.match(
    (
      await get(
        `/api/auth/oauth/google/callback?code=x&state=${state}`,
        cookie.replace("github", "google"),
      )
    ).headers.location,
    /invalid/,
  );
  assert.equal(providerCalls, 0);
});
