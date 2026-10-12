import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("organizer can inspect the catalog and authoritative usage without live payment", async ({ page }) => {
  await login(page);
  await page.goto("/organizer/billing");
  await expect(page.getByRole("heading", { name: "Paket & penggunaan" })).toBeVisible();
  await expect(page.getByText("Enterprise", { exact: true })).toBeVisible();
  await expect(page.getByText("SIMULASI LOKAL")).toBeVisible();
  await page.getByRole("link", { name: "Bandingkan paket" }).click();
  await expect(page.getByRole("heading", { name: "Perbandingan paket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulasi — segera hadir" }).first()).toBeDisabled();
  await page.goto("/organizer/billing/usage");
  await expect(page.getByRole("heading", { name: "Penggunaan kuota" })).toBeVisible();
  await expect(page.getByText("competition.active")).toBeVisible();
});

test("platform admin can open audited subscription controls", async ({ page }) => {
  await login(page);
  await page.goto("/admin/subscriptions");
  await expect(page.getByRole("heading", { name: "Organization subscriptions" })).toBeVisible();
  const organization = page.getByRole("article").filter({ hasText: "E2E Liga Goal" });
  await expect(organization.getByText("E2E Liga Goal", { exact: true })).toBeVisible();
  await expect(page.getByText("tidak ada pembayaran nyata", { exact: false })).toBeVisible();
  await organization.getByText("Kelola", { exact: true }).click();
  await expect(organization.getByRole("button", { name: "Simpan kontrol" })).toBeVisible();
});
