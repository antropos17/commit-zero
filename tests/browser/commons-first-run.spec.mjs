import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("model-free first run creates and retains project, issue, and discussion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/commons");
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.getByRole("region", { name: "New project" });
  await form.getByLabel("Project address").fill("browser-first-run");
  await form.getByLabel("Project name").fill("Browser First Run");
  await form.getByLabel("Description").fill("A disposable project created without model inference.");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/#\/commons\/browser-first-run$/);
  await expect(page.getByRole("heading", { name: "Browser First Run", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await page.getByLabel("Issue title").fill("Handle empty input");
  await page.getByLabel("Problem and expected behavior")
    .fill("An empty argument should return a bounded error rather than throwing.");
  await page.getByRole("button", { name: "Open issue" }).click();
  await expect(page.getByRole("heading", { name: /#1 Handle empty input/ })).toBeVisible();
  await page.getByRole("button", { name: "Create task from issue" }).click();
  await expect(page.getByRole("region", { name: "New task" })).toContainText("Issue #1: Handle empty input");
  await expect(page.getByLabel("Task", { exact: true }))
    .toHaveValue("Investigate and resolve issue #1: Handle empty input");
  await expect(page.getByRole("button", { name: "Run agents", exact: true })).toBeDisabled();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("A model-free project discussion.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved messages" }))
    .toContainText("A model-free project discussion.");
  const desktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(desktopAxe.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/commons-first-run-desktop-2026-10-19.png" });
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Browser First Run", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved messages" }))
    .toContainText("A model-free project discussion.");
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await expect(page.getByRole("heading", { name: /#1 Handle empty input/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const narrowAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(narrowAxe.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await page.screenshot({ path: "runtime/verification/commons-first-run-narrow-2026-10-19.png", fullPage: true });
  }
  await page.getByRole("combobox", { name: "Color theme" }).selectOption("dark");
  const darkAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(darkAxe.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await page.screenshot({ path: "runtime/verification/commons-first-run-narrow-dark-2026-10-19.png", fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("two tabs recover a stale Commons write without losing the draft", async ({ page, context }) => {
  await page.goto("/#/commons/safe-timer?view=discussion");
  const second = await context.newPage();
  await second.goto("/#/commons/safe-timer?view=discussion");
  await expect(second.getByRole("heading", { name: "safe-timer", exact: true })).toBeVisible();
  await second.getByRole("button", { name: "Pause updates" }).click();
  await second.getByLabel("Message", { exact: true }).fill("Second tab keeps this draft after a conflict.");

  await page.getByLabel("Message", { exact: true }).fill("First tab commits a competing edit.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved messages" }))
    .toContainText("First tab commits a competing edit.");

  const stale = second.waitForResponse((response) =>
    response.url().endsWith("/api/commons/messages") &&
    response.request().method() === "POST",
  );
  await second.getByRole("button", { name: "Send", exact: true }).click();
  expect((await stale).status()).toBe(409);
  await expect(second.getByLabel("Message", { exact: true }))
    .toHaveValue("Second tab keeps this draft after a conflict.");
  await expect(second.getByRole("alert")).toBeVisible();
  await expect(second.getByRole("button", { name: "Send", exact: true })).toBeEnabled();

  const retry = second.waitForResponse((response) =>
    response.url().endsWith("/api/commons/messages") &&
    response.request().method() === "POST",
  );
  await second.getByRole("button", { name: "Send", exact: true }).click();
  expect((await retry).status()).toBe(200);
  await expect(second.getByRole("region", { name: "Saved messages" }))
    .toContainText("Second tab keeps this draft after a conflict.");
  await second.close();
});

test("workspace loads after an initial connection failure and explicit retry", async ({ page }) => {
  // Freeze polling timers so this journey proves the explicit retry action.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let attempts = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/commons?runId=*", async (route) => {
    if (++attempts === 1) return route.abort("failed");
    await gate;
    return route.continue();
  });
  try {
    await page.goto("/#/commons/safe-timer");
    const failure = page.getByRole("alert").filter({ hasText: "Cannot reach the service." });
    await expect(failure).toBeVisible();
    const section = page.locator("main section[aria-busy]");
    await expect(section).toHaveAttribute("aria-busy", "false");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await retry.click();
    await expect(section).toHaveAttribute("aria-busy", "true");
    await expect(retry).toBeDisabled();
    expect(attempts).toBe(2);
    const recovered = page.waitForResponse((response) => response.url().includes("/api/commons?runId=") && response.status() === 200);
    release();
    await recovered;
    await expect(page.getByRole("heading", { name: "safe-timer", exact: true })).toBeVisible();
    await expect(retry).toHaveCount(0);
    await page.clock.resume();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations).toEqual([]);
  } finally { release(); }
});
