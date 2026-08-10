export function minimumPitrRetentionDays(appEnv) {
  void appEnv;
  return 7;
}

export const productionBackupPolicy = Object.freeze({
  pitrDays: 7,
  dailyDays: 90,
  weeklyDays: 365,
  monthlyYears: 15,
  restoreDrillMaxAgeDays: 92,
  disasterRecoveryExerciseMaxAgeDays: 366,
});

function wholeNumber(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function evidenceAgeIsValid(value, maximumDays, now) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maximumDays * 24 * 60 * 60 * 1000;
}

export function productionBackupPolicyIssues(env, now = Date.now()) {
  const policy = productionBackupPolicy;
  const issues = [];
  if (!String(env.DATABASE_BACKUP_PROVIDER ?? "").trim()) issues.push("DATABASE_BACKUP_PROVIDER is not configured.");
  if (String(env.DATABASE_PITR_ENABLED).toLowerCase() !== "true") issues.push("Production point-in-time recovery must be enabled.");
  if (wholeNumber(env.DATABASE_PITR_RETENTION_DAYS ?? env.DATABASE_BACKUP_RETENTION_DAYS) < policy.pitrDays) issues.push(`Production PITR retention must be at least ${policy.pitrDays} days.`);
  if (wholeNumber(env.DATABASE_DAILY_BACKUP_RETENTION_DAYS) < policy.dailyDays) issues.push(`Daily backup retention must be at least ${policy.dailyDays} days.`);
  if (wholeNumber(env.DATABASE_WEEKLY_BACKUP_RETENTION_DAYS) < policy.weeklyDays) issues.push(`Weekly backup retention must be at least ${policy.weeklyDays} days.`);
  if (wholeNumber(env.DATABASE_MONTHLY_ARCHIVE_RETENTION_YEARS) < policy.monthlyYears) issues.push(`Monthly archive retention must be at least ${policy.monthlyYears} years.`);
  const archiveProvider = String(env.BACKUP_OBJECT_STORAGE_PROVIDER ?? "s3-compatible").toLowerCase();
  const archiveKeys = archiveProvider === "aws-s3" ? ["BACKUP_OBJECT_STORAGE_BUCKET", "BACKUP_OBJECT_STORAGE_REGION"] : ["BACKUP_OBJECT_STORAGE_ENDPOINT", "BACKUP_OBJECT_STORAGE_BUCKET", "BACKUP_OBJECT_STORAGE_REGION", "BACKUP_OBJECT_STORAGE_ACCESS_KEY_ID", "BACKUP_OBJECT_STORAGE_SECRET_ACCESS_KEY"];
  for (const key of archiveKeys) {
    if (!String(env[key] ?? "").trim()) issues.push(`${key} is required for protected logical archives.`);
  }
  if (String(env.BACKUP_OBJECT_STORAGE_BUCKET_LOCK_ENABLED).toLowerCase() !== "true") issues.push("Protected logical archive bucket locks must be enabled.");
  if (!evidenceAgeIsValid(env.BACKUP_LAST_RESTORE_TEST_AT, policy.restoreDrillMaxAgeDays, now)) issues.push("A successful isolated restore drill within the last quarter is required.");
  if (!evidenceAgeIsValid(env.BACKUP_LAST_DR_EXERCISE_AT, policy.disasterRecoveryExerciseMaxAgeDays, now)) issues.push("A successful disaster-recovery exercise within the last year is required.");
  return issues;
}
