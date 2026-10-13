import { expect, type Page } from "@playwright/test";

export async function loginAsE2EAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await page.evaluate(async () => {
    const response = await fetch("/api/admin/organizations?pageSize=10&search=e2e-liga-goal");
    if (!response.ok) throw new Error("Organisasi fixture E2E tidak dapat dimuat.");
    const body = await response.json() as { data?: Array<{ id: string; slug: string }> };
    const organization = body.data?.find((item) => item.slug === "e2e-liga-goal");
    if (!organization) throw new Error("Organisasi fixture E2E tidak ditemukan.");
    window.localStorage.setItem("liga-goal.organization", organization.id);
  });
}
