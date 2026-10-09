import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Phase 5 statistics", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await login(page);
  });

  test("renders standings filters and recompute action on desktop", async ({ page }) => {
    await page.goto("/admin/standings");
    await expect(page.getByRole("heading", { name: "Klasemen resmi" })).toBeVisible();
    await expect(page.getByLabel("Kompetisi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Recompute" })).toBeVisible();
  });

  test("renders player statistics responsively on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/statistics/players");
    await expect(page.getByRole("heading", { name: "Statistik pemain" })).toBeVisible();
    await expect(page.getByPlaceholder("Cari pemain atau klub…")).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});
