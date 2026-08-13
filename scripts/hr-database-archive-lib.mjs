import path from "node:path";

export const archiveRetention = Object.freeze({ dailyDays: 90, weeklyDays: 365, monthlyYears: 15 });

export function s3CompatibleChecksumOptions(provider) {
  return String(provider).toLowerCase() === "s3-compatible"
    ? { requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }
    : {};
}

export function optionalObjectVersion(versionId) {
  return typeof versionId === "string" && versionId.length > 0 ? { VersionId: versionId } : {};
}

export function archiveTiersForDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid archive timestamp.");
  const tiers = ["daily"];
  if (date.getUTCDay() === 0) tiers.push("weekly");
  if (date.getUTCDate() === 1) tiers.push("monthly");
  return tiers;
}

export function archiveExpiresAt(createdAt, tiers, policy = archiveRetention) {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) throw new Error("Invalid archive timestamp.");
  const expiries = tiers.map((tier) => {
    const expiry = new Date(created);
    if (tier === "daily") expiry.setUTCDate(expiry.getUTCDate() + policy.dailyDays);
    else if (tier === "weekly") expiry.setUTCDate(expiry.getUTCDate() + policy.weeklyDays);
    else if (tier === "monthly") expiry.setUTCFullYear(expiry.getUTCFullYear() + policy.monthlyYears);
    else throw new Error("Invalid archive tier.");
    return expiry.getTime();
  });
  return new Date(Math.max(...expiries)).toISOString();
}

export function validateArchiveRoot(root) {
  const resolved = path.resolve(String(root ?? ""));
  const parsed = path.parse(resolved);
  if (!path.isAbsolute(resolved) || resolved === parsed.root || resolved.length < parsed.root.length + 8) throw new Error("BACKUP_ARCHIVE_ROOT must be a dedicated absolute directory.");
  return resolved;
}

export function isManagedArchiveName(name) {
  return /^hrms-db-\d{8}T\d{6}Z-[a-f0-9]{12}\.(dump\.enc|manifest\.json)$/.test(String(name));
}

export function expiredManagedArchives(manifests, now = Date.now()) {
  return manifests.filter((manifest) =>
    manifest?.schemaVersion === 1 &&
    isManagedArchiveName(manifest.archiveFile) &&
    Number.isFinite(Date.parse(String(manifest.expiresAt))) &&
    Date.parse(manifest.expiresAt) < now,
  );
}
