import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ensureS3Buckets, objectStore } from "../src/lib/storage/object-store";

async function files(root: string) { const found: string[] = []; async function walk(dir: string) { for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) { const child = path.join(dir, entry.name); if (entry.isDirectory()) await walk(child); else found.push(child); } } await walk(root); return found; }
function mime(name: string) { return name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg"; }

async function main() {
  if (process.env.STORAGE_DRIVER !== "s3") throw new Error("STORAGE_DRIVER=s3 wajib untuk migrasi.");
  const publicRoot = path.resolve(process.env.LEGACY_PUBLIC_UPLOAD_DIR || ".uploads");
  const privateRoot = path.resolve(process.env.LEGACY_PRIVATE_UPLOAD_DIR || ".private-uploads");
  const store = objectStore();
  await ensureS3Buckets();
  let migrated = 0;
  for (const file of await files(publicRoot)) { const relative = path.relative(publicRoot, file); await store.put("public", relative.includes("/") ? relative : `public/${relative}`, await readFile(file), mime(file)); migrated += 1; }
  for (const file of await files(privateRoot)) { const relative = path.relative(privateRoot, file); await store.put("private", relative, await readFile(file), mime(file)); migrated += 1; }
  console.log(JSON.stringify({ migrated, sourceDeleted: false }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Migrasi storage gagal."); process.exitCode = 1; });
