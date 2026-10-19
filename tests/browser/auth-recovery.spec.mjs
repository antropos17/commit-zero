import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const optionsResponse = (response) =>
  response.url().endsWith("/api/auth/providers");
const optionsRegion = (page) =>
  page.getByRole("region", { name: "Sign in with a provider", exact: true });
async function fillDraft(page) {
  await page
    .getByLabel("Username", { exact: true })
    .fill("draft_local_observer");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fake-draft-password");
}

test("failed sign-in discovery recovers without reloading the local account draft", async ({
  page,
}) => {
  let attempt = 0,
    releaseRetry,
    releaseRefresh;
  const writes = [];
  const retryGate = new Promise((resolve) => {
    releaseRetry = resolve;
  });
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.route("**/api/auth/providers", async (route) => {
    attempt++;
    if (attempt === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Fixture sign-in discovery unavailable.",
        }),
      });
    if (attempt === 2) await retryGate;
    if (attempt === 3) await refreshGate;
    return route.continue();
  });
  try {
    await page.goto("/#/login");
    await fillDraft(page);
    const region = optionsRegion(page);
    const refresh = region.getByRole("button", {
      name: "Refresh sign-in options",
      exact: true,
    });
    await expect(region.getByRole("alert")).toContainText(
      "Fixture sign-in discovery unavailable.",
    );
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(
      region.getByText(/Provider availability is unknown/),
    ).toBeVisible();
    await expect(
      region.getByRole("button", { name: "Continue with GitHub", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
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
    if (process.env.CZ_CAPTURE_AUTH_RECOVERY === "1") {
      await mkdir("runtime/verification", { recursive: true });
      await page.screenshot({
        path: "runtime/verification/sign-in-discovery-unavailable-2026-10-19.png",
        fullPage: true,
      });
    }
    await refresh.focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveAttribute("aria-busy", "true");
    await expect(refresh).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    const retried = page.waitForResponse(optionsResponse);
    releaseRetry();
    expect((await retried).status()).toBe(200);
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(region.getByRole("alert")).toHaveCount(0);
    await expect(
      region.getByText("Not configured on this server.", { exact: true }),
    ).toHaveCount(2);
    await expect(refresh).toBeFocused();
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
      "draft_local_observer",
    );
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      "fake-draft-password",
    );
    await refresh.press("Enter");
    await expect(region).toHaveAttribute("aria-busy", "true");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("changed-fake-draft-password");
    const refreshed = page.waitForResponse(optionsResponse);
    releaseRefresh();
    await refreshed;
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(password).toBeFocused();
    await expect(password).toHaveValue("changed-fake-draft-password");
    expect(writes).toEqual([]);
  } finally {
    releaseRetry();
    releaseRefresh();
  }
});

test("malformed provider shapes keep navigation and local sign-in usable", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let attempt = 0;
  await page.route("**/api/auth/providers", (route) => {
    attempt++;
    if (attempt === 1)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ providers: { unusable: true } }),
      });
    if (attempt === 2)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          providers: [
            { id: "github", name: "GitHub", available: "false", reason: null },
            {
              id: "google",
              name: "Google",
              available: false,
              reason: "Not configured on this server.",
            },
          ],
        }),
      });
    return route.continue();
  });
  await page.goto("/#/login");
  const region = optionsRegion(page);
  await expect(region.getByRole("alert")).toContainText(
    "invalid sign-in options response",
  );
  await fillDraft(page);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .locator("a"),
  ).toHaveCount(14);
  const refresh = region.getByRole("button", {
    name: "Refresh sign-in options",
    exact: true,
  });
  const invalid = page.waitForResponse(optionsResponse);
  await refresh.click();
  expect((await (await invalid).json()).providers[0].available).toBe("false");
  await expect(region).toHaveAttribute("aria-busy", "false");
  await expect(region.getByRole("alert")).toContainText(
    "invalid sign-in options response",
  );
  await expect(
    region.getByRole("button", { name: "Continue with GitHub", exact: true }),
  ).toBeDisabled();
  const recovered = page.waitForResponse(optionsResponse);
  await refresh.click();
  expect((await recovered).status()).toBe(200);
  await expect(region.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "draft_local_observer",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("failed local sign-in restores its control and preserves a different chosen input", async ({
  page,
}) => {
  const releases = [],
    gates = [],
    writes = [];
  for (let index = 0; index < 2; index++)
    gates.push(
      new Promise((resolve) => {
        releases.push(resolve);
      }),
    );
  await page.route("**/api/auth/login", async (route) => {
    const index = writes.length;
    writes.push(route.request().postDataJSON());
    await gates[index];
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: `Fixture local sign-in unavailable ${index + 1}.`,
      }),
    });
  });
  try {
    await page.goto("/#/login");
    await fillDraft(page);
    for (let index = 0; index < 2; index++) {
      const submit = page.getByRole("button", { name: "Sign in", exact: true });
      await submit.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".auth-submit")).toBeDisabled();
      if (index === 1)
        await page
          .getByLabel("Username", { exact: true })
          .fill("changed_after_submit");
      releases[index]();
      await expect(
        page
          .getByRole("alert")
          .filter({
            hasText: `Fixture local sign-in unavailable ${index + 1}.`,
          }),
      ).toBeVisible();
      await expect(submit).toBeEnabled();
      await expect(
        index === 0 ? submit : page.getByLabel("Username", { exact: true }),
      ).toBeFocused();
    }
    expect(writes).toEqual([
      { username: "draft_local_observer", password: "fake-draft-password" },
      { username: "draft_local_observer", password: "fake-draft-password" },
    ]);
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
      "changed_after_submit",
    );
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
      "fake-draft-password",
    );
  } finally {
    releases.forEach((release) => release());
  }
});

test("an unavailable OAuth start stays local and can reconcile configured-only discovery", async ({
  page,
}) => {
  let documentedFixture = true;
  const outsideRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4190")
      outsideRequests.push(request.url());
  });
  await page.route("**/api/auth/providers", (route) =>
    documentedFixture
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            providers: [
              { id: "github", name: "GitHub", available: true, reason: null },
              {
                id: "google",
                name: "Google",
                available: false,
                reason: "Not configured on this server.",
              },
            ],
          }),
        })
      : route.continue(),
  );
  await page.route("**/api/auth/oauth/github/start", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Fixture OAuth start unavailable." }),
    }),
  );
  await page.goto("/#/login");
  await fillDraft(page);
  const github = optionsRegion(page).getByRole("button", {
    name: "Continue with GitHub",
    exact: true,
  });
  await expect(github).toBeEnabled();
  await github.focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Fixture OAuth start unavailable." }),
  ).toBeVisible();
  await expect(github).toBeFocused();
  await expect(page).toHaveURL(/#\/login$/);
  documentedFixture = false;
  await optionsRegion(page)
    .getByRole("button", { name: "Refresh sign-in options", exact: true })
    .click();
  await expect(
    optionsRegion(page).getByText("Not configured on this server.", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(github).toBeDisabled();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "draft_local_observer",
  );
  expect(outsideRequests).toEqual([]);
});
