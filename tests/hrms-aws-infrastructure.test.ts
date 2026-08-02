import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync("infrastructure/aws/hrms-production-storage.yaml", "utf8");
const eventSetup = readFileSync("infrastructure/aws/configure-document-scan-events.sh", "utf8");

describe("production AWS HRMS infrastructure", () => {
  it("keeps document and archive storage private, encrypted, versioned, and retained", () => {
    expect(template.match(/BlockPublicAcls: true/g)).toHaveLength(2);
    expect(template.match(/IgnorePublicAcls: true/g)).toHaveLength(2);
    expect(template.match(/BlockPublicPolicy: true/g)).toHaveLength(2);
    expect(template.match(/RestrictPublicBuckets: true/g)).toHaveLength(2);
    expect(template.match(/SSEAlgorithm: AES256/g)).toHaveLength(2);
    expect(template.match(/VersioningConfiguration: \{ Status: Enabled \}/g)).toHaveLength(2);
    expect(template).toContain("ObjectLockEnabled: true");
    expect(template.match(/DenyInsecureTransport/g)).toHaveLength(2);
    expect(template.match(/"aws:SecureTransport": "false"/g)).toHaveLength(2);
  });

  it("implements the approved archive retention tiers and immutable writer boundary", () => {
    expect(template).toContain("Prefix: database-archives/daily/");
    expect(template).toContain("ExpirationInDays: 91");
    expect(template).toContain("Prefix: database-archives/daily-weekly/");
    expect(template).toContain("ExpirationInDays: 366");
    expect(template).toContain("Prefix: database-archives/daily-weekly-monthly/");
    expect(template).toContain("ExpirationInDays: 5479");
    expect(template).toContain("s3:PutObjectRetention");
    expect(template).not.toContain("s3:DeleteBucket");
  });

  it("limits auditing and malware-result delivery to the intended object prefixes", () => {
    expect(template).toContain('${DocumentBucket.Arn}/quarantine/');
    expect(template).toContain('${ArchiveBucket.Arn}/database-archives/');
    expect(template).toContain("EnableLogFileValidation: true");
    expect(template).toContain("MessageRetentionPeriod: 1209600");
    expect(template).toContain("SqsManagedSseEnabled: true");
    expect(eventSetup).toContain('"bucketName":["${BUCKET}"]');
    expect(eventSetup).toContain('{"prefix":"quarantine/"}');
    expect(eventSetup).toContain('"MaximumEventAgeInSeconds":3600');
    expect(eventSetup).toContain('"MaximumRetryAttempts":10');
    expect(eventSetup).toContain('"DeadLetterConfig":{"Arn":"${DLQ_ARN}"}');
  });
});
