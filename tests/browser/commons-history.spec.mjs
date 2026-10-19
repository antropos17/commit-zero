import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("large saved chat reveals earlier messages without moving the reading anchor", async ({ page }) => {
  let snapshot;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const message = (index) => ({
    id: `heldout-history-${index}`, sequence: index,
    at: "2026-02-02T00:00:00.000Z", type: "message", actor: "operator",
    actorName: "Simulated history participant", repoId: "",
    text: `Held-out message ${index}: an independently sized history fixture.`,
  });
  await page.route("**/api/commons?**", async (route) => {
    if (!snapshot) {
      snapshot = await (await route.fetch()).json();
      snapshot.version = 1;
      snapshot.events = Array.from({ length: 147 }, (_, index) => message(index + 1));
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot) });
  });
  await page.goto("/#/commons");
  const log = page.getByRole("region", { name: "Saved messages" });
  const messages = log.locator(".commons-message");
  await expect(messages).toHaveCount(40);
  await expect(messages.first()).toContainText("Held-out message 108:");
  await expect(messages.last()).toContainText("Held-out message 147:");
  await page.getByRole("button", { name: "Pause updates", exact: true }).click();
  snapshot.events.push(message(148)); snapshot.version++;
  await page.getByRole("button", { name: "Resume updates", exact: true }).click();
  await expect(messages.last()).toContainText("Held-out message 148:");
  await expect(messages).toHaveCount(40);
  const earlier = page.getByRole("button", { name: "Show 40 earlier messages", exact: true });
  await earlier.scrollIntoViewIfNeeded();
  await log.evaluate((element) => { element.scrollTop = 0; });
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);
  const retained = messages.first();
  const retainedText = await retained.locator("p").textContent();
  const anchor = log.getByText(retainedText, { exact: true });
  const before = await anchor.evaluate((element) => element.getBoundingClientRect().top);
  await earlier.click();
  await expect(messages).toHaveCount(80);
  const after = await anchor.evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(2);
  await page.getByRole("button", { name: "Pause updates", exact: true }).click();
  snapshot.events.push(message(149)); snapshot.version++;
  await page.getByRole("button", { name: "Resume updates", exact: true }).click();
  await expect(messages).toHaveCount(81);
  await expect(messages.first()).toContainText("Held-out message 69:");
  await earlier.click();
  await expect(messages).toHaveCount(121);
  await page.getByRole("button", { name: "Show 28 earlier messages", exact: true }).click();
  await expect(messages).toHaveCount(149);
  await expect(messages.first()).toContainText("Held-out message 1:");
  await expect(page.getByRole("button", { name: /earlier messages/ })).toHaveCount(0);
  await messages.first().getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("region", { name: "New task" })).toContainText("Held-out message 1:");
  await expect(page.getByRole("button", { name: "Run agents", exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
});
