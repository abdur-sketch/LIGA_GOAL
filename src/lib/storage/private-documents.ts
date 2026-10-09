import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/auth/api";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Map([["application/pdf", ".pdf"], ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);
const root = path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), ".private-uploads"));

export async function savePrivateDocument(file: File, organizationId: string) {
  const extension = ALLOWED.get(file.type);
  if (!extension) throw new ApiError(422, "Dokumen harus PDF, JPEG, PNG, atau WebP.");
  if (file.size < 1 || file.size > MAX_BYTES) throw new ApiError(422, "Ukuran dokumen harus antara 1 byte dan 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const validSignature = file.type === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : file.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!validSignature) throw new ApiError(422, "Isi file tidak sesuai dengan tipe dokumen.");
  const tenantFolder = path.join(/* turbopackIgnore: true */ root, organizationId);
  await mkdir(tenantFolder, { recursive: true, mode: 0o700 });
  const name = `${randomUUID()}${extension}`;
  await writeFile(path.join(/* turbopackIgnore: true */ tenantFolder, name), bytes, { mode: 0o600, flag: "wx" });
  return { storageKey: `${organizationId}/${name}`, originalName: path.basename(file.name).slice(0, 240), mimeType: file.type, sizeBytes: file.size };
}

export async function readPrivateDocument(storageKey: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(pdf|jpg|png|webp)$/.test(storageKey)) throw new ApiError(404, "Dokumen tidak ditemukan.");
  const absolute = path.resolve(root, storageKey);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new ApiError(404, "Dokumen tidak ditemukan.");
  try { return await readFile(/* turbopackIgnore: true */ absolute); } catch { throw new ApiError(404, "Dokumen tidak ditemukan."); }
}
