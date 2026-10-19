import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { startServices } from "./services.mjs";
import { fingerprint } from "./project-files.mjs";

const output = "runtime/verification/launch-assets";
await mkdir(output, { recursive: true });
const startedAt = new Date().toISOString();
await writeFile(`${output}/manifest.json`, JSON.stringify({ status: "running", startedAt }) + "\n");
let browser, cluster;
try {
  cluster = await startServices({ memory: true, staticRoot: "dist",
    ports: { gateway: 0, workspace: 0, identity: 0, ranking: 0 } });
  browser = await chromium.launch(process.env.CZ_BROWSER_EXECUTABLE
    ? { executablePath: process.env.CZ_BROWSER_EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: 1270, height: 760 }, colorScheme: "light" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${cluster.url}/#/home`);
  const icon = new URL(await page.locator('link[rel="icon"]').getAttribute("href"), page.url()).href;
  for (let step = 1; step <= 10; step++) {
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await expect(page.locator("#playback-status")).toHaveText(`Step ${step} / 10`);
  }
  await page.goto(`${cluster.url}/#/pr/12`);
  await page.getByRole("link", { name: /Files changed/ }).click();
  await expect(page.getByRole("region", { name: "Code changes" })).toContainText("Math.min");
  await page.screenshot({ path: `${output}/scenario-pr.png` });

  await page.goto(`${cluster.url}/#/commons`);
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.getByRole("region", { name: "New project" });
  await form.getByLabel("Project address").fill("launch-first-run");
  await form.getByLabel("Project name").fill("Model-free first run");
  await form.getByLabel("Description").fill("A disposable local project created without model inference.");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Model-free first run", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await page.getByLabel("Issue title").fill("Handle empty input");
  await page.getByLabel("Problem and expected behavior")
    .fill("An empty argument should return a clear result. Preserve the public API and add a focused regression case.");
  await page.getByRole("button", { name: "Open issue", exact: true }).click();
  await expect(page.getByRole("heading", { name: /#1 Handle empty input/ })).toBeVisible();
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/commons-first-run.png` });

  await page.setViewportSize({ width: 240, height: 240 });
  await page.goto(icon);
  await page.screenshot({ path: `${output}/thumbnail.png` });
  if (errors.length) throw new Error(errors.join("\n"));
  const captions = {
    "scenario-pr": "Deterministic repository example after ten steps. Simulated author, review and checks; no model inference.",
    "commons-first-run": "Actual project and issue created through local HTTP handlers in disposable services; no model task started.",
    thumbnail: "The application's current SVG commit mark rendered by Chrome at 240x240 in light mode.",
  };
  const assets = [];
  for (const [name, caption] of Object.entries(captions)) {
    const bytes = await readFile(`${output}/${name}.png`);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    const expected = name === "thumbnail" ? [240, 240] : [1270, 760];
    if (width !== expected[0] || height !== expected[1] || bytes.length >= 3_000_000)
      throw new Error(`Unexpected launch asset dimensions or size: ${name}`);
    assets.push({ file: `${name}.png`, width, height, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), caption });
  }
  const manifest = { status: "captured", startedAt, at: new Date().toISOString(),
    sourceHash: await fingerprint(process.cwd()), browser: browser.version(),
    scope: "Real viewport captures; disposable in-memory services. No compositing, model calls, retained-store writes or external submissions.", assets };
  await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify(manifest, null, 2));
} catch (error) {
  await writeFile(`${output}/manifest.json`, JSON.stringify({ status: "failed", startedAt,
    at: new Date().toISOString(), error: error.message }, null, 2) + "\n");
  throw error;
} finally {
  try { await browser?.close(); } finally { await cluster?.close(); }
}
