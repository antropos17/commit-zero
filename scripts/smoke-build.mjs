import assert from "node:assert/strict";
import { connectDatabase } from "../server/database.mjs";
import { createApp } from "../server/app.mjs";
const db = await connectDatabase({ memory: true, url: null });
const app = await createApp({ db, staticRoot: "dist" });
const get = (url) => app.inject({ url, headers: { host: "127.0.0.1:4173" } });
try {
  const page = await get("/");
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /Commit Zero/);
  const assets = [
    ...page.body.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((m) => m[1]);
  assert.ok(assets.length >= 2);
  for (const asset of [
    ...assets,
    "/assets/openai.svg",
    "/assets/commit-zero.svg",
  ])
    assert.equal((await get(asset)).statusCode, 200, asset);
  for (const blocked of [
    "/.env",
    "/package.json",
    "/server/app.mjs",
    "/@fs/X:/ai-github/.env",
  ])
    assert.ok([403, 404].includes((await get(blocked)).statusCode), blocked);
  assert.equal((await get("/api/health")).json().status, "ok");
  console.log(
    "Production serving: React HTML, bundled assets and API pass; source/config paths stay outside the static root.",
  );
} finally {
  await app.close();
}
