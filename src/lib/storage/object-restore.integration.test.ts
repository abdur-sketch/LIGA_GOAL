import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/auth/api";
import { loadImage, saveImage } from "./images";
import { ensureS3Buckets, objectStore, type StorageArea } from "./object-store";
import { readPrivateDocument, savePrivateDocument } from "./private-documents";

const tenant = `phase10-${Date.now().toString(36)}`;
const created: Array<{ area: StorageArea; key: string }> = [];
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const file = (bytes: Uint8Array, name: string, type: string) => ({
  name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer,
}) as File;

describe.skipIf(!process.env.S3_ENDPOINT)("Phase 10 S3 emulator restore drill", () => {
  afterAll(async () => {
    const store = objectStore();
    await Promise.all(created.map(({ area, key }) => store.delete(area, key)));
  });

  it("backs up, deletes, restores, and re-authorizes public/private/quarantine objects", async () => {
    await ensureS3Buckets();
    const store = objectStore();
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const pdf = new TextEncoder().encode("%PDF-1.7\nPhase 10 synthetic private document");
    const quarantineKey = `${tenant}/${randomUUID()}.pdf`;
    const quarantine = new TextEncoder().encode("%PDF-1.7\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE");

    const publicObject = await saveImage(file(png, "public.png", "image/png"));
    const privateObject = await savePrivateDocument(file(pdf, "private.pdf", "application/pdf"), tenant);
    await store.put("quarantine", quarantineKey, quarantine, "application/pdf");
    const objects = [
      { area: "public" as const, key: `public/${publicObject.key}`, type: "image/png" },
      { area: "private" as const, key: privateObject.storageKey, type: "application/pdf" },
      { area: "quarantine" as const, key: quarantineKey, type: "application/pdf" },
    ];
    created.push(...objects.map(({ area, key }) => ({ area, key })));

    const backupStarted = performance.now();
    const backup = await Promise.all(objects.map(async (object) => {
      const bytes = await store.get(object.area, object.key);
      return { ...object, bytes, checksum: digest(bytes) };
    }));
    const backupMs = performance.now() - backupStarted;

    await Promise.all(objects.map((object) => store.delete(object.area, object.key)));
    for (const object of objects) await expect(store.get(object.area, object.key)).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);

    const restoreStarted = performance.now();
    await Promise.all(backup.map((object) => store.put(object.area, object.key, object.bytes, object.type)));
    const restoreMs = performance.now() - restoreStarted;

    for (const object of backup) expect(digest(await store.get(object.area, object.key))).toBe(object.checksum);
    expect(digest(await loadImage(publicObject.key))).toBe(backup[0].checksum);
    expect(digest(await readPrivateDocument(privateObject.storageKey, tenant))).toBe(backup[1].checksum);
    await expect(readPrivateDocument(privateObject.storageKey, `${tenant}-other`)).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);
    expect(await store.get("quarantine", quarantineKey)).toEqual(Buffer.from(quarantine));
    expect(await store.list("public", "public")).toContain(`public/${publicObject.key}`);
    expect(await store.list("private", tenant)).toContain(privateObject.storageKey);
    expect(await store.list("quarantine", tenant)).toContain(quarantineKey);

    console.info("PHASE10_STORAGE_DRILL", JSON.stringify({ objects: objects.length, rpoSeconds: 0, backupMs: Math.round(backupMs), restoreMs: Math.round(restoreMs) }));
  });
});
