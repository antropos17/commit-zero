import { mkdir, readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("disabled role catalog stays inspectable at desktop and narrow widths", async ({ page }) => {
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/agent-catalog");
  await expect(page.getByRole("heading", { name: "Proposed agent roles" })).toBeVisible();
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(18);
  await expect(page.getByRole("link", { name: "Proposed roles", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a role" }).fill("Qwen");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Model identity evidence" }).selectOption("documented");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("link", { name: "Qwen Local Reviewer", exact: true }).click();
  await expect(page.locator(".agent-readiness")).toContainText("qwen-local-reviewer");
  await expect(page.locator(".agent-readiness")).toContainText("Pinned local artifact");
  await expect(page.locator(".agent-readiness")).toContainText("509287f78cb4d4cf6b3843734733b914b2c158e43e22a7f4bf5e963800894d3c");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Model identity evidence" }).selectOption("unresolved-model-id");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Find a role" }).fill("Gemma");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Find a role" }).fill("no-such-role");
  await expect(page.getByText("No roles match these filters.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a role" }).fill("");
  await page.getByRole("combobox", { name: "Model identity evidence" }).selectOption("documented");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(14);
  await page.getByRole("combobox", { name: "Model identity evidence" }).selectOption("all");
  await page.getByRole("link", { name: "Fable Architect", exact: true }).click();
  await expect(page.locator(".agent-readiness")).toContainText("claude-fable-5-1");
  await expect(page.locator(".agent-readiness button")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Deterministic host fixture" }))
    .toContainText("Migration 001 is applied");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download fixture JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fable-architect-fixture.json");
  await mkdir(".cache/tmp", { recursive: true });
  await download.saveAs(".cache/tmp/catalog-fixture-download.json");
  const fixture = JSON.parse(await readFile(".cache/tmp/catalog-fixture-download.json", "utf8"));
  expect(fixture.profileId).toBe("fable-architect");
  expect(fixture.modelCalls).toBe(0);
  expect(fixture.exampleOutput.runtimeVerified).toBe(false);
  expect(fixture.expected.allowedEvidence).toEqual(["fixture/storage.md:1"]);
  if (process.env.CZ_CAPTURE_AGENT_FIXTURE === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.getByRole("region", { name: "Deterministic host fixture" })
      .screenshot({ path: "runtime/verification/agent-fixture-section-2026-10-19.png" });
  }
  const desktop = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(desktop.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/agent-catalog-desktop-2026-10-19.png", fullPage: true });
  }
  if (process.env.CZ_CAPTURE_QWEN_IDENTITY === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/catalog-pinned-identity-desktop-2026-10-19.png", fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".agent-readiness h2").first()).toHaveText("Fable Architect");
  await page.getByRole("link", { name: "Llama Librarian", exact: true }).click();
  await expect(page.locator(".agent-readiness h2").first()).toHaveText("Llama Librarian");
  await expect(page.locator(".agent-readiness h2").first()).toBeFocused();
  expect(await page.locator(".agent-readiness h2").first().evaluate((heading) => {
    const rect = heading.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  })).toBe(true);
  await page.getByRole("link", { name: "Qwen Local Builder", exact: true }).click();
  await expect(page.locator(".agent-readiness h2").first()).toHaveText("Qwen Local Builder");
  await expect(page.locator(".agent-readiness")).toContainText("Pinned local artifact");
  await expect(page.locator(".agent-readiness")).toContainText("Tokenizer and hardware fit remain unverified");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const narrow = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(narrow.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_QWEN_IDENTITY === "1")
    await page.locator(".agent-readiness").screenshot({ path: "runtime/verification/qwen-identity-details-narrow-2026-10-19.png" });
  if (process.env.CZ_CAPTURE_BROWSER === "1")
    await page.screenshot({ path: "runtime/verification/agent-catalog-narrow-2026-10-19.png", fullPage: true });
  await page.goto("/#/sandbox");
  await expect(page.getByRole("heading", { name: "Code runner readiness" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Docker execution is not connected");
  await expect(page.getByRole("region", { name: "Seeded Commons example" }))
    .toContainText("Fixture only · seed 17 · no model inference");
  await expect(page.getByRole("region", { name: "Seeded Commons example" }))
    .toContainText("48 events across 16 cursor pages");
  await expect(page.locator("main button")).toHaveCount(1);
  if (process.env.CZ_CAPTURE_BROWSER === "1")
    await page.screenshot({ path: "runtime/verification/environment-fixture-narrow-2026-10-19.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
