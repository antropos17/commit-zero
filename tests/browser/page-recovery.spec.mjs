import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const navigation = (page) =>
  page.getByRole("navigation", { name: "Main navigation", exact: true });
const failure = (page) =>
  page.getByRole("alert").filter({
    has: page.getByRole("heading", {
      name: "This page could not be displayed",
      exact: true,
    }),
  });
async function openWorkspace(page) {
  const response = page.waitForResponse(
    (item) => item.url().endsWith("/api/state") && item.status() === 200,
  );
  await page.goto("/#/home");
  const state = await (await response).json();
  await expect(
    page.getByRole("heading", { name: "Workspace overview", exact: true }),
  ).toBeVisible();
  return state;
}
async function unchanged(page, initial, writes) {
  const response = await page.request.get("/api/state");
  expect(response.status()).toBe(200);
  const current = await response.json();
  expect([current.runId, current.version, current.step]).toEqual([
    initial.runId,
    initial.version,
    initial.step,
  ]);
  expect(writes).toEqual([]);
}

for (const chosenInput of [false, true]) {
  test(`a failed page retries inside the shell and ${chosenInput ? "respects another chosen input" : "restores keyboard focus"}`, async ({
    page,
  }) => {
    let attempts = 0,
      stateReads = 0,
      releaseRetry;
    const writes = [];
    const retryGate = new Promise((resolve) => {
      releaseRetry = resolve;
    });
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(request.url());
      if (request.url().endsWith("/api/state")) stateReads++;
    });
    await page.route("**/api/lab", async (route) => {
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ runs: null }),
        });
      if (attempts === 2) await retryGate;
      return route.continue();
    });
    try {
      const initial = await openWorkspace(page);
      const search = page.locator("#search-input");
      await search.fill("retained shell draft");
      await navigation(page)
        .getByRole("link", { name: "Language lab", exact: true })
        .click();
      await expect(failure(page)).toBeVisible();
      await expect(failure(page)).toBeFocused();
      await expect(navigation(page).getByRole("link")).toHaveCount(14);
      await expect(
        page.getByRole("button", { name: "Reload workspace", exact: true }),
      ).toHaveCount(0);
      await expect(search).toHaveValue("retained shell draft");
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        (
          await page
            .getByRole("button", { name: "Try this page again", exact: true })
            .boundingBox()
        ).height,
      ).toBeGreaterThanOrEqual(44);
      for (const theme of ["dark", "light"]) {
        await page
          .getByLabel("Color theme", { exact: true })
          .selectOption(theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
      if (!chosenInput && process.env.CZ_CAPTURE_PAGE_RECOVERY === "1") {
        await mkdir("runtime/verification", { recursive: true });
        await page.screenshot({
          path: "runtime/verification/page-error-contained-2026-10-19.png",
          fullPage: true,
        });
      }
      await failure(page).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Try this page again", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(failure(page)).toHaveCount(0);
      await expect(page.locator("main")).toBeFocused();
      if (chosenInput) await search.focus();
      const recovered = page.waitForResponse(
        (item) => item.url().endsWith("/api/lab") && item.status() === 200,
      );
      releaseRetry();
      await recovered;
      await expect(
        page.getByRole("heading", { name: "Language lab", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Start local experiment",
          exact: true,
        }),
      ).toBeVisible();
      await expect(chosenInput ? search : page.locator("main")).toBeFocused();
      await expect(search).toHaveValue("retained shell draft");
      expect(stateReads).toBe(1);
      await unchanged(page, initial, writes);
    } finally {
      releaseRetry();
    }
  });
}

test("permanent navigation leaves a failed page and a later visit retries only its reads", async ({
  page,
}) => {
  let attempts = 0,
    releaseInitial;
  const initialGate = new Promise((resolve) => {
    releaseInitial = resolve;
  });
  const writes = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.route("**/api/lab", async (route) => {
    attempts++;
    if (attempts === 1) await initialGate;
    return attempts <= 2
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ runs: null }),
        })
      : route.continue();
  });
  const initial = await openWorkspace(page);
  await navigation(page)
    .getByRole("link", { name: "Language lab", exact: true })
    .click();
  await expect.poll(() => attempts).toBe(1);
  await page.locator("#search-input").focus();
  releaseInitial();
  await expect(failure(page)).toBeVisible();
  await expect(page.locator("#search-input")).toBeFocused();
  await page
    .getByRole("button", { name: "Try this page again", exact: true })
    .click();
  await expect.poll(() => attempts).toBe(2);
  await expect(failure(page)).toBeVisible();
  await expect(failure(page)).toBeFocused();
  await navigation(page)
    .getByRole("link", { name: "Environment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Service health", exact: true }),
  ).toBeVisible();
  await expect(failure(page)).toHaveCount(0);
  await navigation(page)
    .getByRole("link", { name: "Language lab", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Language lab", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start local experiment", exact: true }),
  ).toBeVisible();
  await expect(failure(page)).toHaveCount(0);
  await unchanged(page, initial, writes);
});
