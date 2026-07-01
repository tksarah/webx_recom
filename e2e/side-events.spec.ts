import { expect, test } from "@playwright/test";

test("generates a side-event route from the top navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("webx-locale", "en");
    window.localStorage.setItem("webx-theme", "light");
  });

  await page.goto("/");
  await expect(page.getByText("Explore side events here")).toBeVisible();
  await expect(page.getByText("Recommended routes from the Luma calendar")).toBeVisible();
  await page.getByRole("link", { name: "Explore side events here" }).click();
  await expect(page).toHaveURL("/side-events");
  await expect(page.getByRole("heading", { name: "WebX 2026 Recommended Side-Event Route" })).toBeVisible();
  await expect(page.getByText(/side events/)).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('[data-field="topics"]')).toHaveAttribute("data-selection-mode", "multi");
  await expect(page.locator('[data-field="topics"] .selection-hint')).toHaveText("Select multiple");
  await expect(page.locator('[data-field="role"]')).toHaveAttribute("data-selection-mode", "single");
  await expect(page.locator('[data-field="role"] .selection-hint')).toHaveText("Select one");
  const stablecoinChoice = page.locator('[data-field="topics"]').getByRole("button", { name: /Stablecoins/ });
  await expect(stablecoinChoice).toHaveAttribute("data-selected", "true");
  await stablecoinChoice.click();
  await expect(stablecoinChoice).toHaveAttribute("data-selected", "false");
  await stablecoinChoice.click();
  await expect(stablecoinChoice).toHaveAttribute("data-selected", "true");

  await page.getByRole("button", { name: "Free text" }).click();
  await expect(page.locator('[data-field="days"] .selection-hint')).toHaveText("Select multiple");
  await expect(page.locator('[data-field="language"] .selection-hint')).toHaveText("Select one");
  await expect(page.locator('[data-field="density"] .selection-hint')).toHaveText("Select one");
  const generateButton = page.getByRole("button", { name: "Generate side-event route" });
  await expect(generateButton).toBeDisabled();
  await page.getByLabel("Side-event goal").fill("Stablecoin and RWA investor networking in the evening");
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  await expect(page.getByRole("heading", { name: /route stop/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Side-event route", exact: true })).toBeVisible();
  await expect(page.locator(".event-thumb-wrap, .event-thumb, .event-card-image")).toHaveCount(0);
  await expect(page.getByText(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View on Luma" }).first()).toHaveAttribute("href", /luma\.com|webx-asia\.com/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("webx-2026-side-events-route.pdf");

  await page.getByRole("link", { name: "Main sessions" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Generate route" })).toBeVisible();
});
