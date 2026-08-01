import { minimumPitrRetentionDays } from "./hr-backup-policy.mjs";

const required = ["DATABASE_BACKUP_PROVIDER", "DATABASE_BACKUP_RETENTION_DAYS", "DATABASE_PITR_ENABLED", "BACKUP_LAST_RESTORE_TEST_AT"];
const issues = required.filter((key) => !process.env[key]).map((key) => `${key} is required.`);
const minimumRetentionDays = minimumPitrRetentionDays(process.env.APP_ENV);
if (Number(process.env.DATABASE_BACKUP_RETENTION_DAYS) < minimumRetentionDays) issues.push(`PITR retention must be at least ${minimumRetentionDays} days for ${process.env.APP_ENV || "this environment"}.`);
if (String(process.env.DATABASE_PITR_ENABLED).toLowerCase() !== "true") issues.push("Point-in-time recovery must be enabled.");
const lastRestore = Date.parse(String(process.env.BACKUP_LAST_RESTORE_TEST_AT ?? ""));
if (!Number.isFinite(lastRestore) || Date.now() - lastRestore > 90 * 24 * 60 * 60 * 1000) issues.push("The last successful restore drill must be within 90 days.");
if (issues.length) {
  for (const issue of issues) console.error(`BLOCKED ${issue}`);
  process.exitCode = 1;
} else {
  console.info("PASS backup policy evidence is current. Provider details and credentials are intentionally hidden.");
}
