import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const healthRead = (response) => response.url().endsWith("/api/health");
const contained = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("service health settles failure, retains last data and explicitly recovers without stealing focus", async ({
  page,
}) => {
  let attempts = 0,
    releaseFirst,
    releaseLast;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const lastGate = new Promise((resolve) => {
    releaseLast = resolve;
  });
  await page.route("**/api/health", async (route) => {
    attempts++;
    if (attempts === 1) return route.abort("failed");
    if (attempts === 2) await firstGate;
    if (attempts === 3)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Fixture health refresh unavailable.",
        }),
      });
    if (attempts === 4) await lastGate;
    return route.continue();
  });
  try {
    await page.goto("/#/sandbox");
    const region = page.getByRole("region", {
      name: "Service health",
      exact: true,
    });
    const refresh = page.getByRole("button", {
      name: "Refresh health",
      exact: true,
    });
    await expect(region.getByRole("alert")).toContainText(
      "Cannot reach the service.",
    );
    await expect(page.getByText(/^Checking services/)).toHaveCount(0);
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(region).toContainText("Service health is unavailable.");
    if (process.env.CZ_CAPTURE_SERVICE_HEALTH === "1") {
      await mkdir("runtime/verification", { recursive: true });
      await page.screenshot({
        path: "runtime/verification/service-health-unavailable-desktop-2026-10-19.png",
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await contained(page)).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.locator("main").focus();
    await page.keyboard.press("Tab");
    await expect(refresh).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      region.getByRole("button", { name: "Try again", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(region.getByRole("status")).toContainText("Checking services");
    await expect(refresh).toBeDisabled();
    const recovered = page.waitForResponse(
      (response) => healthRead(response) && response.status() === 200,
    );
    releaseFirst();
    await recovered;
    await expect(region.locator(".service-list")).toBeVisible();
    for (const name of ["workspace", "identity", "ranking"])
      await expect(region.getByText(name, { exact: true })).toBeVisible();
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(refresh).toBeFocused();

    const failedRefresh = page.waitForResponse(
      (response) => healthRead(response) && response.status() === 503,
    );
    await refresh.click();
    await failedRefresh;
    await expect(region.getByRole("alert")).toContainText(
      "Fixture health refresh unavailable.",
    );
    await expect(region.locator(".service-list")).toBeVisible();
    await expect(region).toContainText(
      "Showing the last available service health.",
    );
    await expect(region).toHaveAttribute("aria-busy", "false");
    await page
      .getByRole("combobox", { name: "Color theme" })
      .selectOption("dark");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (process.env.CZ_CAPTURE_SERVICE_HEALTH === "1")
      await page.screenshot({
        path: "runtime/verification/service-health-last-known-narrow-2026-10-19.png",
        fullPage: true,
      });

    await refresh.click();
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(region.getByRole("status")).toContainText(
      "Refreshing service health",
    );
    const search = page.getByRole("searchbox", {
      name: "Search agents, repositories, and pull requests",
    });
    await search.fill("health query");
    const finalRead = page.waitForResponse(
      (response) => healthRead(response) && response.status() === 200,
    );
    releaseLast();
    await finalRead;
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(region.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByText("Showing the last available service health.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("health query");
    expect(await contained(page)).toBe(true);
  } finally {
    releaseFirst();
    releaseLast();
  }
});

test("environment diagnostics remain usable while the workspace snapshot is unavailable", async ({
  page,
}) => {
  const scenarioWrites = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/(advance|runs)$/.test(request.url())
    )
      scenarioWrites.push(request.url());
  });
  let restored = false;
  await page.route("**/api/state", (route) =>
    restored
      ? route.continue()
      : route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture snapshot unavailable." }),
        }),
  );
  await page.route("**/api/health", (route) =>
    restored
      ? route.continue()
      : route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            status: "degraded",
            message: "Fixture dependency unavailable.",
            services: {
              workspace: { status: "unavailable" },
              identity: { status: "ok" },
              ranking: { status: "ok" },
            },
          }),
        }),
  );
  await page.goto("/#/sandbox");
  const title = page.getByRole("heading", {
    name: "Sandbox environment",
    exact: true,
  });
  const region = page.getByRole("region", {
    name: "Service health",
    exact: true,
  });
  await expect(title).toBeVisible();
  await expect(
    page.getByText(/Workspace data is unavailable\. Service checks/),
  ).toBeVisible();
  await expect(region.getByRole("alert")).toContainText(
    "Fixture dependency unavailable.",
  );
  await expect(
    region.locator(".policy-row").filter({ hasText: "workspace" }),
  ).toContainText("unavailable");
  await expect(
    page.getByRole("heading", { name: "Code runner readiness", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#workspace-directory .count")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .locator("a"),
  ).toHaveCount(14);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await contained(page)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  restored = true;
  const snapshot = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/state") && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Refresh workspace", exact: true })
    .click();
  const snapshotData = await (await snapshot).json();
  await expect(
    page.getByRole("button", { name: "Refresh workspace", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText(/Workspace data is unavailable\. Service checks/),
  ).toHaveCount(0);
  await expect(title).toBeVisible();
  const healthy = page.waitForResponse(
    (response) => healthRead(response) && response.status() === 200,
  );
  await page
    .getByRole("button", { name: "Refresh health", exact: true })
    .click();
  await healthy;
  await expect(region.getByRole("alert")).toHaveCount(0);
  await expect(
    region.locator(".policy-row").filter({ hasText: "workspace" }),
  ).toContainText("ok");
  await expect(page.locator("#playback-status")).toHaveText(
    `Step ${snapshotData.step} / 10`,
  );
  expect(scenarioWrites).toEqual([]);
});
