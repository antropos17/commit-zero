import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("simulated pull request keeps discussion, checks, and exact diff inspectable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/home");
  for (let step = 1; step <= 10; step++) {
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await expect(page.locator("#playback-status")).toHaveText(`Step ${step} / 10`);
  }
  await page.goto("/#/pulls");
  await expect(page.locator("main")).toContainText("Clamp elapsed time after returning to the tab");
  await page.getByRole("link", { name: /Clamp elapsed time after returning to the tab/ }).first().click();
  await expect(page.getByRole("region", { name: "Pull request status" }))
    .toContainText("Pull request merged");
  await expect(page.getByRole("region", { name: "Pull request discussion" }))
    .toContainText("Approved");
  await page.getByRole("link", { name: /Checks/ }).click();
  await expect(page.locator("main")).toContainText("Scenario results. No arbitrary-code worker is connected.");
  await page.getByRole("link", { name: /Files changed/ }).click();
  await expect(page.getByRole("region", { name: "Code changes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Code changes" }))
    .toContainText("Math.min");
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/scenario-pr-desktop-2026-10-19.png", fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Scroll code sideways to see complete lines.")).toBeVisible();
  const code = page.getByRole("region", { name: "Code changes" });
  expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await code.focus();
  await code.press("ArrowRight");
  await expect.poll(() => code.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1")
    await page.screenshot({ path: "runtime/verification/scenario-pr-narrow-2026-10-19.png", fullPage: true });
  expect(errors).toEqual([]);
});
