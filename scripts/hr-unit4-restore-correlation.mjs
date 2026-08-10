import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function blocked(message) {
  console.error(`BLOCKED ${message}`);
  process.exit(1);
}

if (process.env.APP_ENV !== "staging" || process.env.DR_RESTORE_CONFIRM !== "isolated-restore") {
  blocked("Unit 4 restore correlation requires an explicitly confirmed staging-only restore.");
}
const target = new URL(process.env.RESTORE_DATABASE_URL ?? "postgresql://missing/missing");
if (!/^zentric_unit4_restore_/.test(target.pathname.slice(1))) blocked("The target database must use the isolated Unit 4 restore naming convention.");
const correlation = String(process.env.RESTORE_ARCHIVE_CORRELATION ?? "");
if (!/^[a-f0-9]{12}$/.test(correlation)) blocked("A valid archive correlation is required.");
const root = path.resolve(process.env.BACKUP_ARCHIVE_ROOT ?? "");
const encryptionKey = Buffer.from(String(process.env.BACKUP_ENCRYPTION_KEY_B64 ?? ""), "base64");
if (encryptionKey.length !== 32) blocked("The staging archive encryption key is unavailable or invalid.");

const entries = await fs.readdir(root);
const manifestName = entries.find((name) => name.endsWith(`-${correlation}.manifest.json`));
if (!manifestName) blocked("The requested archive manifest is unavailable on the staging archive volume.");
const manifest = JSON.parse(await fs.readFile(path.join(root, manifestName), "utf8"));
if (manifest.correlation !== correlation || manifest.encryption?.algorithm !== "aes-256-gcm") blocked("Archive manifest correlation or encryption metadata is invalid.");
const encryptedPath = path.join(root, manifest.archiveFile);
const encrypted = await fs.readFile(encryptedPath);
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
