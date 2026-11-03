import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./helpers";

test("public registration portal is responsive and does not expose private participant data", async ({ page }) => {
  await page.goto("/daftar-lomba");
  await expect(page.getByRole("heading", { name: "Daftar lomba secara aman" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Formulir pendaftaran" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cek status" })).toBeVisible();
  await expect(page.getByText(/Informasi pribadi tidak dipublikasikan/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("contactEmail");
});

test("organizer operations dashboard renders protected pilot controls", async ({ page }) => {
  await loginAsE2EAdmin(page);
  await page.goto("/organizer/operations");
  await expect(page.getByRole("heading", { name: "Juri, pendaftaran & persetujuan hasil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Penugasan juri" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pendaftaran publik" })).toBeVisible();
  await expect(page.getByLabel("Slug publik")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Antrean verifikasi" })).toBeVisible();
  await expect(page.getByText(/Akses kontak, wali, dan dokumen dicatat/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workflow hasil" })).toBeVisible();
});
