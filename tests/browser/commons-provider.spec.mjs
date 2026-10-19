import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("workspace recovers provider health without starting a model task", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/commons/safe-timer?view=tasks");
  const run = page.getByRole("button", { name: "Run agents", exact: true });
  const check = page.getByRole("button", { name: "Check model", exact: true });
  const status = page.locator(".commons-actions .commons-meta[role=status]");
  await expect(check).toBeVisible();
  await expect(run).toBeDisabled();
  await expect(status).toContainText(/offline|unavailable|not running/i);
  await page.getByLabel("Task", { exact: true }).fill("Keep this draft while provider health changes.");
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/commons-provider-offline-desktop-2026-10-19.png", fullPage: true });
  }
  await page.route("**/api/commons/provider", (route) => route.abort("failed"));
  await check.click();
  await expect(status).toContainText("Model status unavailable");
  await expect(run).toBeDisabled();
  await page.unrouteAll();
  await page.route("**/api/commons/provider", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ available: true, busy: false, name: "fixture-health-only" }),
  }));
  await check.click();
  await expect(status).toContainText("Builder then Reviewer");
  await expect(run).toBeEnabled();
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue("Keep this draft while provider health changes.");
  await page.route("**/api/commons/provider", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ available: true, busy: true }),
  }));
  await check.click();
  await expect(status).toContainText("Local model is busy");
  await expect(run).toBeDisabled();
  await page.route("**/api/commons/provider", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ available: false, busy: false, reason: "Simulated provider stopped." }),
  }));
  await check.click();
  await expect(status).toContainText("Simulated provider stopped.");
  await expect(run).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
