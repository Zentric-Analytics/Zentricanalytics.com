import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { archiveExpiresAt, archiveTiersForDate, expiredManagedArchives, isManagedArchiveName, validateArchiveRoot } from "./hr-database-archive-lib.mjs";

function blocked(message) {
  console.error(`BLOCKED ${message}`);
  process.exit(1);
}

if (!['staging', 'production'].includes(String(process.env.APP_ENV).toLowerCase())) blocked("Database archives run only in staging or production.");
if (process.env.BACKUP_EXECUTION_CONFIRM !== "render-scheduled-backup") blocked("BACKUP_EXECUTION_CONFIRM=render-scheduled-backup is required.");
if (!process.env.DATABASE_URL) blocked("DATABASE_URL is required.");

let root;
try { root = validateArchiveRoot(process.env.BACKUP_ARCHIVE_ROOT); } catch (error) { blocked(error.message); }
const encryptionKey = Buffer.from(String(process.env.BACKUP_ENCRYPTION_KEY_B64 ?? ""), "base64");
if (encryptionKey.length !== 32) blocked("BACKUP_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes.");
const remoteKeys = ["BACKUP_OBJECT_STORAGE_ENDPOINT", "BACKUP_OBJECT_STORAGE_BUCKET", "BACKUP_OBJECT_STORAGE_REGION", "BACKUP_OBJECT_STORAGE_ACCESS_KEY_ID", "BACKUP_OBJECT_STORAGE_SECRET_ACCESS_KEY"];
if (process.env.APP_ENV === "production" && remoteKeys.some((key) => !String(process.env[key] ?? "").trim())) blocked("Production archives require dedicated S3-compatible object storage configuration.");

await fs.mkdir(root, { recursive: true, mode: 0o700 });
const lockPath = path.join(root, ".hrms-database-archive.lock");
let lock;
try { lock = await fs.open(lockPath, "wx", 0o600); } catch { blocked("Another database archive job is already running."); }

const createdAt = new Date();
const correlation = crypto.randomBytes(6).toString("hex");
const stamp = createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const baseName = `hrms-db-${stamp}-${correlation}`;
const partialPath = path.join(root, `${baseName}.partial`);
const archiveFile = `${baseName}.dump.enc`;
const archivePath = path.join(root, archiveFile);
const manifestFile = `${baseName}.manifest.json`;
const manifestPath = path.join(root, manifestFile);

try {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const digest = crypto.createHash("sha256");
  cipher.on("data", (chunk) => digest.update(chunk));
  const dump = spawn(process.env.PG_DUMP_BIN || "pg_dump", ["--format=custom", "--compress=9", "--no-owner", "--no-acl", process.env.DATABASE_URL], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  dump.stderr.on("data", () => undefined);
  const exited = new Promise((resolve, reject) => dump.once("error", reject).once("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump failed with exit code ${code}.`))));
  await Promise.all([pipeline(dump.stdout, cipher, createWriteStream(partialPath, { mode: 0o600 })), exited]);
  await fs.rename(partialPath, archivePath);
  const tiers = archiveTiersForDate(createdAt);
  const stat = await fs.stat(archivePath);
  const manifest = {
    schemaVersion: 1,
    correlation,
    createdAt: createdAt.toISOString(),
    archiveFile,
    encryption: { algorithm: "aes-256-gcm", iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") },
    sha256: digest.digest("hex"),
    bytes: stat.size,
    tiers,
    expiresAt: archiveExpiresAt(createdAt, tiers),
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });

  if (remoteKeys.every((key) => String(process.env[key] ?? "").trim())) {
    const endpoint = new URL(process.env.BACKUP_OBJECT_STORAGE_ENDPOINT);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Backup object-storage endpoint must be a credential-free HTTPS URL.");
    const client = new S3Client({
      endpoint: endpoint.toString(),
      region: process.env.BACKUP_OBJECT_STORAGE_REGION,
      forcePathStyle: String(process.env.BACKUP_OBJECT_STORAGE_FORCE_PATH_STYLE).toLowerCase() === "true",
      credentials: { accessKeyId: process.env.BACKUP_OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.BACKUP_OBJECT_STORAGE_SECRET_ACCESS_KEY },
    });
    const prefix = `database-archives/${tiers.join("-")}/${createdAt.getUTCFullYear()}`;
    await client.send(new PutObjectCommand({ Bucket: process.env.BACKUP_OBJECT_STORAGE_BUCKET, Key: `${prefix}/${archiveFile}`, Body: createReadStream(archivePath), ContentLength: stat.size, ContentType: "application/octet-stream", Metadata: { correlation, sha256: manifest.sha256, expiresat: manifest.expiresAt } }));
    await client.send(new PutObjectCommand({ Bucket: process.env.BACKUP_OBJECT_STORAGE_BUCKET, Key: `${prefix}/${manifestFile}`, Body: JSON.stringify(manifest), ContentType: "application/json", Metadata: { correlation } }));
  }

  const entries = await fs.readdir(root);
  const manifestNames = entries.filter((name) => isManagedArchiveName(name) && name.endsWith(".manifest.json"));
  const manifests = [];
  for (const name of manifestNames) {
    try { manifests.push(JSON.parse(await fs.readFile(path.join(root, name), "utf8"))); } catch { /* Invalid evidence is retained for investigation. */ }
  }
  for (const expired of expiredManagedArchives(manifests)) {
    const expiredManifest = expired.archiveFile.replace(/\.dump\.enc$/, ".manifest.json");
    if (isManagedArchiveName(expired.archiveFile) && isManagedArchiveName(expiredManifest)) {
      await fs.rm(path.join(root, expired.archiveFile), { force: true });
      await fs.rm(path.join(root, expiredManifest), { force: true });
    }
  }
  console.info(`PASS encrypted database archive created. correlation=${correlation} tiers=${tiers.join(",")} bytes=${stat.size}`);
} catch (error) {
  await fs.rm(partialPath, { force: true }).catch(() => undefined);
  console.error(`BLOCKED Database archive failed. ${error instanceof Error ? error.message.replace(String(process.env.DATABASE_URL), "[database hidden]") : "Unknown error."}`);
  process.exitCode = 1;
} finally {
  await lock.close().catch(() => undefined);
  await fs.rm(lockPath, { force: true }).catch(() => undefined);
}
