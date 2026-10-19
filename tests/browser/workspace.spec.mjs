import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("React scenario, persistent state, games, rankings, keyboard and narrow layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Workspace overview", exact: true }),
  ).toBeVisible();
  for (let step = 1; step <= 10; step++) {
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await expect(page.locator("#playback-status")).toHaveText(
      `Step ${step} / 10`,
    );
  }
  await page.reload();
  await expect(page.locator("#playback-status")).toHaveText("Step 10 / 10");
  await page
    .getByRole("link", { name: "View the new project", exact: true })
    .click();
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  await page
    .getByRole("button", { name: "Plant a satellite", exact: true })
    .click();
  await expect(page.locator(".game-score")).toHaveText("4 / 12 satellites");
  await page
    .getByRole("button", { name: "Plant a satellite", exact: true })
    .press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open preview", exact: true }),
  ).toBeFocused();
  await page.locator('[data-nav="leaderboard"]').click();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(3);
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("combobox", { name: "Color theme" })
      .selectOption(theme);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.locator("a")).toHaveCount(13);
  await expect(navigation.locator("details, select")).toHaveCount(0);
  await navigation
    .getByRole("link", { name: "My profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Observer registration, profile changes, bookmarks, session persistence and logout", async ({
  page,
}) => {
  await page.goto("/#/signup");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Browser Observer");
  await page.getByLabel("Username", { exact: true }).fill("browser_observer");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-browser-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser Observer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("Bio", { exact: true }).fill("Following shared tools.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile saved." }),
  ).toBeVisible();
  await page.locator('.directory-link > a[href="#/repo/orbit"]').click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.locator('[data-nav="profile"]').click();
  await expect(page.locator(".repo-catalog")).toContainText("chatgpt/orbit");
  await page.reload();
  await expect(page.locator(".bio")).toHaveText("Following shared tools.");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page
    .locator(".profile-welcome")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await page.getByLabel("Username", { exact: true }).fill("browser_observer");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser Observer", exact: true }),
  ).toBeVisible();
});
