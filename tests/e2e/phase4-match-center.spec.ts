import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin as login } from "./helpers";

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
