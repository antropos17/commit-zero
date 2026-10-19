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

test("archived project stays exportable and restores without losing its issue", async ({ page }) => {
  await page.goto("/#/commons");
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Projects", exact: true }).click();
  const form = page.getByRole("region", { name: "New project" });
  await form.getByLabel("Project address").fill("browser-archive");
  await form.getByLabel("Project name").fill("Archive fixture");
  await form.getByLabel("Description").fill("Model-free archive and export reproduction.");
  await form.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/#\/commons\/browser-archive$/);
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await page.getByLabel("Issue title").fill("Retain the first issue");
  await page.getByLabel("Problem and expected behavior").fill("Keep this issue after archive and restore.");
  await page.getByRole("button", { name: "Open issue" }).click();
  await expect(page.getByRole("heading", { name: /#1 Retain the first issue/ })).toBeVisible();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Code", exact: true }).click();
  const exportLink = page.getByRole("link", { name: "Export project" });
  await expect(exportLink).toBeVisible();
  await page.getByRole("button", { name: "Archive project" }).click();
  await expect(page.getByText("Archived project. History and exports remain available.")).toBeVisible();
  await expect(exportLink).toBeVisible();
  const exported = await page.request.get(await exportLink.getAttribute("href"));
  expect(exported.status()).toBe(200);
  const archive = await exported.json();
  expect(archive.format).toBe("commit-zero-project/1");
  expect(archive.project.id).toBe("browser-archive");
  expect(archive.project.archived).toBe(true);
  expect(archive.project.issues).toHaveLength(1);
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await expect(page.getByRole("button", { name: "Open issue" })).toBeDisabled();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("button", { name: "Restore project" }).click();
  await expect(page.getByText("Archived project. History and exports remain available.")).toHaveCount(0);
  await page.reload();
  await page.getByRole("group", { name: "Project sections" })
    .getByRole("button", { name: /Issues/ }).click();
  await expect(page.getByRole("heading", { name: /#1 Retain the first issue/ })).toBeVisible();
  await page.getByLabel("Issue title").fill("New work after restore");
  await page.getByLabel("Problem and expected behavior").fill("Restored projects accept a new issue.");
  await expect(page.getByRole("button", { name: "Open issue" })).toBeEnabled();
});
