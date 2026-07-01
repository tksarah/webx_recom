import { expect, test } from "@playwright/test";

const titleScenarios = [
  { name: "main Japanese mobile", path: "/", locale: "ja", width: 390, height: 844 },
  { name: "side events Japanese mobile", path: "/side-events", locale: "ja", width: 390, height: 844 },
  { name: "main English desktop", path: "/", locale: "en", width: 1280, height: 900 },
  { name: "side events English desktop", path: "/side-events", locale: "en", width: 1280, height: 900 },
] as const;

for (const scenario of titleScenarios) {
  test(`keeps the ${scenario.name} title on one line`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.addInitScript((locale) => {
      window.localStorage.setItem("webx-locale", locale);
      window.localStorage.setItem("webx-theme", "light");
    }, scenario.locale);

    await page.goto(scenario.path);
    await expectSingleLineTitle(page);
  });
}

async function expectSingleLineTitle(page: import("@playwright/test").Page) {
  const title = page.locator("h1.page-title");
  await expect(title).toBeVisible();

  const metrics = await title.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const lineCount = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0).length;
    range.detach();

    return {
      lineCount,
      parentWidth: element.parentElement?.clientWidth ?? 0,
      scrollWidth: element.scrollWidth,
      whiteSpace: style.whiteSpace,
    };
  });

  expect(metrics.whiteSpace).toBe("nowrap");
  expect(metrics.lineCount).toBe(1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.parentWidth + 1);
}
