import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const rankingsResponse = (response) =>
  new URL(response.url()).pathname === "/api/rankings";
const agentRows = (page) => page.locator(".ranking-table tbody .rank-agent");

test("rankings separate failure from empty results and retain only matching refreshed data", async ({
  page,
}) => {
  let attempt = 0,
    releaseRetry,
    releaseRefresh;
  const retryGate = new Promise((resolve) => {
    releaseRetry = resolve;
  });
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route("**/api/rankings**", async (route) => {
    attempt++;
    if (attempt === 1) return route.abort("failed");
    if (attempt === 2) await retryGate;
    if (attempt === 3)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Fixture ranking refresh unavailable.",
        }),
      });
    if (attempt === 4) await refreshGate;
    return route.continue();
  });
  try {
    await page.goto("/#/leaderboard");
    const region = page.getByRole("region", {
      name: "Agent contribution rankings",
      exact: true,
    });
    const refresh = page.getByRole("button", { name: "Refresh", exact: true });
    await expect(page.getByRole("alert")).toContainText(
      "Cannot reach the service.",
    );
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByText("Rankings unavailable.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No matching agents.", { exact: true }),
    ).toHaveCount(0);
    if (process.env.CZ_CAPTURE_RANKING_RECOVERY === "1") {
      await mkdir("runtime/verification", { recursive: true });
      await page.screenshot({
        path: "runtime/verification/rankings-unavailable-2026-10-19.png",
        fullPage: true,
      });
    }
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(refresh).toBeDisabled();
    const retried = page.waitForResponse(rankingsResponse);
    releaseRetry();
    expect((await retried).status()).toBe(200);
    await expect(agentRows(page)).toHaveCount(3);
    await expect(refresh).toBeFocused();
    const filter = page.getByRole("searchbox", {
      name: "Filter agents",
      exact: true,
    });
    await filter.fill("no-fixture-agent-matches");
    await expect(
      page.getByText("No matching agents.", { exact: true }),
    ).toBeVisible();
    await filter.fill("");
    await refresh.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toContainText(
      "Fixture ranking refresh unavailable.",
    );
    await expect(agentRows(page)).toHaveCount(3);
    await expect(
      page.getByText("Showing the last available rankings.", { exact: true }),
    ).toBeVisible();
    await expect(refresh).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("combobox", { name: "Color theme" })
      .selectOption("dark");
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
    if (process.env.CZ_CAPTURE_RANKING_RECOVERY === "1")
      await page.screenshot({
        path: "runtime/verification/rankings-last-known-2026-10-19.png",
        fullPage: true,
      });
    await refresh.click();
    await expect(region).toHaveAttribute("aria-busy", "true");
    const search = page.getByRole("searchbox", {
      name: "Search agents, repositories, and pull requests",
    });
    await search.fill("preserve ranking recovery focus");
    const refreshed = page.waitForResponse(rankingsResponse);
    releaseRefresh();
    expect((await refreshed).status()).toBe(200);
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(search).toBeFocused();
  } finally {
    releaseRetry();
    releaseRefresh();
  }
});

test("changing a failed ranking category never displays another category's scores", async ({
  page,
}) => {
  let failCode = true,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/rankings**", async (route) => {
    const category = new URL(route.request().url()).searchParams.get(
      "category",
    );
    if (category === "code" && failCode) {
      await gate;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Fixture code rankings unavailable." }),
      });
    }
    return route.continue();
  });
  try {
    await page.goto("/#/leaderboard");
    await expect(agentRows(page)).toHaveCount(3);
    const code = page.getByRole("button", { name: "Code", exact: true });
    await code.focus();
    await page.keyboard.press("Enter");
    const region = page.getByRole("region", {
      name: "Agent contribution rankings",
      exact: true,
    });
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(agentRows(page)).toHaveCount(0);
    await expect(code).toBeFocused();
    release();
    await expect(page.getByRole("alert")).toContainText(
      "Fixture code rankings unavailable.",
    );
    await expect(agentRows(page)).toHaveCount(0);
    await expect(
      page.getByText("Rankings unavailable.", { exact: true }),
    ).toBeVisible();
    failCode = false;
    const recovered = page.waitForResponse(rankingsResponse);
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    const data = await (await recovered).json();
    expect(data.category).toBe("code");
    expect(data.rows.every((row) => row.score === row.code)).toBe(true);
    await expect(agentRows(page)).toHaveCount(data.rows.length);
    await expect(page.locator(".ranking-table .rank-score")).toHaveText(
      data.rows.map((row) => String(row.score)),
    );
    await expect(
      page.getByRole("button", { name: "Refresh", exact: true }),
    ).toBeFocused();
  } finally {
    release();
  }
});

test("cancel-capable resource reads still time out and recover through a fresh request", async ({
  page,
}) => {
  let first = true,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/rankings**", async (route) => {
    if (!first) return route.continue();
    first = false;
    await gate;
    // The real browser has already cancelled the stalled request at its deadline.
    return route.abort("failed").catch(() => {});
  });
  try {
    await page.goto("/#/leaderboard");
    const region = page.getByRole("region", {
      name: "Agent contribution rankings",
      exact: true,
    });
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("alert")).toContainText(
      "The request timed out.",
      { timeout: 14500 },
    );
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByText("Rankings unavailable.", { exact: true }),
    ).toBeVisible();
    release();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(agentRows(page)).toHaveCount(3);
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    release();
  }
});

test("rankings from a newer real scenario revision require workspace synchronization", async ({
  page,
}) => {
  const loaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/state") && response.status() === 200,
  );
  await page.goto("/#/leaderboard");
  const initial = await (await loaded).json();
  await expect(agentRows(page)).toHaveCount(3);
  const advanced = await page.request.post("/api/advance", {
    headers: { "X-Commit-Zero": "local-demo" },
    data: { runId: initial.runId, version: initial.version },
  });
  expect(advanced.status()).toBe(200);
  const next = await advanced.json();
  expect(next.step).toBe(initial.step + 1);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "could not be matched to this scenario and category",
  );
  await expect(agentRows(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Refresh workspace", exact: true })
    .click();
  await expect(page.locator("#playback-status")).toHaveText(
    `Step ${next.step} / 10`,
  );
  await expect(agentRows(page)).toHaveCount(3);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
