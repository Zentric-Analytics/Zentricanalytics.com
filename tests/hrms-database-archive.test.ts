import path from "node:path";
import { describe, expect, it } from "vitest";
import { archiveExpiresAt, archiveTiersForDate, expiredManagedArchives, isManagedArchiveName, optionalObjectVersion, s3CompatibleChecksumOptions, validateArchiveRoot } from "../scripts/hr-database-archive-lib.mjs";

describe("Render database archive policy", () => {
  it("promotes Sunday and first-of-month archives into longer tiers", () => {
    expect(archiveTiersForDate("2026-08-02T00:00:00Z")).toEqual(["daily", "weekly"]);
    expect(archiveTiersForDate("2026-02-01T00:00:00Z")).toEqual(["daily", "weekly", "monthly"]);
    expect(archiveTiersForDate("2026-08-03T00:00:00Z")).toEqual(["daily"]);
  });

  it("uses the longest applicable retention period", () => {
    expect(archiveExpiresAt("2026-08-03T00:00:00Z", ["daily"])).toBe("2026-11-01T00:00:00.000Z");
    expect(archiveExpiresAt("2026-08-02T00:00:00Z", ["daily", "weekly"])).toBe("2027-08-02T00:00:00.000Z");
    expect(archiveExpiresAt("2026-02-01T00:00:00Z", ["daily", "weekly", "monthly"])).toBe("2041-02-01T00:00:00.000Z");
  });

  it("rejects broad roots and recognizes only managed archive names", () => {
    expect(() => validateArchiveRoot(path.parse(process.cwd()).root)).toThrow("dedicated absolute directory");
    expect(isManagedArchiveName("hrms-db-20260801T120000Z-abcdef123456.dump.enc")).toBe(true);
    expect(isManagedArchiveName("../unrelated.dump.enc")).toBe(false);
    expect(isManagedArchiveName("customer-backup.dump.enc")).toBe(false);
  });

  it("prunes only expired, schema-valid managed evidence", () => {
    const valid = { schemaVersion: 1, archiveFile: "hrms-db-20260801T120000Z-abcdef123456.dump.enc", expiresAt: "2026-08-02T00:00:00Z" };
    const unrelated = { schemaVersion: 1, archiveFile: "unrelated.dump.enc", expiresAt: "2026-08-02T00:00:00Z" };
    expect(expiredManagedArchives([valid, unrelated], Date.parse("2026-08-03T00:00:00Z"))).toEqual([valid]);
  });

  it("uses R2-compatible checksum behavior only for S3-compatible providers", () => {
    expect(s3CompatibleChecksumOptions("s3-compatible")).toEqual({
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    expect(s3CompatibleChecksumOptions("aws-s3")).toEqual({});
  });

  it("omits unsupported version parameters when an S3-compatible provider returns none", () => {
    expect(optionalObjectVersion(undefined)).toEqual({});
    expect(optionalObjectVersion("")).toEqual({});
    expect(optionalObjectVersion("version-1")).toEqual({ VersionId: "version-1" });
  });
});
