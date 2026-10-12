import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

let cleanupEmail = "";
let cleanupSlug = "";

test.afterEach(async () => {
  if (!cleanupEmail) return;
  const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_SETUP_DATABASE_URL ?? process.env.DATABASE_URL } } });
  try {
    const organization = await db.organization.findUnique({ where: { slug: cleanupSlug }, select: { id: true } });
    const user = await db.user.findUnique({ where: { email: cleanupEmail }, select: { id: true } });
    if (organization) {
      await db.auditLog.deleteMany({ where: { organizationId: organization.id } });
      await db.organizationInvitation.deleteMany({ where: { organizationId: organization.id } });
      await db.organizationConsentRecord.deleteMany({ where: { organizationId: organization.id } });
      await db.organizerOnboarding.deleteMany({ where: { organizationId: organization.id } });
      await db.organization.delete({ where: { id: organization.id } });
    }
    if (user) { await db.auditLog.deleteMany({ where: { actorId: user.id } }); await db.user.delete({ where: { id: user.id } }); }
  } finally { await db.$disconnect(); cleanupEmail = ""; cleanupSlug = ""; }
});

test("registration, verification, login, and organization onboarding", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name.replace(/[^a-z]/g, "").slice(0, 8)}-${Date.now()}`;
  const email = `phase13-${suffix}@example.test`;
  cleanupEmail = email; cleanupSlug = `liga-e2e-${suffix}`.toLowerCase();
  await page.goto("/daftar");
  await page.getByPlaceholder("Nama lengkap").fill("Organizer Phase 13");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password kuat (minimal 12 karakter)").fill("Strong!Password1");
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Buat akun organizer" }).click();
  const preview = page.getByRole("link", { name: "Buka email sandbox lokal" });
  await expect(preview).toBeVisible();
  await preview.click();
  await expect(page.getByRole("status")).toContainText("berhasil diverifikasi");
  await page.getByRole("link", { name: "Lanjut ke halaman masuk" }).click();
  await page.getByPlaceholder("admin@organisasi.id").fill(email);
  await page.getByPlaceholder("Minimum 12 karakter").fill("Strong!Password1");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/organizer\/onboarding/);
  await page.getByLabel("Nama organisasi").fill(`Liga E2E ${suffix}`);
  await page.getByLabel("Slug").fill(cleanupSlug);
  await page.getByLabel("Wilayah").fill("DKI Jakarta");
  await page.getByLabel("Email kontak").fill(email);
  await page.getByText(/Ketentuan Penggunaan/).click();
  await page.getByText(/Pemberitahuan Privasi/).click();
  await page.getByRole("button", { name: "Buat workspace organisasi" }).click();
  await expect(page).toHaveURL(/\/organizer$/);
  await expect(page.getByRole("heading", { name: `Liga E2E ${suffix}` })).toBeVisible();
});
