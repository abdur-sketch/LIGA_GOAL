import { expect, test, type Page } from "@playwright/test";
async function login(page: Page) { await page.goto("/login"); await page.getByLabel("Email").fill("e2e-admin@ligagoal.test"); await page.getByLabel("Kata sandi").fill("E2E-password-123!"); await page.getByRole("button", { name: "Masuk ke dashboard" }).click(); await expect(page).toHaveURL(/\/dashboard/); }

test("platform operator can open operations, verification, moderation, and audit consoles", async ({ page }) => {
  await login(page);
  for (const [path, heading] of [["/admin", "National operations center"], ["/admin/platform-organizations", "Organization directory"], ["/admin/users", "Users & memberships"], ["/admin/verification", "Verifikasi organizer"], ["/admin/abuse", "Moderation & abuse"], ["/admin/audit", "Platform audit trail"]] as const) { await page.goto(path); await expect(page.getByRole("heading", { name: heading })).toBeVisible(); }
});

test("public verified badge and abuse form render on desktop and mobile", async ({ page }) => {
  await page.goto("/penyelenggara/e2e-liga-goal");
  await expect(page.getByText("Organizer terverifikasi")).toBeVisible();
  await page.getByRole("link", { name: "Laporkan profil" }).click();
  await expect(page.getByRole("heading", { name: "Laporkan konten" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Kategori")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim laporan" })).toBeVisible();
});
