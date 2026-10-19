import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const discovery = (page) =>
  page.getByRole("region", { name: "Experiment discovery", exact: true });
const refresh = (page) =>
  page.getByRole("button", { name: "Refresh experiments", exact: true });
const launch = (page) =>
  page.getByRole("button", { name: "Start local experiment", exact: true });
async function openLab(page, writes) {
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  const response = page.waitForResponse(
    (item) => item.url().endsWith("/api/state") && item.status() === 200,
  );
  await page.goto("/#/lab");
  const state = await (await response).json();
  await expect(
    page.getByRole("heading", { name: "Language lab", exact: true }),
  ).toBeVisible();
  return state;
}
async function unchanged(page, state, writes) {
  const response = await page.request.get("/api/state");
  expect(response.status()).toBe(200);
  const current = await response.json();
  expect([current.runId, current.version, current.step]).toEqual([
    state.runId,
    state.version,
    state.step,
  ]);
  expect(writes).toEqual([]);
}

test("experiment discovery explicitly retries and retains settings and keyboard choices", async ({
  page,
}) => {
  let reads = 0,
    releaseRetry,
    releaseRefresh;
  const retryGate = new Promise((resolve) => {
    releaseRetry = resolve;
  });
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route("**/api/lab", async (route) => {
    reads++;
    if (reads === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Fixture experiment discovery unavailable.",
        }),
      });
    if (reads === 2) await retryGate;
    if (reads === 3) await refreshGate;
    return route.continue();
  });
  const writes = [];
  try {
    const initial = await openLab(page, writes);
    await expect(discovery(page).getByRole("alert")).toContainText(
      "Fixture experiment discovery unavailable.",
    );
    await expect(discovery(page)).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByText("Local model availability unknown", { exact: true }),
    ).toBeVisible();
    await expect(launch(page)).toBeDisabled();
    await expect(
      page.getByLabel("Experiment run", { exact: true }),
    ).toBeDisabled();
    const mode = page.getByLabel("Experiment mode", { exact: true });
    await mode.selectOption("heap");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("Color theme", { exact: true }).selectOption(theme);
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
    if (process.env.CZ_CAPTURE_LAB_RECOVERY === "1") {
      await mkdir("runtime/verification", { recursive: true });
      await page.screenshot({
        path: "runtime/verification/lab-discovery-unavailable-2026-10-19.png",
        fullPage: true,
      });
    }
    await refresh(page).focus();
    await page.keyboard.press("Enter");
    await expect(discovery(page)).toHaveAttribute("aria-busy", "true");
    await expect(refresh(page)).toBeDisabled();
    await expect(launch(page)).toBeDisabled();
    releaseRetry();
    await expect(discovery(page)).toHaveAttribute("aria-busy", "false");
    await expect(discovery(page).getByRole("alert")).toHaveCount(0);
    await expect(refresh(page)).toBeFocused();
    await expect(mode).toHaveValue("heap");
    await refresh(page).press("Enter");
    await expect(discovery(page)).toHaveAttribute("aria-busy", "true");
    await mode.focus();
    releaseRefresh();
    await expect(discovery(page)).toHaveAttribute("aria-busy", "false");
    await expect(mode).toBeFocused();
    await expect(mode).toHaveValue("heap");
    await unchanged(page, initial, writes);
  } finally {
    releaseRetry();
    releaseRefresh();
  }
});

test("a successful automatic discovery read clears only its earlier read failure", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/lab", (route) =>
    ++reads === 1
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Fixture earlier discovery failure.",
          }),
        })
      : route.continue(),
  );
  const writes = [],
    initial = await openLab(page, writes);
  await expect(discovery(page).getByRole("alert")).toContainText(
    "Fixture earlier discovery failure.",
  );
  await page.getByLabel("Experiment mode", { exact: true }).focus();
  await expect(
    page.getByRole("heading", {
      name: "Start with an empty experiment",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(discovery(page).getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByLabel("Experiment mode", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("Local model offline", { exact: true }),
  ).toBeVisible();
  await unchanged(page, initial, writes);
});

test("malformed discovery remains an unavailable read and never enables model launch", async ({
  page,
}) => {
  const writes = [];
  let malformed = true,
    variant = "availability";
  await page.route("**/api/lab", async (route) => {
    if (!malformed) return route.continue();
    const response = await route.fetch(),
      body = await response.json();
    if (variant === "availability") body.provider.available = "false";
    if (variant === "runs") body.runs = null;
    if (variant === "reason") body.provider.reason = { invalid: true };
    return route.fulfill({ response, json: body });
  });
  const initial = await openLab(page, writes);
  for (const value of ["availability", "runs", "reason"]) {
    variant = value;
    if (value !== "availability") await refresh(page).click();
    await expect(discovery(page).getByRole("alert")).toContainText(
      "invalid experiment discovery data",
    );
    await expect(discovery(page)).toHaveAttribute("aria-busy", "false");
    await expect(launch(page)).toBeDisabled();
    await expect(
      page.getByRole("navigation", { name: "Main navigation", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "This page could not be displayed",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  malformed = false;
  await refresh(page).click();
  await expect(discovery(page).getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Start with an empty experiment",
      exact: true,
    }),
  ).toBeVisible();
  await unchanged(page, initial, writes);
});

test("failed refreshed readiness qualifies last data and disables launch until a current read", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/lab", async (route) => {
    reads++;
    if (reads === 2)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Fixture readiness refresh failure." }),
      });
    const response = await route.fetch(),
      body = await response.json();
    if (reads === 1) {
      // Synthetic readiness metadata only. Never click launch or count as inference.
      body.provider.available = true;
      body.provider.reason = "Fixture metadata only; no model executed.";
    }
    return route.fulfill({ response, json: body });
  });
  const writes = [],
    initial = await openLab(page, writes);
  await expect(launch(page)).toBeEnabled();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toBeVisible();
  await refresh(page).click();
  await expect(discovery(page).getByRole("alert")).toContainText(
    "Fixture readiness refresh failure.",
  );
  await expect(discovery(page)).toContainText(
    "Showing the last available experiment list.",
  );
  await expect(launch(page)).toBeDisabled();
  await expect(
    page.getByText("Local model ready", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Local model availability unknown", { exact: true }),
  ).toBeVisible();
  await refresh(page).click();
  await expect(discovery(page).getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByText("Local model offline", { exact: true }),
  ).toBeVisible();
  await unchanged(page, initial, writes);
});
