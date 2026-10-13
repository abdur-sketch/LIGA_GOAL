import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin as login } from "./helpers";

test("creates a permanent player profile and opens its detail", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto("/admin/players");
  await expect(
    page.getByRole("heading", { name: "Database pemain" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah Pemain" }).click();
  const fullName = `Pemain ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Nama lengkap").fill(fullName);
  await page
    .getByLabel("Nama tampilan")
    .fill(`Pemain ${testInfo.project.name}`);
  await page.getByLabel("Tanggal lahir").fill("2007-05-10");
  await page.getByLabel("Posisi utama").fill("Penyerang");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toContainText("berhasil ditambahkan");
  const row = page.locator("tbody tr").filter({ hasText: fullName });
  await expect(row).toBeVisible();
  const detailHref = await row
    .getByRole("link", { name: "Detail" })
    .getAttribute("href");
  expect(detailHref).toMatch(/^\/admin\/players\//);
  await page.goto(detailHref!);
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible({
    timeout: 15_000,
  });
});

test("registration and squad pages provide workflow and working exports", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/registrations");
  await expect(
    page.getByRole("heading", { name: "Registrasi pemain" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tambah Registrasi" }),
  ).toBeVisible();
  await page.goto("/admin/squads");
  await expect(
    page.getByRole("heading", { name: "Manajemen skuad" }),
  ).toBeVisible();
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF" }).click();
  expect((await pdfPromise).suggestedFilename()).toBe("liga-goal-roster.pdf");
  const excelPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Excel" }).click();
  expect((await excelPromise).suggestedFilename()).toBe(
    "liga-goal-roster.xlsx",
  );
});
