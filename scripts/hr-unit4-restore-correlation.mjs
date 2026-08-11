import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

function blocked(message) {
  console.error(`BLOCKED ${message}`);
  process.exit(1);
}

if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore") {
  blocked("HRMS restore correlation requires an explicitly confirmed staging-only restore.");
}
const target = new URL(process.env.RESTORE_DATABASE_URL ?? "postgresql://missing/missing");
if (!/^unit6_restore$|^zentric_unit(?:4_restore_|5_restore(?:_|$)|6_restore(?:_|$))/.test(target.pathname.slice(1))) blocked("The target database must use an isolated Unit 4, Unit 5, or Unit 6 restore naming convention.");
const correlation = String(process.env.RESTORE_ARCHIVE_CORRELATION ?? "");
if (!/^[a-f0-9]{12}$/.test(correlation)) blocked("A valid archive correlation is required.");
const root = path.resolve(process.env.BACKUP_ARCHIVE_ROOT ?? "");
const encryptionKey = Buffer.from(String(process.env.BACKUP_ENCRYPTION_KEY_B64 ?? ""), "base64");
if (encryptionKey.length !== 32) blocked("The staging archive encryption key is unavailable or invalid.");

await fs.mkdir(root, { recursive: true, mode: 0o700 });
const entries = await fs.readdir(root);
const manifestName = entries.find((name) => name.endsWith(`-${correlation}.manifest.json`));
let manifest;
let encrypted;
if (manifestName) {
  manifest = JSON.parse(await fs.readFile(path.join(root, manifestName), "utf8"));
  encrypted = await fs.readFile(path.join(root, manifest.archiveFile));
} else {
  const bucket = String(process.env.BACKUP_OBJECT_STORAGE_BUCKET ?? "");
  const region = String(process.env.BACKUP_OBJECT_STORAGE_REGION ?? "");
  if (!bucket || !region) blocked("The requested archive is unavailable locally and remote archive configuration is incomplete.");
  const credentials = process.env.BACKUP_OBJECT_STORAGE_ACCESS_KEY_ID && process.env.BACKUP_OBJECT_STORAGE_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.BACKUP_OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.BACKUP_OBJECT_STORAGE_SECRET_ACCESS_KEY }
    : undefined;
  const client = new S3Client({ region, credentials });
  const prefix = `database-archives/daily/${new Date().getUTCFullYear()}/`;
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const manifestKey = listed.Contents?.find(({ Key }) => Key?.endsWith(`-${correlation}.manifest.json`))?.Key;
  if (!manifestKey) blocked("The requested archive manifest is unavailable in the configured staging archive store.");
  const manifestObject = await client.send(new GetObjectCommand({ Bucket: bucket, Key: manifestKey }));
  manifest = JSON.parse(await manifestObject.Body.transformToString());
  const archiveKey = `${prefix}${manifest.archiveFile}`;
  const archiveObject = await client.send(new GetObjectCommand({ Bucket: bucket, Key: archiveKey, VersionId: manifest.remote?.versionId }));
  encrypted = Buffer.from(await archiveObject.Body.transformToByteArray());
}
if (manifest.correlation !== correlation || manifest.encryption?.algorithm !== "aes-256-gcm") blocked("Archive manifest correlation or encryption metadata is invalid.");
if (crypto.createHash("sha256").update(encrypted).digest("hex") !== manifest.sha256) blocked("Encrypted archive checksum verification failed.");

const plaintextPath = path.join(root, `.restore-${correlation}.dump`);
const startedAt = new Date();
try {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(manifest.encryption.iv, "base64"));
  decipher.setAuthTag(Buffer.from(manifest.encryption.authTag, "base64"));
  await fs.writeFile(plaintextPath, Buffer.concat([decipher.update(encrypted), decipher.final()]), { mode: 0o600, flag: "wx" });
  const restore = spawn(process.env.PG_RESTORE_BIN || "pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", target.toString(), plaintextPath], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  restore.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const code = await new Promise((resolve, reject) => restore.once("error", reject).once("close", resolve));
  if (code !== 0) throw new Error(`pg_restore failed with exit code ${code}: ${stderr.slice(-500).replaceAll(target.toString(), "[target hidden]")}`);
  console.info(`PASS isolated archive restored. correlation=${correlation} archiveCreatedAt=${manifest.createdAt} restoreStartedAt=${startedAt.toISOString()} restoreCompletedAt=${new Date().toISOString()} encryptedBytes=${manifest.bytes}`);
} catch (error) {
  console.error(`BLOCKED Isolated archive restore failed. ${error instanceof Error ? error.message.replaceAll(target.toString(), "[target hidden]") : "Unknown error."}`);
  process.exitCode = 1;
} finally {
  await fs.rm(plaintextPath, { force: true });
  const plaintextRemoved = await fs.access(plaintextPath).then(() => false).catch(() => true);
  console.info(`PASS temporary plaintext cleanup=${plaintextRemoved ? "verified" : "failed"}.`);
}
