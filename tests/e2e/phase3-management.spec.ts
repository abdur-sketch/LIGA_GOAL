import { expect, test } from "@playwright/test";
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
test("Phase 3 admin pages render responsively", async ({ page }) => {
  await login(page);
  for (const [route, heading] of [
    ["fixtures", "Fixture pertandingan"],
    ["groups", "Manajemen grup"],
    ["brackets", "Tournament bracket"],
    ["schedule", "Kalender pertandingan"],
  ] as const) {
    await page.goto(`/admin/${route}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
test("creates a six-match round-robin preview", async ({ page }) => {
  await login(page);
  await page.goto("/admin/fixtures/generate");
  await expect(
    page.getByRole("heading", { name: "Generator fixture" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate preview" }).click();
  await page
    .locator('select[name="competitionId"]')
    .selectOption({ label: "E2E Phase 3" });
  await page
    .locator('select[name="seasonId"]')
    .selectOption({ label: "Phase 3 2026" });
  await page
    .locator('select[name="stageId"]')
    .selectOption({ label: "Round Robin" });
  await page
    .locator('select[name="format"]')
    .selectOption("SINGLE_ROUND_ROBIN");
  await page.locator('select[name="drawMethod"]').selectOption("SEEDED");
  await page
    .locator('select[name="venueId"]')
    .selectOption({ label: "E2E Stadium" });
  await page
    .locator('select[name="refereeId"]')
    .selectOption({ label: "E2E Referee" });
  await page.locator('input[name="kickoffStart"]').fill("2026-11-01T10:00");
  await page
    .locator('select[name="clubIds"]')
    .selectOption([
      { label: "Alpha FC" },
      { label: "Bravo FC" },
      { label: "Charlie FC" },
      { label: "Delta FC" },
    ]);
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toContainText("berhasil disimpan");
  await expect(page.getByText("6 pertandingan").first()).toBeVisible();
});
