import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const accountRead = (response) =>
  response.url().endsWith("/api/account") &&
  response.request().method() === "GET";

async function register(page, username, displayName) {
  if (page.url() === "about:blank") await page.goto("/#/signup");
  else
    await page.evaluate(() => {
      location.hash = "/signup";
    });
  await page.getByLabel("Display name", { exact: true }).fill(displayName);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-recovery-fixture-password");
  const registered = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/register"),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect((await registered).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: displayName, exact: true }),
  ).toBeVisible();
}

async function saveOrbit(page) {
  await page.evaluate(() => {
    location.hash = "/repo/orbit";
  });
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/account/bookmarks/orbit") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
}

test("registration survives an unavailable saved list and explicitly recovers", async ({
  page,
}) => {
  let first = true;
  await page.route("**/api/account", (route) => {
    if (route.request().method() !== "GET" || !first) return route.continue();
    first = false;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Fixture saved-list unavailable." }),
    });
  });
  const failed = page.waitForResponse(
    (response) => accountRead(response) && response.status() === 503,
  );
  await register(page, "registration_recovery", "Registration Recovery");
  await failed;
  await expect(
    page.getByRole("heading", { name: "Registration Recovery", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/profile$/);
  await expect(page.getByRole("alert")).toContainText(
    "Saved repositories are unavailable.",
  );
  await expect(
    page.getByText("No repositories in this view.", { exact: true }),
  ).toHaveCount(0);
  if (process.env.CZ_CAPTURE_ACCOUNT_RECOVERY === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({
      path: "runtime/verification/account-unavailable-desktop-2026-10-19.png",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  if (process.env.CZ_CAPTURE_ACCOUNT_RECOVERY === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({
      path: "runtime/verification/account-unavailable-narrow-2026-10-19.png",
      fullPage: true,
    });
  }
  const refresh = page.getByRole("button", {
    name: "Refresh saved repositories",
    exact: true,
  });
  await page.locator("main").focus();
  for (
    let count = 0;
    count < 10 &&
    !(await refresh.evaluate((button) => button === document.activeElement));
    count++
  )
    await page.keyboard.press("Tab");
  await expect(refresh).toBeFocused();
  const recovered = page.waitForResponse(
    (response) => accountRead(response) && response.status() === 200,
  );
  await page.keyboard.press("Enter");
  await recovered;
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByText("No repositories in this view.", { exact: true }),
  ).toBeVisible();
  await expect(refresh).toBeFocused();
  let captured = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/account", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    captured = true;
    await gate;
    return route.fulfill({ response });
  });
  try {
    await refresh.click();
    await expect.poll(() => captured).toBe(true);
    await expect(refresh).toBeDisabled();
    const edit = page.getByRole("button", {
      name: "Edit profile",
      exact: true,
    });
    await edit.focus();
    const finished = page.waitForResponse(accountRead);
    release();
    await finished;
    await expect(refresh).toBeEnabled();
    await expect(edit).toBeFocused();
  } finally {
    release();
  }
});

test("a delayed saved-list read cannot undo a completed bookmark write", async ({
  page,
}) => {
  let first = true,
    captured = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/account", async (route) => {
    if (route.request().method() !== "GET" || !first) return route.continue();
    first = false;
    const response = await route.fetch();
    captured = true;
    await gate;
    return route.fulfill({ response });
  });
  try {
    await register(page, "bookmark_read_race", "Bookmark Read Race");
    await expect.poll(() => captured).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Bookmark Read Race", exact: true }),
    ).toBeVisible();
    await saveOrbit(page);
    const delayed = page.waitForResponse(accountRead);
    release();
    await delayed;
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      location.hash = "/profile";
    });
    await expect(page.locator(".observer-profile .repo-catalog")).toContainText(
      "chatgpt/orbit",
    );
  } finally {
    release();
  }
});

