import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { browserTools } from "./browser-runtime.mjs";
import { startServices } from "./services.mjs";
import { fingerprint } from "./project-files.mjs";

const { values } = parseArgs({ options: {
  history: { type: "string", default: "1000" },
  samples: { type: "string", default: "5" },
} });
const history = Number(values.history), samples = Number(values.samples);
if (!Number.isInteger(history) || history < 1 || history > 5000 ||
    !Number.isInteger(samples) || samples < 1 || samples > 20)
  throw new Error("Use --history 1..5000 and --samples 1..20.");

// A routed, read-only browser fixture measures client rendering, not storage or
// provider throughput. Every service uses disposable in-memory databases.
const { chromium } = await browserTools();
const cluster = await startServices({ memory: true, staticRoot: "dist",
  ports: { gateway: 0, workspace: 0, identity: 0, ranking: 0 } });
let browser;
try {
  const state = await fetch(`${cluster.url}/api/state`).then((r) => r.json());
  const fixture = await fetch(`${cluster.url}/api/commons?runId=${state.runId}`)
    .then((r) => r.json());
  fixture.version = 1;
  fixture.events = Array.from({ length: history }, (_, index) => ({
    id: `ui-benchmark-${index}`, sequence: index + 1,
    at: "2026-01-01T00:00:00.000Z", type: "message", actor: "operator",
    actorName: "Simulated benchmark participant", repoId: "",
    text: `Fixture message ${index + 1}: ${"Retained discussion context. ".repeat(25)}`,
  }));
  const body = JSON.stringify(fixture);
  browser = await chromium.launch(process.env.CZ_BROWSER_EXECUTABLE
    ? { executablePath: process.env.CZ_BROWSER_EXECUTABLE } : {});
  const results = [];
  for (let index = 0; index <= samples; index++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/commons?**", (route) => route.fulfill({
        status: 200, contentType: "application/json", body,
      }));
      await page.route("**/api/commons/provider", (route) => route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ available: false, reason: "Offline benchmark fixture" }),
      }));
      const start = performance.now();
      await page.goto(`${cluster.url}/#/commons`);
      await page.waitForFunction((text) =>
        Array.from(globalThis.document.querySelectorAll(".commons-message p"))
          .some((node) => node.textContent === text), fixture.events.at(-1).text);
      const readyMs = performance.now() - start;
      const metrics = await page.evaluate(() => ({
        renderedMessages: globalThis.document.querySelectorAll(".commons-message").length,
        domElements: globalThis.document.querySelectorAll("*").length,
        chatScrollHeight: globalThis.document.querySelector(".commons-messages").scrollHeight,
      }));
      if (errors.length) throw new Error(errors.join("\n"));
      if (index > 0) results.push({ readyMs, ...metrics });
    } finally { await context.close(); }
  }
  const sorted = results.map((sample) => sample.readyMs).sort((a, b) => a - b);
  const report = {
    at: new Date().toISOString(), sourceHash: await fingerprint(process.cwd()),
    commonsModuleSha256: createHash("sha256")
      .update(await readFile("prototype/app/pages/commons.jsx")).digest("hex"),
    environment: { node: process.version, browser: browser.version(), platform: process.platform,
      viewport: "1440x900", disposableServices: true, routedReadOnlyFixture: true },
    fixture: { messages: history, responseBytes: Buffer.byteLength(body) },
    warmups: 1, samples, p50Ms: sorted[Math.ceil(samples * 0.5) - 1],
    p95Ms: sorted[Math.ceil(samples * 0.95) - 1], results,
    limits: "Cold browser contexts on one local host. Includes application bootstrap and routed snapshot parsing/rendering. No retained-store read, inference, network throughput or provider benchmark. Small sample timings are descriptive, not a service-level claim.",
  };
  await mkdir(".cache/verification", { recursive: true });
  await writeFile(".cache/verification/latest-ui-benchmark.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await cluster.close();
}
