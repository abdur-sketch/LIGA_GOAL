import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./helpers";

test("public privacy request foundation renders without exposing records", async ({ page }) => {
  await page.goto("/privasi");
  await expect(page.getByRole("heading", { name: "Privasi dan publikasi data peserta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ajukan permintaan data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim permintaan" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("contactEmail");
});

test("release readiness center remains fail-closed for external gates", async ({ page }) => {
  await loginAsE2EAdmin(page);
  await page.goto("/admin/readiness");
  await expect(page.getByRole("heading", { name: "Production readiness center" })).toBeVisible();
  await expect(page.getByText("Production decision: NO-GO.").first()).toBeVisible();
  await expect(page.getByText("Human sign-off is intentionally absent.").first()).toBeVisible();
  await expect(page.getByText(/No staging provider backup\/restore evidence/).first()).toBeVisible();
});
