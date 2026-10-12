import { describe, expect, it } from "vitest";
import { ensureS3Buckets, objectStore } from "./object-store";
import { readPrivateDocument, savePrivateDocument } from "./private-documents";
function pdfFile(content: string, name = "document.pdf") { const bytes = new TextEncoder().encode(content); return { name, type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File; }

describe.skipIf(!process.env.S3_ENDPOINT)("S3-compatible private storage", () => {
  it("stores clean content, blocks cross-tenant reads, and quarantines suspicious content", async () => {
    await ensureS3Buckets();
    const clean = pdfFile("%PDF-1.7\nphase9 clean", "clean.pdf");
    const stored = await savePrivateDocument(clean, "phase9-tenant-a");
    expect((await readPrivateDocument(stored.storageKey, "phase9-tenant-a")).toString()).toContain("phase9 clean");
    await expect(readPrivateDocument(stored.storageKey, "phase9-tenant-b")).rejects.toMatchObject({ status: 404 });
    const malicious = pdfFile("%PDF-1.7\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE", "eicar.pdf");
    await expect(savePrivateDocument(malicious, "phase9-tenant-a")).rejects.toMatchObject({ status: 422 });
    expect((await objectStore().list("quarantine", "phase9-tenant-a")).length).toBeGreaterThan(0);
  });
});
