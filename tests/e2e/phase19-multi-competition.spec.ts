import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./helpers";

test("organizer creates an LCT competition, participant, entry, and session", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name.startsWith("mobile") ? "m" : "d"}-${Date.now()}`;
  const competitionName = `LCT Multi ${suffix}`;
  const participantName = `Regu Cerdas ${suffix}`;
  await loginAsE2EAdmin(page);
  await page.goto("/organizer/competitions");
  await expect(page.getByRole("heading", { name: "Kelola semua jenis lomba" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Lomba Cerdas Tangkas/ })).toBeAttached();

  const competitionForm = page.locator("form").filter({ has: page.getByText("Template", { exact: true }) });
  await competitionForm.locator("select[name=templateCode]").selectOption("lct");
  await competitionForm.locator("input[name=name]").fill(competitionName);
  await competitionForm.locator("input[name=slug]").fill(`lct-multi-${suffix}`);
  await competitionForm.getByRole("button", { name: "Buat kompetisi" }).click();
  await expect(page.getByRole("button", { name: new RegExp(competitionName) })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(competitionName) }).click();

  const participantForm = page.locator("form").filter({ has: page.getByPlaceholder("Nama peserta atau regu") });
  await participantForm.getByPlaceholder("Nama peserta atau regu").fill(participantName);
  await participantForm.getByPlaceholder("slug-peserta").fill(`regu-cerdas-${suffix}`);
  await participantForm.getByRole("button", { name: "Tambah peserta" }).click();

  const entryForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Daftarkan ke lomba" }) });
  await entryForm.locator("select[name=participantId]").selectOption({ label: `${participantName} · TEAM` });
  await entryForm.getByRole("button", { name: "Daftarkan ke lomba" }).click();
  await expect(page.getByText(participantName, { exact: true }).first()).toBeVisible();

  const sessionForm = page.locator("form").filter({ has: page.getByPlaceholder("Penyisihan / Final / Penampilan 1") });
  await sessionForm.getByPlaceholder("Penyisihan / Final / Penampilan 1").fill("Babak Penyisihan");
  await sessionForm.locator("input[name=sequence]").fill("1");
  await sessionForm.getByLabel(participantName).check();
  await sessionForm.getByRole("button", { name: "Tambah sesi" }).click();
  await expect(page.getByText(/Babak Penyisihan/).first()).toBeVisible();
});

test("public generic directories render on desktop and mobile", async ({ page }) => {
  for (const path of ["/agenda", "/hasil", "/peserta"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("PORTAL LOMBA").first()).toBeVisible();
  }
});
