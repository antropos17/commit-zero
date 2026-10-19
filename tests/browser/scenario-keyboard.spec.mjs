import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openWorkspace(page) {
  const response = page.waitForResponse((item) => item.url().endsWith("/api/state") && item.status() === 200);
  await page.goto("/#/home");
  const state = await (await response).json();
  await expect(page.locator("#playback-status")).toHaveText(`Step ${state.step} / 10`);
  return state;
}

test("keyboard stepping reaches completion and a new run preserves exported history", async ({ page }) => {
  const initial = await openWorkspace(page);
  const next = page.getByRole("button", { name: "Next step", exact: true });
  await page.locator("#playback-toggle").focus();
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  for (let step = initial.step + 1; step <= 10; step++) {
    await page.keyboard.press("Enter");
    await expect(page.locator("#playback-status")).toHaveText(`Step ${step} / 10`);
    if (step < 10) await expect(next).toBeFocused();
  }
  await expect(next).toBeDisabled();
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Refresh workspace", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "New run", exact: true })).toBeFocused();
  const created = page.waitForResponse((item) => item.url().endsWith("/api/runs") && item.status() === 200);
  await page.keyboard.press("Enter");
  const fresh = await (await created).json();
  expect(fresh.runId).not.toBe(initial.runId);
  await expect(page.locator("#playback-status")).toHaveText("Step 0 / 10");
  await expect(page.getByRole("button", { name: "Play cycle", exact: true })).toBeFocused();
  const exported = await page.request.get(`/api/runs/${initial.runId}/export`);
  expect(exported.status()).toBe(200);
  expect((await exported.json()).state.step).toBe(10);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("failed manual step preserves the revision and recovery never repeats the write", async ({ page }) => {
  const initial = await openWorkspace(page);
  let writes = 0;
  await page.route("**/api/advance", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({ runId: initial.runId, version: initial.version });
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture step unavailable." }) });
  });
  const next = page.getByRole("button", { name: "Next step", exact: true });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Fixture step unavailable.");
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("main")).toBeFocused();
  await expect(page.locator("#playback-status")).toHaveText(`Step ${initial.step} / 10`);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("main")).toBeFocused();
  expect(writes).toBe(1);
  const current = await (await page.request.get("/api/state")).json();
  expect([current.runId, current.version, current.step]).toEqual([initial.runId, initial.version, initial.step]);
});

for (const chooseSearch of [false, true]) test(`keyboard pause stops future steps and ${chooseSearch ? "preserves a chosen input" : "restores its control"}`, async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const initial = await openWorkspace(page);
  let release, writes = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/advance", async (route) => {
    writes++;
    await gate;
    await route.continue();
  });
  try {
    const toggle = page.locator("#playback-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveText("Pause cycle");
    await expect(toggle).not.toHaveAttribute("aria-pressed");
    await page.clock.runFor(1800);
    await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveText("Play cycle");
    const finished = page.waitForResponse((item) => item.url().endsWith("/api/advance") && item.status() === 200);
    const search = page.getByRole("searchbox", { name: "Search agents, repositories, and pull requests" });
    if (chooseSearch) await search.fill("pause keeps this input");
    release();
    await finished;
    await expect(page.locator("#playback-status")).toHaveText(`Step ${initial.step + 1} / 10`);
    await expect(chooseSearch ? search : toggle).toBeFocused();
    await page.clock.runFor(7200);
    expect(writes).toBe(1);
    await expect(page.locator("#playback-status")).toHaveText(`Step ${initial.step + 1} / 10`);
    await page.clock.resume();
  } finally { release(); }
});
