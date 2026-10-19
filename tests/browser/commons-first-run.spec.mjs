import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

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
  if (process.env.CZ_CAPTURE_BROWSER === "1") {
    await page.screenshot({ path: "runtime/verification/commons-first-run-narrow-2026-10-19.png", fullPage: true });
  }
  expect(errors).toEqual([]);
});
