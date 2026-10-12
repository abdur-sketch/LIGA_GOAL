import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { objectStore } from "./object-store";
import { readPrivateDocument, savePrivateDocument } from "./private-documents";

let root = "";
function pdfFile(content: string, name = "document.pdf") { const bytes = new TextEncoder().encode(content); return { name, type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File; }
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "liga-goal-storage-"));
  process.env.STORAGE_DRIVER = "local"; process.env.PRIVATE_UPLOAD_DIR = path.join(root, "private"); process.env.QUARANTINE_UPLOAD_DIR = path.join(root, "quarantine"); process.env.MALWARE_SCANNER = "signature";
});
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("private document storage", () => {
  it("rejects a file whose signature does not match its declared MIME type", async () => {
    const bytes = new TextEncoder().encode("not a real PDF");
    const file = { name: "identity.pdf", type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer } as File;
    await expect(savePrivateDocument(file, "test-tenant")).rejects.toMatchObject({ status: 422 });
  });
  it("rejects unsupported document types before writing", async () => {
    const file = new File(["plain text"], "identity.txt", { type: "text/plain" });
    await expect(savePrivateDocument(file, "test-tenant")).rejects.toMatchObject({ status: 422 });
  });
  it("promotes a clean file and enforces the tenant prefix when reading", async () => {
    const file = pdfFile("%PDF-1.7\nclean synthetic file", "clean.pdf");
    const stored = await savePrivateDocument(file, "tenant-a");
    expect((await readPrivateDocument(stored.storageKey, "tenant-a")).toString()).toContain("clean synthetic");
    await expect(readPrivateDocument(stored.storageKey, "tenant-b")).rejects.toMatchObject({ status: 404 });
  });
  it("keeps suspicious files in quarantine and never promotes them", async () => {
    const file = pdfFile("%PDF-1.7\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE", "eicar.pdf");
    await expect(savePrivateDocument(file, "tenant-a")).rejects.toMatchObject({ status: 422 });
    expect(await objectStore().list("quarantine", "tenant-a")).toHaveLength(1);
  });
});
