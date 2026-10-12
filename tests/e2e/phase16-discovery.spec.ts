import { expect, test } from "@playwright/test";

test.describe("Phase 16 national discovery", () => {
  test("desktop can discover a published competition, region, and organizer", async ({ page }) => {
    await page.goto("/kompetisi");
    await expect(page.getByRole("heading", { name: "Temukan kompetisi sepak bola" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Cari kompetisi" }).fill("E2E Phase 3");
    await page.getByRole("button", { name: "Terapkan pencarian" }).click();
    await expect(page.getByRole("link", { name: /E2E Phase 3/ })).toBeVisible();
    await page.getByRole("link", { name: /E2E Phase 3/ }).click();
    await expect(page.getByRole("heading", { name: "E2E Phase 3" })).toBeVisible();
    await page.goto("/penyelenggara/e2e-liga-goal");
    await expect(page.getByRole("heading", { name: "E2E Liga Goal" })).toBeVisible();
  });

  test("mobile directory is usable without exposing moderation states", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/penyelenggara");
    await expect(page.getByRole("heading", { name: "Penyelenggara terverifikasi" })).toBeVisible();
    await expect(page.getByText("E2E Liga Goal", { exact: true })).toBeVisible();
    await expect(page.getByText("PENDING_REVIEW")).toHaveCount(0);
    await expect(page.getByText("SUSPENDED")).toHaveCount(0);
  });
});
