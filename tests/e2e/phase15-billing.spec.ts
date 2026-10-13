import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin as login } from "./helpers";

test("creates an immutable sandbox invoice and activates only through verified simulation", async ({ page }) => {
  await login(page); await page.goto("/organizer/billing/checkout");
  await expect(page.getByRole("heading", { name: "Checkout simulasi" })).toBeVisible();
  await page.getByLabel("Paket").selectOption("TOURNAMENT");
  await page.getByLabel("Kompetisi (wajib untuk Tournament/Pro League)").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Buat invoice simulasi" }).click();
  await expect(page).toHaveURL(/\/organizer\/billing\/invoices\//);
  await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
  await expect(page.getByText("SANDBOX / SIMULASI", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Simulasikan PAID" }).click();
  await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Unduh PDF simulasi" })).toBeVisible();
  await page.goto("/organizer/billing/transactions");
  await expect(page.getByRole("heading", { name: "Transaksi sandbox" })).toBeVisible();
  await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();
});

test("finance console is isolated behind explicit platform finance permission", async ({ page }) => {
  await login(page); await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Financial integrity console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invoices" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reconcile" }).first()).toBeVisible();
});
