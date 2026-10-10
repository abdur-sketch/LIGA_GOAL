import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Phase 6 player operations", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await login(page);
  });

  test("creates a transfer window from the desktop workflow", async ({ page }, testInfo) => {
    await page.goto("/admin/transfer-windows");
    await expect(page.getByRole("heading", { name: "Jendela transfer" })).toBeVisible();
    await page.getByRole("button", { name: "Tambah" }).click();
    await page.getByLabel("Kompetisi").selectOption({ index: 1 });
    await page.getByLabel("Musim").selectOption({ index: 1 });
    await page.getByLabel("Nama window").fill(`Window ${testInfo.project.name} ${Date.now()}`);
    await page.getByLabel("Dibuka").fill("2026-10-01T08:00");
    await page.getByLabel("Ditutup").fill("2026-12-31T23:00");
    await page.getByRole("button", { name: "Simpan data" }).click();
    await expect(page.getByText("Data berhasil disimpan.")).toBeVisible();
  });

  test("renders injury and suspension operations responsively", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/injuries");
    await expect(page.getByRole("heading", { name: "Cedera & medis" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tambah" })).toBeVisible();
    await page.goto("/admin/suspensions");
    await expect(page.getByRole("heading", { name: "Suspensi" })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});
