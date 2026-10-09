import { expect, test } from "@playwright/test";

test("public homepage presents the LIGA GOAL shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/LIGA GOAL/);
  await expect(page.getByRole("heading", { name: /Semua liga/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Jelajahi kompetisi/i })).toBeVisible();
});

test("anonymous dashboard access redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Selamat datang kembali/i })).toBeVisible();
});
