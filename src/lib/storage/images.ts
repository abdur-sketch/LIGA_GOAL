import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/auth/api";
import { log } from "@/lib/observability/logger";
import { scanForMalware } from "./malware-scanner";
import { objectStore } from "./object-store";

const types = {
  "image/png": { ext: "png", valid: (bytes: Uint8Array) => [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) },
  "image/jpeg": { ext: "jpg", valid: (bytes: Uint8Array) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
  "image/webp": { ext: "webp", valid: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" },
} as const;

export async function saveImage(file: File) {
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) throw new ApiError(422, "Ukuran gambar harus antara 1 byte dan 2 MB.");
  const type = types[file.type as keyof typeof types];
  if (!type) throw new ApiError(422, "Format gambar harus PNG, JPEG, atau WebP.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!type.valid(bytes)) throw new ApiError(422, "Isi file tidak sesuai dengan tipe gambarnya.");
  const key = `${randomUUID()}.${type.ext}`; const store = objectStore();
  await store.put("quarantine", `public/${key}`, bytes, file.type);
  const scan = await scanForMalware(bytes);
  if (!scan.clean) { log("warn", "public_upload_quarantined", { key, engine: scan.engine, signature: scan.signature }); throw new ApiError(422, "Gambar ditolak oleh pemeriksaan keamanan."); }
  await store.move("quarantine", "public", `public/${key}`, file.type);
  return { key, url: `/api/media/${key}`, mimeType: file.type, size: file.size };
}

export async function loadImage(key: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new ApiError(404, "Gambar tidak ditemukan.");
  const store = objectStore();
  try { return await store.get("public", `public/${key}`); }
  catch (error) { if (process.env.STORAGE_DRIVER === "s3") throw error; return store.get("public", key); }
}

export function mimeForKey(key: string) { return key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg"; }
