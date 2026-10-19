import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const feed = (page) =>
  page.getByRole("region", { name: "Activity timeline", exact: true });
const rows = (page) => feed(page).locator("li.timeline-event");
const recorded = (page) =>
  feed(page).getByRole("list", { name: "Recorded activity", exact: true });
const older = (page) =>
  feed(page).getByRole("button", { name: "Load older activity", exact: true });
const ids = (page) =>
  rows(page).evaluateAll((items) => items.map((item) => item.dataset.event));
const isOlder = (route) =>
  new URL(route.request().url()).searchParams.has("before");
async function smallRead(route) {
  // Read-size fixture only: all rows/cursors come from the actual handler.
  const url = new URL(route.request().url());
  url.searchParams.set("limit", "2");
  const response = await route.fetch({ url: url.href });
  return route.fulfill({ response });
}
async function openTimeline(page) {
  const response = page.waitForResponse(
    (item) => item.url().endsWith("/api/state") && item.status() === 200,
  );
  await page.goto("/#/timeline");
  const initial = await (await response).json();
  await expect(
    page.getByRole("heading", { name: "Timeline", exact: true }),
  ).toBeVisible();
  return initial;
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
const observeWrites = (page) => {
  const writes = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  return writes;
};

test("changing a filter cancels its page and a late old response cannot unblock the new page", async ({
  page,
}) => {
  let olderReads = 0,
    releaseOld,
    releaseNew,
    oldFinished;
  const oldGate = new Promise((resolve) => {
    releaseOld = resolve;
  });
  const newGate = new Promise((resolve) => {
    releaseNew = resolve;
  });
  const oldDone = new Promise((resolve) => {
    oldFinished = resolve;
  });
  await page.route("**/api/timeline?*", async (route) => {
    const index = isOlder(route) ? ++olderReads : 0;
    if (index === 1) await oldGate;
    if (index === 2) await newGate;
    try {
      return await smallRead(route);
    } finally {
      if (index === 1) oldFinished();
    }
  });
  const writes = observeWrites(page);
  try {
    const initial = await openTimeline(page);
    await expect(rows(page)).toHaveCount(2);
    await older(page).click();
    await expect.poll(() => olderReads).toBe(1);
    const action = page.getByRole("combobox", { name: "Action", exact: true });
    await action.selectOption("review");
    await expect(rows(page)).toHaveCount(0);
    await action.selectOption("");
    await expect(rows(page)).toHaveCount(2);
    await expect(older(page)).toBeEnabled();
    await older(page).click();
    await expect.poll(() => olderReads).toBe(2);
    releaseOld();
    await oldDone;
    await expect(feed(page)).toHaveAttribute("aria-busy", "true");
    await expect(rows(page)).toHaveCount(2);
    await expect(
      feed(page).getByRole("button", { name: /^Loading/ }),
    ).toBeDisabled();
    releaseNew();
    await expect(rows(page)).toHaveCount(4);
    expect(new Set(await ids(page)).size).toBe(4);
    await unchanged(page, initial, writes);
  } finally {
    releaseOld();
    releaseNew();
    await page.unrouteAll({ behavior: "wait" });
  }
});

for (const chosenInput of [false, true]) {
  test(`terminal activity pagination ${chosenInput ? "respects another chosen input" : "restores keyboard entry to the recorded list"}`, async ({
    page,
  }) => {
    let release,
      started = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/timeline?*", async (route) => {
      if (isOlder(route)) {
        started = true;
        await gate;
      }
      return smallRead(route);
    });
    const writes = observeWrites(page);
    try {
      const initial = await openTimeline(page);
      await expect(rows(page)).toHaveCount(2);
      await older(page).focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => started).toBe(true);
      if (chosenInput) await page.locator("#search-input").focus();
      release();
      await expect(rows(page)).toHaveCount(4);
      await expect(older(page)).toHaveCount(0);
      await expect(
        chosenInput ? page.locator("#search-input") : recorded(page),
      ).toBeFocused();
      await unchanged(page, initial, writes);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}

test("successful head polling preserves a page error until explicit successful pagination", async ({
  page,
}) => {
  let olderReads = 0,
    heads = 0;
  await page.route("**/api/timeline?*", async (route) => {
    if (!isOlder(route)) heads++;
    else if (++olderReads === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Fixture older page unavailable." }),
      });
    return smallRead(route);
  });
  const writes = observeWrites(page),
    initial = await openTimeline(page);
  await expect(rows(page)).toHaveCount(2);
  await older(page).click();
  await expect(feed(page).getByRole("alert")).toContainText(
    "Fixture older page unavailable.",
  );
  await expect(older(page)).toBeFocused();
  await expect.poll(() => heads, { timeout: 7000 }).toBeGreaterThan(1);
  await expect(feed(page).getByRole("alert")).toContainText(
    "Use Load older activity to try again.",
  );
  await expect(rows(page)).toHaveCount(2);
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
  expect((await older(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
  if (process.env.CZ_CAPTURE_TIMELINE_RECOVERY === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({
      path: "runtime/verification/timeline-page-unavailable-2026-10-19.png",
      fullPage: true,
    });
  }
  await older(page).focus();
  await page.keyboard.press("Enter");
  await expect(rows(page)).toHaveCount(4);
  await expect(feed(page).getByRole("alert")).toHaveCount(0);
  await expect(recorded(page)).toBeFocused();
  await unchanged(page, initial, writes);
});

test("paused initial read failure describes its actual recovery and resumes without a write", async ({
  page,
}) => {
  // Timer simulation only; HTTP reads remain actual disposable service requests.
  await page.clock.install();
  let heads = 0;
  await page.route("**/api/timeline?*", (route) =>
    ++heads === 1
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Fixture initial timeline unavailable.",
          }),
        })
      : smallRead(route),
  );
  const writes = observeWrites(page),
    initial = await openTimeline(page);
  await expect(feed(page).getByRole("alert")).toContainText(
    "Fixture initial timeline unavailable.",
  );
  await feed(page)
    .getByRole("button", { name: "Pause updates", exact: true })
    .click();
  await expect(feed(page).getByRole("alert")).toContainText(
    "after you resume updates.",
  );
  await page.clock.fastForward(6000);
  expect(heads).toBe(1);
  const resume = feed(page).getByRole("button", {
    name: "Resume updates",
    exact: true,
  });
  await expect(resume).not.toHaveAttribute("aria-pressed");
  await resume.click();
  await page.clock.fastForward(3001);
  await expect(rows(page)).toHaveCount(2);
  await expect(feed(page).getByRole("alert")).toHaveCount(0);
  await unchanged(page, initial, writes);
});

