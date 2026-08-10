import { minimumPitrRetentionDays, productionBackupPolicyIssues } from "./hr-backup-policy.mjs";

const required = ["DATABASE_BACKUP_PROVIDER", "DATABASE_PITR_ENABLED", "BACKUP_LAST_RESTORE_TEST_AT"];
let issues = required.filter((key) => !process.env[key]).map((key) => `${key} is required.`);
const minimumRetentionDays = minimumPitrRetentionDays(process.env.APP_ENV);
if (String(process.env.APP_ENV).toLowerCase() === "production") issues = productionBackupPolicyIssues(process.env);
else {
  if (Number(process.env.DATABASE_PITR_RETENTION_DAYS ?? process.env.DATABASE_BACKUP_RETENTION_DAYS) < minimumRetentionDays) issues.push(`PITR retention must be at least ${minimumRetentionDays} days for ${process.env.APP_ENV || "this environment"}.`);
  if (String(process.env.DATABASE_PITR_ENABLED).toLowerCase() !== "true") issues.push("Point-in-time recovery must be enabled.");
  const lastRestore = Date.parse(String(process.env.BACKUP_LAST_RESTORE_TEST_AT ?? ""));
  if (!Number.isFinite(lastRestore) || Date.now() - lastRestore > 92 * 24 * 60 * 60 * 1000) issues.push("The last successful restore drill must be within one quarter.");
}
if (issues.length) {
  for (const issue of issues) console.error(`BLOCKED ${issue}`);
  process.exitCode = 1;
} else {
  console.info("PASS backup policy evidence is current. Provider details and credentials are intentionally hidden.");
}
