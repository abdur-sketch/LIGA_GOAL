import { CopyObjectCommand, CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, readdir, unlink, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/auth/api";

export type StorageArea = "public" | "private" | "quarantine";

export interface ObjectStore {
  put(area: StorageArea, key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(area: StorageArea, key: string): Promise<Buffer>;
  move(from: StorageArea, to: StorageArea, key: string, contentType: string): Promise<void>;
  delete(area: StorageArea, key: string): Promise<void>;
  list(area: StorageArea, prefix?: string): Promise<string[]>;
}

function safeKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(key) || key.includes("..")) throw new ApiError(400, "Object key tidak valid.");
  return key;
}

function localRoot(area: StorageArea) {
  if (area === "public") return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || ".uploads");
  if (area === "private") return path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_UPLOAD_DIR || ".private-uploads");
  return path.resolve(/* turbopackIgnore: true */ process.env.QUARANTINE_UPLOAD_DIR || ".quarantine-uploads");
}

function localPath(area: StorageArea, key: string) {
  const root = localRoot(area);
  const resolved = path.resolve(root, safeKey(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new ApiError(400, "Object key tidak valid.");
  return resolved;
}

class LocalObjectStore implements ObjectStore {
  async put(area: StorageArea, key: string, bytes: Uint8Array) {
    const target = localPath(area, key);
    await mkdir(path.dirname(target), { recursive: true, mode: area === "public" ? 0o750 : 0o700 });
    await writeFile(target, bytes, { flag: "wx", mode: area === "public" ? 0o640 : 0o600 });
  }
  async get(area: StorageArea, key: string) {
    try { return await readFile(/* turbopackIgnore: true */ localPath(area, key)); } catch { throw new ApiError(404, "Objek tidak ditemukan."); }
  }
  async move(from: StorageArea, to: StorageArea, key: string) {
    const source = localPath(from, key); const target = localPath(to, key);
    await mkdir(path.dirname(target), { recursive: true, mode: to === "public" ? 0o750 : 0o700 });
    await copyFile(source, target, 1); await unlink(source);
  }
  async delete(area: StorageArea, key: string) { try { await unlink(localPath(area, key)); } catch { /* idempotent cleanup */ } }
  async list(area: StorageArea, prefix = "") {
    const root = localRoot(area); const start = prefix ? localPath(area, prefix) : root; const found: string[] = [];
    async function walk(directory: string) { for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) { const child = path.join(directory, entry.name); if (entry.isDirectory()) await walk(child); else found.push(path.relative(root, child)); } }
    await walk(start); return found;
  }
}

function bucket(area: StorageArea) {
  const value = area === "public" ? process.env.S3_BUCKET_PUBLIC : area === "private" ? process.env.S3_BUCKET_PRIVATE : process.env.S3_BUCKET_QUARANTINE;
  if (!value) throw new Error(`Bucket ${area} belum dikonfigurasi.`);
  return value;
}

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("Kredensial object storage belum lengkap.");
  return new S3Client({ endpoint, region: process.env.S3_REGION || "us-east-1", forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId, secretAccessKey } });
}

class S3ObjectStore implements ObjectStore {
  private client = s3Client();
  async put(area: StorageArea, key: string, bytes: Uint8Array, contentType: string) { await this.client.send(new PutObjectCommand({ Bucket: bucket(area), Key: safeKey(key), Body: bytes, ContentType: contentType, ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined })); }
  async get(area: StorageArea, key: string) { try { const result = await this.client.send(new GetObjectCommand({ Bucket: bucket(area), Key: safeKey(key) })); return Buffer.from(await result.Body!.transformToByteArray()); } catch { throw new ApiError(404, "Objek tidak ditemukan."); } }
  async move(from: StorageArea, to: StorageArea, key: string, contentType: string) { await this.client.send(new CopyObjectCommand({ Bucket: bucket(to), Key: safeKey(key), CopySource: `${bucket(from)}/${encodeURIComponent(key).replace(/%2F/g, "/")}`, ContentType: contentType, MetadataDirective: "REPLACE", ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined })); await this.delete(from, key); }
  async delete(area: StorageArea, key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: bucket(area), Key: safeKey(key) })); }
  async list(area: StorageArea, prefix = "") { const result = await this.client.send(new ListObjectsV2Command({ Bucket: bucket(area), Prefix: prefix })); return (result.Contents || []).flatMap((item) => item.Key ? [item.Key] : []); }
}

export function objectStore(): ObjectStore { return process.env.STORAGE_DRIVER === "s3" ? new S3ObjectStore() : new LocalObjectStore(); }

export async function ensureS3Buckets() {
  const client = s3Client();
  for (const area of ["public", "private", "quarantine"] as const) {
    const name = bucket(area);
    try { await client.send(new HeadBucketCommand({ Bucket: name })); }
    catch { await client.send(new CreateBucketCommand({ Bucket: name })); }
  }
}
