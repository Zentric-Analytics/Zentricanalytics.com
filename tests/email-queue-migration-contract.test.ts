import assert from "node:assert/strict";
import fs from "node:fs";
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");
// Static inspection only: no Prisma, SQL execution, subprocess or database client.
const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const firstPath = "prisma/migrations/20261029000100_email_queue_held_enum/migration.sql";
const secondPath = "prisma/migrations/20261029000200_email_queue_safety_contract/migration.sql";
const first = read(firstPath), second = read(secondPath);
const hardening = read("prisma/migrations/20260730070000_hrms_production_hardening/migration.sql");
const foundation = read("prisma/migrations/20260729000000_hrms_secure_foundation/migration.sql");
const rules = read("src/lib/hr/notifications/queue-transition-rules.mjs");
const declaration = read("src/lib/hr/notifications/queue-transition-rules.d.mts");
const block = (kind: string, name: string) => {
  const match = schema.match(new RegExp(`^${kind} ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  assert.ok(match, `${kind} ${name} missing`);
  return match[1];
};
const withoutComments = (sql: string) => sql.replace(/--[^\n]*/g, "").trim();
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

describe("queue migration static contract: preserved baseline", () => {
  it("preserves all prior statuses and appends only HELD", () => assert.deepEqual(block("enum", "HrOutboxStatus").trim().split(/\s+/), ["PENDING", "PROCESSING", "DELIVERED", "FAILED", "ABANDONED", "HELD"]));
  const originalFields = ["id String @id @default(cuid())", "organizationId String", "recipient String", "template String", "subject String", "payload Json", "status HrOutboxStatus @default(PENDING)", "attemptCount Int @default(0)", "nextAttemptAt DateTime @default(now())", "lastAttemptedAt DateTime?", "lastError String?", "provider String?", "providerMessageId String?", "idempotencyKey String @unique", "createdAt DateTime @default(now())", "deliveredAt DateTime?", "organization HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Restrict)", "attempts HrEmailDeliveryAttempt[]", "@@index([status, nextAttemptAt])", "@@index([status, createdAt])", "@@index([organizationId, createdAt])"];
  for (const field of originalFields) it(`preserves outbox ${field.split(" ")[0]}`, () => assert.ok(normalize(block("model", "HrEmailOutbox")).includes(field)));
  it("preserves the entire delivery-attempt model", () => {
    assert.equal(normalize(block("model", "HrEmailDeliveryAttempt")), normalize(`
      id String @id @default(cuid()) outboxId String attemptNumber Int status HrOutboxStatus
      provider String? providerMessageId String? safeError String? attemptedAt DateTime @default(now())
      outbox HrEmailOutbox @relation(fields: [outboxId], references: [id], onDelete: Cascade)
      @@unique([outboxId, attemptNumber])`));
  });
  it("retains historical attempt immutability and bounds", () => {
    assert.match(hardening, /BEFORE UPDATE OR DELETE ON "HrEmailDeliveryAttempt"/);
    assert.match(hardening, /"attemptCount" >= 0 AND "attemptCount" <= 100/);
    assert.match(foundation, /CREATE UNIQUE INDEX "HrEmailOutbox_idempotencyKey_key"/);
    assert.doesNotMatch(withoutComments(second), /ALTER TABLE "HrEmailDeliveryAttempt"|DROP TRIGGER/);
  });
});

describe("new schema and Q01 agreement", () => {
  it("phase enum agrees with Q01 and declaration", () => {
    const phases = block("enum", "HrEmailDispatchPhase").trim().split(/\s+/);
    assert.deepEqual(phases, ["NONE", "INTENT", "RESERVED", "ATTEMPTED"]);
    for (const phase of phases) { assert.ok(rules.includes(`"${phase}"`)); assert.ok(declaration.includes(`"${phase}"`)); }
    assert.ok(second.includes("AS ENUM ('NONE', 'INTENT', 'RESERVED', 'ATTEMPTED')"));
  });
  it("hold reasons exactly match Q01", () => {
    const match = rules.match(/const holds = new Set\(\[([^\]]+)\]\)/);
    assert.ok(match);
    const reasons = [...match[1].matchAll(/"([A-Z_]+)"/g)].map(value => value[1]);
    assert.deepEqual(block("enum", "HrEmailHoldReason").trim().split(/\s+/), reasons);
    for (const reason of reasons) assert.ok(second.includes(`'${reason}'`));
  });
  const fields = ["safetyContractVersion", "version", "dispatchPhase", "claimId", "claimedAt", "claimExpiresAt", "dispatchId", "holdReason", "heldAt", "holdPolicyRevision", "reviewDueAt", "retentionReviewAt", "messageExpiresAt", "providerAcceptedAt", "invitationId", "resetChallengeId"];
  for (const field of fields) it(`maps new outbox field ${field} in schema and SQL`, () => {
    assert.match(block("model", "HrEmailOutbox"), new RegExp(`^  ${field}\\s+`, "m"));
    assert.ok(second.includes(`ADD COLUMN "${field}"`));
  });
  it("legacy evidence fields remain nullable and have no fabricated defaults", () => {
    assert.match(block("model", "HrEmailOutbox"), /safetyContractVersion Int\?\s*\n/);
    assert.match(block("model", "HrEmailOutbox"), /dispatchPhase\s+HrEmailDispatchPhase\?\s*\n/);
    assert.match(second, /ADD COLUMN "safetyContractVersion" INTEGER,/);
    assert.match(second, /ADD COLUMN "dispatchPhase" "HrEmailDispatchPhase",/);
    assert.doesNotMatch(second, /DEFAULT\s+(?:1|'NONE'|'ATTEMPTED')/i);
  });
  it("does not store proof booleans or redundant authoritative credential state", () => {
    for (const name of ["nonInvocationEstablished", "invocationFenced", "credentialState"]) {
      assert.doesNotMatch(block("model", "HrEmailOutbox"), new RegExp(`^\\s*${name}\\s`, "m"));
      assert.doesNotMatch(block("model", "HrEmailDispatchEvent"), new RegExp(`^\\s*${name}\\s`, "m"));
    }
  });
});

describe("SQL-only safeguards: presence, not execution certification", () => {
  it("enum migration is one isolated statement and precedes dependent migration", () => {
    assert.ok(firstPath < secondPath);
    assert.equal(withoutComments(first), 'ALTER TYPE "HrOutboxStatus" ADD VALUE \'HELD\';');
    assert.match(first, /COMMITs before/);
    assert.match(withoutComments(second), /^BEGIN;/);
    assert.match(withoutComments(second), /COMMIT;$/);
    assert.doesNotMatch(withoutComments(second), /CONCURRENTLY/);
  });
  const checks = ["safety_version", "version_bounds", "held_contract", "v1_shape"];
  for (const check of checks) it(`defines ${check} check`, () => assert.ok(second.includes(`"HrEmailOutbox_${check}_check" CHECK`)));
  it("guards NULL semantics for new-contract metadata", () => {
    assert.match(second, /"safetyContractVersion" IS NULL OR \(\(/);
    assert.match(second, /\) IS TRUE\)/);
    for (const field of ["dispatchPhase", "claimId", "claimedAt", "claimExpiresAt", "dispatchId", "holdReason", "heldAt", "holdPolicyRevision", "providerAcceptedAt"]) assert.ok(second.includes(`"${field}" IS NOT NULL`));
  });
  it("contains ownership, phase, cancellation and acceptance safeguards", () => {
    assert.match(second, /"claimExpiresAt" > "claimedAt"/);
    assert.match(second, /"status" NOT IN \('PENDING', 'FAILED'\) OR "dispatchPhase" = 'NONE'/);
    assert.match(second, /"dispatchPhase" <> 'ATTEMPTED' OR "attemptCount" > 0/);
    assert.match(second, /"holdReason" IS DISTINCT FROM 'PRE_INVOCATION_CANCELLED' OR "dispatchPhase" = 'RESERVED'/);
    assert.match(second, /"providerAcceptedAt" IS NOT NULL AND "provider" = 'resend'/);
  });
  it("typed credential links restrict deletion and require template-consistent linkage", () => {
    assert.match(second, /REFERENCES "HrAccountInvitation"\("id"\) ON DELETE RESTRICT ON UPDATE RESTRICT/);
    assert.match(second, /REFERENCES "HrPasswordResetChallenge"\("id"\) ON DELETE RESTRICT ON UPDATE RESTRICT/);
    assert.match(second, /"template" = 'hr-password-reset' AND "resetChallengeId" IS NOT NULL/);
    assert.match(second, /"template" = 'hr-account-invitation' AND "invitationId" IS NOT NULL/);
  });
  it("organization-matched journal FK agrees with Prisma", () => {
    assert.match(block("model", "HrEmailOutbox"), /@@unique\(\[id, organizationId\]\)/);
    assert.match(block("model", "HrEmailDispatchEvent"), /fields: \[outboxId, organizationId\], references: \[id, organizationId\], onDelete: Restrict, onUpdate: Restrict/);
    assert.match(second, /FOREIGN KEY \("outboxId", "organizationId"\)\s+REFERENCES "HrEmailOutbox"\("id", "organizationId"\) ON DELETE RESTRICT ON UPDATE RESTRICT/);
  });
  it("guards credential, actor and audit organization references", () => {
    assert.match(second, /i\."organizationId" = NEW\."organizationId"/);
    assert.match(second, /c\."id" = NEW\."resetChallengeId" AND u\."organizationId" = NEW\."organizationId"/);
    assert.match(second, /u\."id" = NEW\."actorUserId" AND u\."organizationId" = NEW\."organizationId"/);
    assert.match(second, /a\."id" = NEW\."auditEventId" AND a\."organizationId" = NEW\."organizationId"/);
  });
  it("keeps journal references RESTRICT rather than mutation-inducing SET NULL", () => {
    assert.doesNotMatch(block("model", "HrEmailDispatchEvent"), /onDelete: (SetNull|Cascade)/);
    assert.doesNotMatch(second, /ON DELETE (CASCADE|SET NULL)/);
  });
  it("preserves counters and versions once a row is classified", () => {
    assert.match(second, /NEW\."safetyContractVersion" IS DISTINCT FROM 1/);
    assert.match(second, /NEW\."version" <> OLD\."version" \+ 1/);
    assert.match(second, /NEW\."attemptCount" <> OLD\."attemptCount" \+ 1/);
    assert.match(second, /ELSIF NEW\."attemptCount" <> OLD\."attemptCount"/);
    assert.match(second, /OLD\."dispatchPhase" = 'RESERVED'/);
    assert.match(second, /NEW\."dispatchPhase" = 'ATTEMPTED'/);
    assert.match(second, /OLD\."safetyContractVersion" IS NULL AND NEW\."safetyContractVersion" = 1/);
    assert.match(second, /Legacy email classification must preserve message and counters/);
    assert.match(second, /Held email requires a separate release before processing/);
  });
  it("journal kinds distinguish reservation, cancellation and invocation", () => {
    const expected = ["CLAIMED", "INTENT_RECORDED", "RESERVED", "RESERVATION_CANCELLED", "INVOCATION_BOUNDARY", "PROVIDER_ACCEPTED", "PROVIDER_FAILED", "OUTCOME_UNCERTAIN", "HELD", "RELEASED"];
    assert.deepEqual(block("enum", "HrEmailDispatchEventKind").trim().split(/\s+/), expected);
    for (const kind of expected) assert.ok(second.includes(`'${kind}'`));
  });
  it("journal has no content/secret/freeform error fields", () => {
    const journal = block("model", "HrEmailDispatchEvent");
    assert.doesNotMatch(journal, /^\s*(password|code|token|body|payload|error|credentialEnvelope|recipient)\s/m);
    for (const field of ["id", "outboxId", "organizationId", "dispatchId", "kind", "transitionVersion", "claimId", "recordedAt", "reason", "policyRevision", "actorUserId", "providerMessageId", "auditEventId"]) assert.match(journal, new RegExp(`^  ${field}\\s+`, "m"));
  });
  for (const index of ["HrEmailOutbox_dispatchId_key", "HrEmailOutbox_id_organizationId_key", "HrEmailOutbox_status_reviewDueAt_idx", "HrEmailOutbox_organizationId_status_reviewDueAt_idx", "HrEmailOutbox_status_claimExpiresAt_idx", "HrEmailDispatchEvent_outboxId_transitionVersion_key", "HrEmailDispatchEvent_boundary_once_idx", "HrEmailDispatchEvent_confirmed_outcome_once_idx", "HrEmailDispatchEvent_dispatch_origin_once_idx"]) it(`defines index ${index}`, () => assert.ok(second.includes(`INDEX "${index}"`)));
  it("journal rejects update, delete and truncate", () => {
    assert.match(second, /BEFORE UPDATE OR DELETE ON "HrEmailDispatchEvent"/);
    assert.match(second, /BEFORE TRUNCATE ON "HrEmailDispatchEvent"/);
    assert.match(second, /RAISE EXCEPTION 'Email dispatch events are immutable'/);
  });
  it("contains no destructive data backfill or operational command", () => {
    const sql = withoutComments(`${first}\n${second}`);
    assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE)\s+(?:TABLE|TYPE|COLUMN|INDEX)|\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+"HrEmail(?:Outbox|DeliveryAttempt)"|\bALTER\s+COLUMN|\bRENAME\b/i);
    assert.doesNotMatch(sql, /\b(?:COPY|pg_notify|dblink|http_post|pg_read_file|pg_read_binary_file)\b|\b(?:prisma|yarn|npm|curl)\s/i);
    assert.equal(second.charCodeAt(0) === 0xfeff, false);
  });
});
