import { test, expect } from "@playwright/test";

test("generates routes from quick and free text input, then downloads pdf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("webx-locale")) {
      window.localStorage.setItem("webx-locale", "ja");
    }
    if (!window.localStorage.getItem("webx-theme")) {
      window.localStorage.setItem("webx-theme", "light");
    }
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("決済・送金・通貨活用")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("新規事業や提携を探したい")).toBeVisible();

  await page.getByRole("button", { name: "自由入力" }).click();
  await expect(page.getByLabel("参加目的")).toBeVisible({ timeout: 15_000 });
  const generateButton = page.getByRole("button", { name: "おすすめルートを作成" });
  await expect(generateButton).toBeDisabled();

  await page.getByLabel("参加目的").fill("A");
  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(page.getByRole("heading", { name: /件のルート/ })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "かんたん診断" }).click();
  await page.getByRole("button", { name: "おすすめルートを作成" }).click();

  await expect(page.getByRole("heading", { name: /件のルート/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "参加ルート", exact: true })).toBeVisible();
  await expect(page.getByText(/登壇者: /).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "公式Agendaで確認" }).first()).toHaveAttribute("href", /webx-asia\.com\/agenda\//);

  const downloadPromise = page.waitForEvent("download");
  const pdfButton = page.getByRole("button", { name: "PDFをダウンロード" });
  await expect(pdfButton.getByText("PDF")).toBeVisible();
  await pdfButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("webx-2026-route.pdf");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Generate route" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Route", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top Picks", exact: true })).toBeVisible();
  await expect(page.getByText(/Speakers: /).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" }).getByText("PDF")).toBeVisible();
  await expect(page.getByRole("link", { name: "View on official Agenda" }).first()).toHaveAttribute("href", /webx-asia\.com\/agenda\//);

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("The Prince Park Tower Tokyo")).toBeVisible();
  await expect(page.getByRole("heading", { name: /route stop/ })).toHaveCount(0);
});
