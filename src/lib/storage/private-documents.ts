import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "@/lib/auth/api";
import { log } from "@/lib/observability/logger";
import { scanForMalware } from "./malware-scanner";
import { objectStore } from "./object-store";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Map([["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);

function validSignature(bytes: Buffer, mimeType: string) {
  return mimeType === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : mimeType === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mimeType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
}

export async function savePrivateDocument(file: File, organizationId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(organizationId)) throw new ApiError(400, "Organisasi tidak valid.");
  const extension = ALLOWED.get(file.type);
  if (!extension) throw new ApiError(422, "Dokumen harus PDF, JPEG, PNG, atau WebP.");
  if (file.size < 1 || file.size > MAX_BYTES) throw new ApiError(422, "Ukuran dokumen harus antara 1 byte dan 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!validSignature(bytes, file.type)) throw new ApiError(422, "Isi file tidak sesuai dengan tipe dokumen.");
  const storageKey = `${organizationId}/${randomUUID()}${extension}`; const store = objectStore();
  await store.put("quarantine", storageKey, bytes, file.type);
  const scan = await scanForMalware(bytes);
  if (!scan.clean) { log("warn", "private_upload_quarantined", { organizationId, storageKey, engine: scan.engine, signature: scan.signature }); throw new ApiError(422, "Dokumen ditolak oleh pemeriksaan keamanan."); }
  await store.move("quarantine", "private", storageKey, file.type);
  log("info", "private_upload_promoted", { organizationId, storageKey, engine: scan.engine, sizeBytes: file.size });
  return { storageKey, originalName: path.basename(file.name).slice(0, 240), mimeType: file.type, sizeBytes: file.size };
}

export async function readPrivateDocument(storageKey: string, organizationId?: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(pdf|jpg|png|webp)$/.test(storageKey)) throw new ApiError(404, "Dokumen tidak ditemukan.");
  if (organizationId && !storageKey.startsWith(`${organizationId}/`)) throw new ApiError(404, "Dokumen tidak ditemukan.");
  return objectStore().get("private", storageKey);
}

export async function deletePrivateDocument(storageKey: string) { await objectStore().delete("private", storageKey); }
