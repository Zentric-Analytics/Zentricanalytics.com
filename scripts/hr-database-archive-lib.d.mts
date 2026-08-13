export const archiveRetention: Readonly<{ dailyDays: number; weeklyDays: number; monthlyYears: number }>;
export function s3CompatibleChecksumOptions(provider: string): { requestChecksumCalculation: "WHEN_REQUIRED"; responseChecksumValidation: "WHEN_REQUIRED" } | Record<string, never>;
export function optionalObjectVersion(provider: string, versionId: unknown): { VersionId: string } | Record<string, never>;
export function archiveTiersForDate(value: string | number | Date): string[];
export function archiveExpiresAt(createdAt: string | number | Date, tiers: string[], policy?: typeof archiveRetention): string;
export function validateArchiveRoot(root: unknown): string;
export function isManagedArchiveName(name: unknown): boolean;
export function expiredManagedArchives<T extends { schemaVersion?: number; archiveFile?: string; expiresAt?: string }>(manifests: T[], now?: number): T[];
