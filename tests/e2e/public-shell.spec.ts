import { expect, test } from "@playwright/test";

test("public homepage presents the PORTAL LOMBA shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/PORTAL LOMBA/);
  await expect(page.getByRole("heading", { name: /Semua Kompetisi/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("LIGA GOAL");
  await expect(page.getByRole("link", { name: /Jelajahi kompetisi/i })).toBeVisible();
});

test("anonymous dashboard access redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Selamat datang kembali/i })).toBeVisible();
});

test("unknown public route returns the branded not-found page", async ({ page }) => {
  const response = await page.goto("/route-yang-tidak-ada-sama-sekali");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman tidak tersedia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "PORTAL LOMBA beranda" })).toBeVisible();
});
