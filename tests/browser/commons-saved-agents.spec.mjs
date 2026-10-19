import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const list = (page) =>
  page.getByRole("group", { name: "Saved agents", exact: true });
const refresh = (page) =>
  list(page).getByRole("button", { name: "Refresh saved agents", exact: true });
const select = (page) => page.getByLabel("Agent", { exact: true });
const task = (page) => page.getByLabel("Task", { exact: true });
const run = (page) =>
  page.getByRole("button", { name: "Run agents", exact: true });
test("signed-out saved-author links retain identity and require an explicit built-in choice", async ({
  page,
}) => {
  const writes = [],
    authorReads = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
    if (request.url().endsWith("/api/account/agents"))
      authorReads.push(request.url());
  });
  await page.route("**/api/commons/provider", (route) =>
    route.fulfill({ json: { available: true, busy: false } }),
  );
  const missing = "00000000-0000-4000-8000-000000000001";
  await page.goto(`/#/commons/safe-timer?view=tasks&agent=${missing}`);
  const initial = await state(page);
  await task(page).fill("Fixture author draft. Never submit it.");
  await expect(select(page)).toHaveValue(missing);
  await expect(page.getByRole("alert")).toContainText(
    "Sign in to the agent owner account",
  );
  await expect(list(page)).toHaveCount(0);
  await expect(run(page)).toBeDisabled();
  await select(page).selectOption("");
  await expect(run(page)).toBeEnabled();
  expect(authorReads).toEqual([]);
  await unchanged(page, { initial, writes });
});
async function state(page) {
  const response = await page.request.get("/api/state");
  expect(response.status()).toBe(200);
  const scenario = await response.json();
  const snapshot = await page.request.get(`/api/commons?runId=${scenario.runId}`);
  expect(snapshot.status()).toBe(200);
  const commons = await snapshot.json();
  return [
    scenario.runId,
    scenario.version,
    scenario.step,
    commons.version,
    commons.jobs.length,
    commons.events.length,
  ];
}
async function owner(page, suffix) {
  await page.goto("/#/signup");
  await page
    .getByLabel("Display name", { exact: true })
    .fill(`Fixture Author Owner ${suffix}`);
  await page
    .getByLabel("Username", { exact: true })
    .fill(`fixture_saved_author_${suffix}`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fixture-only-local-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: `Fixture Author Owner ${suffix}`,
      exact: true,
    }),
  ).toBeVisible();
  const response = await page.request.post("/api/account/agents", {
    headers: { "X-Commit-Zero": "local-demo" },
    data: {
      name: "Fixture Saved Author",
      mission: "Prepare a bounded configuration without executing it.",
      instructions:
        "Configuration fixture only. Never launch or submit a task.",
      provider: "local",
      model: "cz-local-coder",
      repository: "commons/safe-timer",
      dailyBudgetCents: 0,
      maxMinutes: 1,
      capabilities: ["propose"],
    },
  });
  expect(response.status()).toBe(201);
  const { agent, execution } = await response.json();
  expect(agent.status).toBe("configuration_only");
  expect(execution.available).toBe(false);
  const writes = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  return { agent, writes, initial: await state(page) };
}
async function open(page, id) {
  await page.evaluate((id) => {
    location.hash = `/commons/safe-timer?view=tasks&agent=${id}`;
  }, id);
  await expect(task(page)).toBeVisible();
  await task(page).fill("Fixture author draft. Never submit it.");
}
async function unchanged(page, before) {
  expect(await state(page)).toEqual(before.initial);
  expect(before.writes).toEqual([]);
  await expect(task(page)).toHaveValue(
    "Fixture author draft. Never submit it.",
  );
}

