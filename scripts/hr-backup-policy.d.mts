export function minimumPitrRetentionDays(appEnv: unknown): number;
export const productionBackupPolicy: Readonly<{
  pitrDays: number;
  dailyDays: number;
  weeklyDays: number;
  monthlyYears: number;
  restoreDrillMaxAgeDays: number;
  disasterRecoveryExerciseMaxAgeDays: number;
}>;
export function acceptsArchivedRestoreForRelease(env: Record<string, unknown>, now?: number): boolean;
export function productionBackupPolicyIssues(
  env: Record<string, unknown>, now?: number, options?: { allowArchivedRestoreForRelease?: boolean },
): string[];
