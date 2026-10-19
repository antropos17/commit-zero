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
