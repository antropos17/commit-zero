import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("disabled role catalog stays inspectable at desktop and narrow widths", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/agent-catalog");
  await expect(page.getByRole("heading", { name: "Proposed agent roles" })).toBeVisible();
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(18);
  await expect(page.getByRole("link", { name: "Proposed roles", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a role" }).fill("Qwen");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Model ID evidence" }).selectOption("unresolved-model-id");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("link", { name: "Qwen Local Reviewer", exact: true }).click();
  await expect(page.locator(".agent-readiness")).toContainText("qwen-local-reviewer");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Find a role" }).fill("no-such-role");
  await expect(page.getByText("No roles match these filters.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a role" }).fill("");
  await page.getByRole("combobox", { name: "Model ID evidence" }).selectOption("documented");
  await expect(page.locator(".agent-catalog-layout article")).toHaveCount(12);
  await page.getByRole("combobox", { name: "Model ID evidence" }).selectOption("all");
  await page.getByRole("link", { name: "Fable Architect", exact: true }).click();
  await expect(page.locator(".agent-readiness")).toContainText("claude-fable-5-1");
  await expect(page.locator(".agent-readiness button")).toHaveCount(0);
  const desktop = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(desktop.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({ path: "runtime/verification/agent-catalog-desktop-2026-10-19.png", fullPage: true });
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const narrow = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(narrow.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_BROWSER === "1")
    await page.screenshot({ path: "runtime/verification/agent-catalog-narrow-2026-10-19.png", fullPage: true });
  await page.goto("/#/sandbox");
  await expect(page.getByRole("heading", { name: "Code runner readiness" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Docker execution is not connected");
  await expect(page.locator("main button")).toHaveCount(1);
  expect(errors).toEqual([]);
});
