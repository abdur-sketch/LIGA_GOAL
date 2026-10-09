import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test("authorized admin creates and finds a competition", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/admin/competitions");
  await expect(page.getByRole("heading", { name: "Kompetisi & peserta" })).toBeVisible();
  await page.getByRole("button", { name: "Tambah Kompetisi" }).click();
  const suffix = `${testInfo.project.name}-${Date.now()}`.toLowerCase();
  await page.getByLabel(/^Nama \*/).fill(`Liga E2E ${testInfo.project.name}`);
  await page.getByLabel(/^Slug \*/).fill(`liga-${suffix}`);
  await page.getByLabel(/^Format \*/).selectOption("SINGLE_ROUND_ROBIN");
  await page.getByLabel(/^Status \*/).selectOption("DRAFT");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toContainText("berhasil dibuat");
  await expect(page.locator("tbody").getByText(`Liga E2E ${testInfo.project.name}`, { exact: true }).first()).toBeVisible();
});

test("admin management pages render on protected routes", async ({ page }) => {
  await login(page);
  for (const route of ["organizations", "seasons", "clubs", "venues", "officials"]) {
    await page.goto(`/admin/${route}`);
    await expect(page.locator("main h1:visible").first()).toBeVisible();
  }
});
