import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Phase 7 public portal", () => {
  test("renders real public competition and match data without login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Semua Liga/i })).toBeVisible();
    await expect(page.getByText("E2E Phase 3").first()).toBeVisible();
    await page.goto("/pertandingan");
    await expect(page.getByRole("heading", { name: "Semua pertandingan" })).toBeVisible();
    await expect(page.getByText("Alpha FC").first()).toBeVisible();
    await page.goto("/kompetisi/e2e-phase-3");
    await expect(page.getByRole("heading", { name: "E2E Phase 3" })).toBeVisible();
    await expect(page.getByText("Alpha FC").first()).toBeVisible();
  });

  test("creates and publishes safe news through the CMS", async ({ page }, testInfo) => {
    await login(page);
    await page.goto("/admin/articles");
    await expect(page.getByRole("heading", { name: "Berita & pengumuman" })).toBeVisible();
    const title = `Berita Portal ${testInfo.project.name} ${Date.now()}`;
    await page.getByLabel("Judul").fill(title);
    await page.getByLabel("Ringkasan").fill("Ringkasan berita resmi.");
    await page.getByLabel(/Isi/).fill("Isi berita aman dari penyelenggara.");
    await page.getByRole("button", { name: "Buat draft" }).click();
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("DRAFT");
    await row.getByRole("button", { name: "Terbitkan" }).click();
    await expect(row).toContainText("PUBLISHED");
    await page.goto("/berita");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("keeps public pages usable at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/pertandingan", "/kompetisi", "/klasemen", "/statistik", "/klub", "/pemain", "/berita"]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
