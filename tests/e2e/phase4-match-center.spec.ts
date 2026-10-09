import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@ligagoal.test");
  await page.getByLabel("Kata sandi").fill("E2E-password-123!");
  await page.getByRole("button", { name: "Masuk ke dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test("Phase 4 match center pages render on desktop and mobile", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/admin/matches");
  await expect(
    page.getByRole("heading", { name: "Match Center" }),
  ).toBeVisible();
  const card = page.getByRole("link", { name: /Alpha FC.*Bravo FC/ }).first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/admin\/matches\//);
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Kontrol pertandingan" }),
  ).toBeVisible();
  for (const [route, heading] of [
    ["lineup", "Manajemen lineup"],
    ["live", "Quick actions"],
    ["review", "Verifikasi skor"],
  ] as const) {
    await page.goto(`${href}/${route}`);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Online|Offline/).first()).toBeVisible();
  }
});