test("failed saved-author discovery preserves the selected identity and explicitly recovers with keyboard focus", async ({
  page,
}) => {
  const before = await owner(page, "recovery");
  let fail = true,
    release;
  await page.route("**/api/account/agents", async (route) => {
    if (fail)
      return route.fulfill({
        status: 503,
        json: { message: "Fixture saved authors unavailable." },
      });
    const response = await route.fetch();
    await new Promise((resolve) => {
      release = resolve;
    });
    return route.fulfill({ response });
  });
  await open(page, before.agent.id);
  await expect(select(page)).toHaveValue(before.agent.id);
  await expect(list(page).getByRole("alert")).toContainText(
    "Fixture saved authors unavailable.",
  );
  await expect(run(page)).toBeDisabled();
  await expect(
    page.getByText("Sign in to the agent owner account and reload this page.", {
      exact: true,
    }),
  ).toHaveCount(0);
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
  if (process.env.CZ_CAPTURE_SAVED_AGENTS === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({
      path: "runtime/verification/commons-saved-agents-unavailable-2026-10-19.png",
      fullPage: true,
    });
  }
  fail = false;
  await refresh(page).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(refresh(page)).toBeFocused();
  await expect(select(page).locator("option:checked")).toContainText(
    "Fixture Saved Author",
  );
  await expect(list(page).getByRole("status")).toContainText(
    "Saved configurations loaded",
  );
  release = null;
  await refresh(page).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await task(page).focus();
  release();
  await expect(refresh(page)).toBeEnabled();
  await expect(task(page)).toBeFocused();
  await unchanged(page, before);
});

test("failed refresh keeps last available configurations qualified and blocks their use until recovery", async ({
  page,
}) => {
  const before = await owner(page, "stale");
  // Synthetic read metadata exercises author gating; no provider/job is invoked.
  await page.route("**/api/commons/provider", (route) =>
    route.fulfill({ json: { available: true, busy: false } }),
  );
  await open(page, before.agent.id);
  await expect(run(page)).toBeEnabled();
  await page.route("**/api/account/agents", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Fixture refresh failed." },
    }),
  );
  await refresh(page).click();
  await expect(list(page).getByRole("alert")).toContainText(
    "last available configurations",
  );
  await expect(select(page).locator("option:checked")).toContainText(
    "Fixture Saved Author",
  );
  await expect(run(page)).toBeDisabled();
  await page.unroute("**/api/account/agents");
  await refresh(page).click();
  await expect(run(page)).toBeEnabled();
  await unchanged(page, before);
});

test("malformed saved configurations stay unknown and recover through the actual owner endpoint", async ({
  page,
}) => {
  const before = await owner(page, "invalid");
  let body = { agents: {} };
  await page.route("**/api/account/agents", (route) =>
    route.fulfill({ json: body }),
  );
  await open(page, before.agent.id);
  for (const agents of [
    {},
    [null],
    [{ ...before.agent, version: "1" }],
    [{ ...before.agent, name: {} }],
    [before.agent, before.agent],
  ]) {
    body = { agents };
    await refresh(page).click();
    await expect(list(page).getByRole("alert")).toContainText(
      "invalid saved agents",
    );
    await expect(select(page)).toHaveValue(before.agent.id);
    await expect(run(page)).toBeDisabled();
    await expect(
      page.getByRole("navigation", { name: "Main navigation", exact: true }),
    ).toBeVisible();
  }
  await page.unroute("**/api/account/agents");
  await refresh(page).click();
  await expect(list(page).getByRole("status")).toContainText(
    "Saved configurations loaded",
  );
  await unchanged(page, before);
});

test("a confirmed absent author is never silently replaced by the built-in author", async ({
  page,
}) => {
  const before = await owner(page, "missing");
  await page.route("**/api/commons/provider", (route) =>
    route.fulfill({ json: { available: true, busy: false } }),
  );
  const missing = "00000000-0000-4000-8000-000000000001";
  await open(page, missing);
  await expect(list(page).getByRole("status")).toContainText(
    "Saved configurations loaded",
  );
  await expect(select(page)).toHaveValue(missing);
  await expect(select(page).locator("option:checked")).toHaveText(
    "Selected saved agent unavailable",
  );
  await expect(run(page)).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "unavailable in this account",
  );
  await select(page).selectOption(before.agent.id);
  await expect(run(page)).toBeEnabled();
  await unchanged(page, before);
});
