import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/auth/api";

const types = {
  "image/png": { ext: "png", valid: (bytes: Uint8Array) => [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) },
  "image/jpeg": { ext: "jpg", valid: (bytes: Uint8Array) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
  "image/webp": { ext: "webp", valid: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" },
} as const;

function uploadDirectory() { return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || ".uploads"); }

export async function saveImage(file: File) {
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) throw new ApiError(422, "Ukuran gambar harus antara 1 byte dan 2 MB.");
  const type = types[file.type as keyof typeof types];
  if (!type) throw new ApiError(422, "Format gambar harus PNG, JPEG, atau WebP.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!type.valid(bytes)) throw new ApiError(422, "Isi file tidak sesuai dengan tipe gambarnya.");
  const key = `${randomUUID()}.${type.ext}`;
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true, mode: 0o750 });
  await writeFile(path.join(/* turbopackIgnore: true */ directory, key), bytes, { flag: "wx", mode: 0o640 });
  return { key, url: `/api/media/${key}`, mimeType: file.type, size: file.size };
}

export async function loadImage(key: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new ApiError(404, "Gambar tidak ditemukan.");
  try { return await readFile(path.join(/* turbopackIgnore: true */ uploadDirectory(), key)); }
  catch { throw new ApiError(404, "Gambar tidak ditemukan."); }
}

export function mimeForKey(key: string) { return key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg"; }
