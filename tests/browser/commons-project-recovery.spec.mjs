import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("duplicate project address retains the form and can recover", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/commons");
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.getByRole("region", { name: "New project" });
  await form.getByLabel("Project address").fill("safe-timer");
  await form.getByLabel("Project name").fill("Collision fixture");
  await form.getByLabel("Description").fill("A disposable duplicate-address recovery case.");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(form.getByLabel("Project name")).toHaveValue("Collision fixture");
  await expect(form.getByLabel("Description"))
    .toHaveValue("A disposable duplicate-address recovery case.");
  await form.getByLabel("Project address").fill("browser-project-retry");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/#\/commons\/browser-project-retry$/);
  await expect(page.getByRole("heading", { name: "Collision fixture", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
});