async function advanceFixture(page, initial) {
  const response = await page.request.post("/api/advance", {
    headers: { "X-Commit-Zero": "local-demo" },
    data: { runId: initial.runId, version: initial.version },
  });
  expect(response.status()).toBe(200);
  const next = await response.json();
  expect(next.runId).toBe(initial.runId);
  expect(next.version).toBe(initial.version + 1);
  return next;
}

test("new scenario activity waits while reading and explicit show restores list focus", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/timeline?*", smallRead);
  const writes = observeWrites(page),
    initial = await openTimeline(page);
  await expect(rows(page)).toHaveCount(2);
  const before = await ids(page);
  await rows(page)
    .first()
    .evaluate((element) =>
      window.scrollTo(
        0,
        window.scrollY + element.getBoundingClientRect().top + 20,
      ),
    );
  const top = (await rows(page).first().boundingBox()).y;
  // Exactly one real deterministic scenario transaction in disposable storage.
  const next = await advanceFixture(page, initial);
  await page.clock.fastForward(3001);
  const show = feed(page).getByRole("button", {
    name: "Show new activity",
    exact: true,
  });
  await expect(show).toBeVisible();
  expect(await ids(page)).toEqual(before);
  expect(
    Math.abs((await rows(page).first().boundingBox()).y - top),
  ).toBeLessThanOrEqual(2);
  await show.focus();
  await page.keyboard.press("Enter");
  await expect(show).toHaveCount(0);
  await expect(recorded(page)).toBeFocused();
  expect(await ids(page)).not.toEqual(before);
  await unchanged(page, next, writes);
});

test("applying a newer head cancels its old cursor and full pagination has no event gaps", async ({
  page,
}) => {
  await page.clock.install();
  let releaseOld,
    olderReads = 0;
  const gate = new Promise((resolve) => {
    releaseOld = resolve;
  });
  await page.route("**/api/timeline?*", async (route) => {
    if (isOlder(route) && ++olderReads === 1) await gate;
    return smallRead(route);
  });
  const writes = observeWrites(page);
  try {
    const initial = await openTimeline(page);
    await expect(rows(page)).toHaveCount(2);
    const before = await ids(page);
    await older(page).click();
    await expect.poll(() => olderReads).toBe(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    const next = await advanceFixture(page, initial);
    await page.clock.fastForward(3001);
    await expect.poll(() => ids(page)).not.toEqual(before);
    await expect(older(page)).toBeEnabled();
    await expect(older(page)).toBeFocused();
    releaseOld();
    for (let pages = 0; pages < 10 && (await older(page).count()); pages++) {
      const count = await rows(page).count();
      await older(page).click();
      await expect.poll(() => rows(page).count()).toBeGreaterThan(count);
    }
    await expect(older(page)).toHaveCount(0);
    const response = await page.request.get(
      `/api/timeline?runId=${next.runId}&limit=100`,
    );
    expect(response.status()).toBe(200);
    const complete = await response.json();
    expect(await ids(page)).toEqual(
      complete.items.map((item) => String(item.id)),
    );
    await unchanged(page, next, writes);
  } finally {
    releaseOld();
    await page.unrouteAll({ behavior: "wait" });
  }
});