test("a prior account response cannot replace another user's saved repositories", async ({
  page,
}) => {
  await register(page, "saved_scope_a", "Saved Scope A");
  await saveOrbit(page);
  await page.evaluate(() => {
    location.hash = "/profile";
  });
  await expect(page.locator(".observer-profile .repo-catalog")).toContainText(
    "chatgpt/orbit",
  );
  let first = true,
    captured = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/account", async (route) => {
    if (route.request().method() !== "GET" || !first) return route.continue();
    first = false;
    const response = await route.fetch();
    captured = true;
    await gate;
    return route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Refresh saved repositories", exact: true })
      .click();
    await expect.poll(() => captured).toBe(true);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your profile", exact: true }),
    ).toBeVisible();
    await register(page, "saved_scope_b", "Saved Scope B");
    await expect(
      page.getByRole("heading", { name: "Saved Scope B", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No repositories in this view.", { exact: true }),
    ).toBeVisible();
    const delayed = page.waitForResponse(accountRead);
    release();
    await delayed;
    await expect(
      page.getByRole("heading", { name: "Saved Scope B", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".observer-profile .repo-catalog")).toHaveCount(
      0,
    );
    await expect(
      page.getByText("No repositories in this view.", { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

for (const firstFails of [false, true]) test(`repository saves stay ordered when the first response ${firstFails ? "fails" : "is delayed"}`, async ({ page }) => {
  const displayName = firstFails ? "Queued Failure" : "Queued Saves";
  await register(page, firstFails ? "queued_failure" : "queued_saves", displayName);
  await page.setViewportSize({ width: 390, height: 844 });
  let captured = false, released = false, premature = false, release;
  const writes = [];
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/account/bookmarks/*", async (route) => {
    const repo = route.request().url().split("/").at(-1);
    writes.push(repo);
    if (repo !== "orbit") {
      premature ||= !released;
      return route.continue();
    }
    const response = firstFails ? null : await route.fetch();
    captured = true;
    await gate;
    return response ? route.fulfill({ response }) : route.fulfill({ status: 503,
      contentType: "application/json", body: JSON.stringify({ message: "Fixture first save unavailable." }) });
  });
  try {
    await page.evaluate(() => { location.hash = "/repo/orbit"; });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => captured).toBe(true);
    await page.evaluate(() => { location.hash = "/repo/vector-kit"; });
    const save = page.getByRole("button", { name: "Save", exact: true });
    await save.focus();
    await page.keyboard.press("Enter");
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Saving repository" })).toBeVisible();
    if (!firstFails) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    }
    const search = page.getByRole("searchbox", { name: "Search agents, repositories, and pull requests" });
    if (firstFails) await search.fill("keep chosen input during queued saves");
    const first = page.waitForResponse((response) => response.url().endsWith("/api/account/bookmarks/orbit"));
    const second = page.waitForResponse((response) => response.url().endsWith("/api/account/bookmarks/vector-kit"));
    released = true;
    release();
    expect((await first).status()).toBe(firstFails ? 503 : 200);
    expect((await second).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
    await expect(firstFails ? search : page.getByRole("button", { name: "Saved", exact: true })).toBeFocused();
    expect(premature).toBe(false);
    expect(writes).toEqual(["orbit", "vector-kit"]);
    await page.evaluate(() => { location.hash = "/profile"; });
    await expect(page.locator(".observer-profile .repo-catalog")).toContainText("chatgpt/vector-kit");
    if (!firstFails) await expect(page.locator(".observer-profile .repo-catalog")).toContainText("chatgpt/orbit");
    const saved = await (await page.request.get("/api/account")).json();
    expect([...saved.bookmarks].sort()).toEqual(firstFails ? ["vector-kit"] : ["orbit", "vector-kit"]);
  } finally { released = true; release(); }
});

test("queued saves from a signed-out account never execute in the next session", async ({ page }) => {
  await register(page, "queued_owner_a", "Queued Owner A");
  let captured = false, release;
  const writes = [];
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/account/bookmarks/*", async (route) => {
    const repo = route.request().url().split("/").at(-1);
    writes.push(repo);
    if (repo !== "orbit") return route.continue();
    const response = await route.fetch();
    captured = true;
    await gate;
    return route.fulfill({ response });
  });
  try {
    await page.evaluate(() => { location.hash = "/repo/orbit"; });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => captured).toBe(true);
    await page.evaluate(() => { location.hash = "/profile"; });
    await expect(page.getByRole("heading", { name: "Queued Owner A", exact: true })).toBeVisible();
    await page.evaluate(() => { location.hash = "/repo/vector-kit"; });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.evaluate(() => { location.hash = "/profile"; });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
    await register(page, "queued_owner_b", "Queued Owner B");
    await expect(page.getByText("No repositories in this view.", { exact: true })).toBeVisible();
    const first = page.waitForResponse((response) => response.url().endsWith("/api/account/bookmarks/orbit"));
    release();
    await (await first).finished();
    const saved = await (await page.request.get("/api/account")).json();
    expect(saved.user.username).toBe("queued_owner_b");
    expect(saved.bookmarks).toEqual([]);
    expect(writes).toEqual(["orbit"]);
    await expect(page.getByRole("heading", { name: "Queued Owner B", exact: true })).toBeVisible();
    await expect(page.getByText("No repositories in this view.", { exact: true })).toBeVisible();
  } finally { release(); }
});
