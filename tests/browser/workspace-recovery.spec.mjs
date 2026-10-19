import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("initial workspace failure settles busy state and keyboard retry restores content focus", async ({ page }) => {
  let attempts = 0, release;
  const retryGate = new Promise((resolve) => { release = resolve; });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/state", async (route) => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ message: "Fixture workspace connection unavailable." }) });
    if (attempts === 2) await retryGate;
    return route.continue();
  });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#/home");
    const main = page.locator("main");
    await expect(page.getByRole("heading", { name: "Workspace unavailable", exact: true })).toBeVisible();
    await expect(main).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#playback-status")).toHaveText("Unavailable");
    await expect(page.locator("#connection-label")).toHaveText("Connection unavailable");
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(navigation.locator("a")).toHaveCount(14);
    if (process.env.CZ_CAPTURE_WORKSPACE_RECOVERY === "1") {
      await mkdir("runtime/verification", { recursive: true });
      await page.screenshot({ path: "runtime/verification/workspace-unavailable-desktop-2026-10-19.png" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const failed = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(failed.violations).toEqual([]);
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await expect(main).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(retry).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(main).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { name: "Loading workspace", exact: true })).toBeVisible();
    await expect(page.locator("#playback-status")).toHaveText("Loading…");
    await expect(page.locator("#connection-label")).toHaveText("Syncing…");
    const recovered = page.waitForResponse((response) => response.url().endsWith("/api/state") && response.status() === 200);
    release();
    await recovered;
    await expect(page.getByRole("heading", { name: "Workspace overview", exact: true })).toBeVisible();
    await expect(main).toHaveAttribute("aria-busy", "false");
    await expect(main).toBeFocused();
    await expect(navigation.locator("a")).toHaveCount(14);
    const ready = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(ready.violations).toEqual([]);
    expect(errors).toEqual([]);
  } finally { release(); }
});
