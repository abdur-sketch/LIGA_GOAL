import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin as login } from "./helpers";

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
