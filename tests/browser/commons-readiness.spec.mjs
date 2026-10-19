import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const group = (page) =>
  page.getByRole("group", { name: "Model readiness", exact: true });
const status = (page) => group(page).getByRole("status");
const check = (page) =>
  group(page).getByRole("button", { name: "Check model", exact: true });
const run = (page) =>
  group(page).getByRole("button", { name: "Run agents", exact: true });
async function versions(page) {
  const scenarioResponse = await page.request.get("/api/state");
  expect(scenarioResponse.status()).toBe(200);
  const scenario = await scenarioResponse.json();
  const commonsResponse = await page.request.get(
    `/api/commons?runId=${scenario.runId}`,
  );
  expect(commonsResponse.status()).toBe(200);
  const commons = await commonsResponse.json();
  return {
    runId: scenario.runId,
    version: scenario.version,
    step: scenario.step,
    commonsVersion: commons.version,
    jobs: commons.jobs.length,
    events: commons.events.length,
  };
}
async function openRoom(page) {
  const writes = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/#/commons/safe-timer?view=tasks");
  await expect(check(page)).toBeEnabled();
  await page
    .getByLabel("Task", { exact: true })
    .fill("Readiness fixture draft; never submit this task.");
  return { writes, initial: await versions(page) };
}
async function unchanged(page, before) {
  expect(await versions(page)).toEqual(before.initial);
  expect(before.writes).toEqual([]);
}

test("malformed model metadata stays unknown and explicitly recovers without changing the task draft", async ({
  page,
}) => {
  let variant = "available",
    valid = false;
  await page.route("**/api/commons/provider", (route) => {
    if (valid) return route.continue();
    const body = {
      available: false,
      busy: false,
      reason: "Fixture metadata only; no model execution.",
    };
    if (variant === "available") body.available = "false";
    if (variant === "busy") body.busy = "false";
    if (variant === "missing-busy") delete body.busy;
    if (variant === "reason") body.reason = { invalid: true };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  const before = await openRoom(page);
  for (const value of ["available", "busy", "missing-busy", "reason"]) {
    variant = value;
    if (value !== "available") await check(page).click();
    await expect(status(page)).toContainText("invalid model status");
    await expect(group(page)).toHaveAttribute("aria-busy", "false");
    await expect(run(page)).toBeDisabled();
    await expect(status(page)).not.toContainText("Builder then Reviewer");
    await expect(
      page.getByRole("navigation", { name: "Main navigation", exact: true }),
    ).toBeVisible();
  }
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
  if (process.env.CZ_CAPTURE_COMMONS_READINESS === "1") {
    await mkdir("runtime/verification", { recursive: true });
    await page.screenshot({
      path: "runtime/verification/commons-readiness-unknown-2026-10-19.png",
      fullPage: true,
    });
  }
  valid = true;
  await check(page).focus();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText(/offline|not running|unavailable/i);
  await expect(check(page)).toBeFocused();
  await expect(page.getByLabel("Task", { exact: true })).toHaveValue(
    "Readiness fixture draft; never submit this task.",
  );
  await unchanged(page, before);
});

test("manual readiness checks restore their action or respect another chosen input", async ({
  page,
}) => {
  let reads = 0,
    releaseFirst,
    releaseLast;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const lastGate = new Promise((resolve) => {
    releaseLast = resolve;
  });
  await page.route("**/api/commons/provider", async (route) => {
    reads++;
    if (reads === 2) await firstGate;
    if (reads === 3) await lastGate;
    return route.continue();
  });
  try {
    const before = await openRoom(page);
    await check(page).focus();
    await page.keyboard.press("Enter");
    await expect(group(page)).toHaveAttribute("aria-busy", "true");
    await expect(run(page)).toBeDisabled();
    releaseFirst();
    await expect(group(page)).toHaveAttribute("aria-busy", "false");
    await expect(check(page)).toBeFocused();
    await check(page).click();
    await expect(group(page)).toHaveAttribute("aria-busy", "true");
    await page.getByLabel("Task", { exact: true }).focus();
    releaseLast();
    await expect(group(page)).toHaveAttribute("aria-busy", "false");
    await expect(page.getByLabel("Task", { exact: true })).toBeFocused();
    await unchanged(page, before);
  } finally {
    releaseFirst();
    releaseLast();
    await page.unrouteAll({ behavior: "wait" });
  }
});

for (const oldFirst of [false, true]) {
  test(`a superseded readiness response cannot ${oldFirst ? "settle a newer pending check" : "replace a newer offline result"}`, async ({
    page,
  }) => {
    let reads = 0,
      releaseOld,
      releaseNew,
      finishedOld;
    const oldGate = new Promise((resolve) => {
      releaseOld = resolve;
    });
    const newGate = new Promise((resolve) => {
      releaseNew = resolve;
    });
    const oldDone = new Promise((resolve) => {
      finishedOld = resolve;
    });
    await page.route("**/api/commons/provider", async (route) => {
      const index = ++reads;
      if (index === 2) {
        await oldGate;
        try {
          // Readiness metadata fixture only. Never press Run agents or infer.
          return await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              available: true,
              busy: false,
              name: "fixture-metadata-only-no-model",
            }),
          });
        } finally {
          finishedOld();
        }
      }
      if (index === 3) await newGate;
      return route.continue();
    });
    try {
      const before = await openRoom(page);
      await check(page).click();
      await expect.poll(() => reads).toBe(2);
      await page
        .getByRole("button", { name: "Pause updates", exact: true })
        .click();
      await expect.poll(() => reads).toBe(3);
      if (oldFirst) {
        releaseOld();
        await oldDone;
        await expect(group(page)).toHaveAttribute("aria-busy", "true");
        await expect(
          group(page).getByRole("button", {
            name: "Checking model",
            exact: true,
          }),
        ).toBeDisabled();
        await expect(run(page)).toBeDisabled();
        releaseNew();
      } else {
        releaseNew();
        await expect(status(page)).toContainText(
          /offline|not running|unavailable/i,
        );
        releaseOld();
        await oldDone;
      }
      await expect(group(page)).toHaveAttribute("aria-busy", "false");
      await expect(status(page)).toContainText(
        /offline|not running|unavailable/i,
      );
      await expect(run(page)).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Resume updates", exact: true }),
      ).toBeFocused();
      await expect(page.getByLabel("Task", { exact: true })).toHaveValue(
        "Readiness fixture draft; never submit this task.",
      );
      await unchanged(page, before);
    } finally {
      releaseOld();
      releaseNew();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}
