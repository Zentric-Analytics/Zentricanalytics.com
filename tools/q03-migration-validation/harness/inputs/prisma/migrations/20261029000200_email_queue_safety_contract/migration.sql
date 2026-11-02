-- OFFLINE ARTIFACT ONLY: not executed or validated with PostgreSQL/Prisma 6.10.1.
-- Requires the preceding HELD enum addition to have committed. Q03 must verify
-- runner transaction boundaries, schema drift, locks and failure recovery.
-- PostgreSQL 16-18 common syntax. Ordinary indexes can block writes: schedule
-- a reviewed quiescent window; no zero-downtime claim. No CONCURRENTLY in this transaction.
-- Preserve custom CHECKs, partial indexes and triggers in future Prisma migrations.
BEGIN;

CREATE TYPE "HrEmailDispatchPhase" AS ENUM ('NONE', 'INTENT', 'RESERVED', 'ATTEMPTED');
CREATE TYPE "HrEmailHoldReason" AS ENUM (
  'STAGING_RECIPIENT_NOT_ALLOWLISTED', 'INVALID_RECIPIENT', 'UNSUPPORTED_TEMPLATE',
  'CREDENTIAL_EXPIRED_OR_UNUSABLE', 'PROVIDER_OUTCOME_UNCERTAIN',
  'LEGACY_PROCESSING_REVIEW_REQUIRED', 'PRE_INVOCATION_CANCELLED'
);
CREATE TYPE "HrEmailDispatchEventKind" AS ENUM (
  'CLAIMED', 'INTENT_RECORDED', 'RESERVED', 'RESERVATION_CANCELLED',
  'INVOCATION_BOUNDARY', 'PROVIDER_ACCEPTED', 'PROVIDER_FAILED',
  'OUTCOME_UNCERTAIN', 'HELD', 'RELEASED'
);

ALTER TABLE "HrEmailOutbox"
  ADD COLUMN "safetyContractVersion" INTEGER,
  ADD COLUMN "version" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "dispatchPhase" "HrEmailDispatchPhase",
  ADD COLUMN "claimId" VARCHAR(128),
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimExpiresAt" TIMESTAMP(3),
  ADD COLUMN "dispatchId" VARCHAR(128),
  ADD COLUMN "holdReason" "HrEmailHoldReason",
  ADD COLUMN "heldAt" TIMESTAMP(3),
  ADD COLUMN "holdPolicyRevision" VARCHAR(128),
  ADD COLUMN "reviewDueAt" TIMESTAMP(3),
  ADD COLUMN "retentionReviewAt" TIMESTAMP(3),
  ADD COLUMN "messageExpiresAt" TIMESTAMP(3),
  ADD COLUMN "providerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "invitationId" TEXT,
  ADD COLUMN "resetChallengeId" TEXT;

ALTER TABLE "HrEmailOutbox"
  ADD CONSTRAINT "HrEmailOutbox_safety_version_check" CHECK (
    "safetyContractVersion" IS NULL OR "safetyContractVersion" = 1
  ),
  ADD CONSTRAINT "HrEmailOutbox_version_bounds_check" CHECK (
    "version" >= 0 AND "version" <= 9007199254740991
  ),
  ADD CONSTRAINT "HrEmailOutbox_held_contract_check" CHECK (
    ("status" <> 'HELD' OR "safetyContractVersion" = 1) IS TRUE
  ),
  -- The IS TRUE boundary prevents NULL/UNKNOWN from admitting malformed v1 rows.
  ADD CONSTRAINT "HrEmailOutbox_v1_shape_check" CHECK (
    "safetyContractVersion" IS NULL OR ((
      "dispatchPhase" IS NOT NULL
      AND "attemptCount" BETWEEN 0 AND 100
      AND (
        ("status" = 'PROCESSING' AND "claimId" IS NOT NULL
          AND "claimId" ~ '^[A-Za-z0-9_-]{1,128}$'
          AND "claimedAt" IS NOT NULL AND "claimExpiresAt" IS NOT NULL
          AND "claimExpiresAt" > "claimedAt")
        OR ("status" <> 'PROCESSING' AND "claimId" IS NULL
          AND "claimedAt" IS NULL AND "claimExpiresAt" IS NULL)
      )
      AND ("status" NOT IN ('PENDING', 'FAILED') OR "dispatchPhase" = 'NONE')
      AND (
        ("dispatchPhase" = 'NONE' AND "dispatchId" IS NULL)
        OR ("dispatchPhase" <> 'NONE' AND "dispatchId" IS NOT NULL
          AND "dispatchId" ~ '^[A-Za-z0-9_-]{1,128}$')
      )
      AND ("dispatchPhase" <> 'ATTEMPTED' OR "attemptCount" > 0)
      AND (
        ("status" = 'HELD' AND "holdReason" IS NOT NULL AND "heldAt" IS NOT NULL
          AND "holdPolicyRevision" IS NOT NULL AND length(btrim("holdPolicyRevision")) > 0)
        OR ("status" <> 'HELD' AND "holdReason" IS NULL AND "heldAt" IS NULL
          AND "holdPolicyRevision" IS NULL AND "reviewDueAt" IS NULL)
      )
      AND ("reviewDueAt" IS NULL OR "reviewDueAt" >= "heldAt")
      AND ("status" <> 'HELD' OR "dispatchPhase" <> 'ATTEMPTED'
        OR "holdReason" IN ('PROVIDER_OUTCOME_UNCERTAIN', 'LEGACY_PROCESSING_REVIEW_REQUIRED'))
      AND ("holdReason" IS DISTINCT FROM 'PRE_INVOCATION_CANCELLED' OR "dispatchPhase" = 'RESERVED')
      AND ("status" <> 'DELIVERED' OR ("dispatchPhase" = 'ATTEMPTED'
        AND "providerAcceptedAt" IS NOT NULL AND "provider" = 'resend'))
      AND ("providerAcceptedAt" IS NULL OR "status" = 'DELIVERED')
      AND (
        ("template" = 'hr-account-invitation' AND "invitationId" IS NOT NULL
          AND "resetChallengeId" IS NULL AND "messageExpiresAt" IS NOT NULL)
        OR ("template" = 'hr-password-reset' AND "resetChallengeId" IS NOT NULL
          AND "invitationId" IS NULL AND "messageExpiresAt" IS NOT NULL)
        OR ("template" NOT IN ('hr-account-invitation', 'hr-password-reset')
          AND "invitationId" IS NULL AND "resetChallengeId" IS NULL)
      )
    ) IS TRUE)
  ),
  ADD CONSTRAINT "HrEmailOutbox_invitationId_fkey" FOREIGN KEY ("invitationId")
    REFERENCES "HrAccountInvitation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "HrEmailOutbox_resetChallengeId_fkey" FOREIGN KEY ("resetChallengeId")
    REFERENCES "HrPasswordResetChallenge"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "HrEmailOutbox_dispatchId_key" ON "HrEmailOutbox"("dispatchId");
CREATE UNIQUE INDEX "HrEmailOutbox_id_organizationId_key" ON "HrEmailOutbox"("id", "organizationId");
CREATE INDEX "HrEmailOutbox_status_reviewDueAt_idx" ON "HrEmailOutbox"("status", "reviewDueAt");
CREATE INDEX "HrEmailOutbox_organizationId_status_reviewDueAt_idx" ON "HrEmailOutbox"("organizationId", "status", "reviewDueAt");
CREATE INDEX "HrEmailOutbox_status_claimExpiresAt_idx" ON "HrEmailOutbox"("status", "claimExpiresAt");

CREATE TABLE "HrEmailDispatchEvent" (
  "id" TEXT NOT NULL,
  "outboxId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dispatchId" VARCHAR(128),
  "kind" "HrEmailDispatchEventKind" NOT NULL,
  "transitionVersion" BIGINT,
  "claimId" VARCHAR(128),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" "HrEmailHoldReason",
  "policyRevision" VARCHAR(128),
  "actorUserId" TEXT,
  "providerMessageId" VARCHAR(256),
  "auditEventId" TEXT,
  CONSTRAINT "HrEmailDispatchEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HrEmailDispatchEvent_outboxId_organizationId_fkey" FOREIGN KEY ("outboxId", "organizationId")
    REFERENCES "HrEmailOutbox"("id", "organizationId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "HrEmailDispatchEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId")
    REFERENCES "HrUser"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "HrEmailDispatchEvent_auditEventId_fkey" FOREIGN KEY ("auditEventId")
    REFERENCES "HrAuditEvent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "HrEmailDispatchEvent_shape_check" CHECK ((
    ("transitionVersion" IS NULL OR "transitionVersion" BETWEEN 1 AND 9007199254740991)
    AND ("dispatchId" IS NULL OR "dispatchId" ~ '^[A-Za-z0-9_-]{1,128}$')
    AND ("claimId" IS NULL OR "claimId" ~ '^[A-Za-z0-9_-]{1,128}$')
    AND ("kind" NOT IN ('INTENT_RECORDED', 'RESERVED', 'RESERVATION_CANCELLED',
      'INVOCATION_BOUNDARY', 'PROVIDER_ACCEPTED', 'PROVIDER_FAILED', 'OUTCOME_UNCERTAIN')
      OR "dispatchId" IS NOT NULL)
    AND ("kind" NOT IN ('CLAIMED', 'INTENT_RECORDED', 'RESERVED', 'RESERVATION_CANCELLED',
      'INVOCATION_BOUNDARY') OR ("claimId" IS NOT NULL AND "transitionVersion" IS NOT NULL))
    AND ("kind" NOT IN ('HELD', 'RESERVATION_CANCELLED') OR "reason" IS NOT NULL)
    AND ("kind" <> 'RESERVATION_CANCELLED' OR "reason" = 'PRE_INVOCATION_CANCELLED')
    AND ("kind" NOT IN ('HELD', 'RELEASED', 'RESERVATION_CANCELLED', 'INVOCATION_BOUNDARY')
      OR ("policyRevision" IS NOT NULL AND length(btrim("policyRevision")) > 0))
    AND ("kind" <> 'RELEASED' OR ("actorUserId" IS NOT NULL AND "auditEventId" IS NOT NULL
      AND "transitionVersion" IS NOT NULL))
  ) IS TRUE)
);

CREATE UNIQUE INDEX "HrEmailDispatchEvent_outboxId_transitionVersion_key"
  ON "HrEmailDispatchEvent"("outboxId", "transitionVersion");
CREATE INDEX "HrEmailDispatchEvent_outboxId_recordedAt_idx" ON "HrEmailDispatchEvent"("outboxId", "recordedAt");
CREATE INDEX "HrEmailDispatchEvent_organizationId_recordedAt_idx" ON "HrEmailDispatchEvent"("organizationId", "recordedAt");
CREATE INDEX "HrEmailDispatchEvent_outboxId_dispatchId_recordedAt_idx" ON "HrEmailDispatchEvent"("outboxId", "dispatchId", "recordedAt");
-- Partial uniqueness is SQL-only in Prisma 6.10.1. Preserve it in future diffs.
CREATE UNIQUE INDEX "HrEmailDispatchEvent_boundary_once_idx"
  ON "HrEmailDispatchEvent"("outboxId", "dispatchId", "kind")
  WHERE "kind" IN ('INTENT_RECORDED', 'RESERVED', 'RESERVATION_CANCELLED', 'INVOCATION_BOUNDARY');
CREATE UNIQUE INDEX "HrEmailDispatchEvent_confirmed_outcome_once_idx"
  ON "HrEmailDispatchEvent"("outboxId", "dispatchId")
  WHERE "kind" IN ('PROVIDER_ACCEPTED', 'PROVIDER_FAILED');
CREATE UNIQUE INDEX "HrEmailDispatchEvent_dispatch_origin_once_idx"
  ON "HrEmailDispatchEvent"("dispatchId") WHERE "kind" = 'INTENT_RECORDED';

-- No caller booleans are evidence. This guards references, NOT current RBAC,
-- credential expiry/supersession, actual non-invocation, CAS ownership or HTTP sends.
CREATE FUNCTION hr_email_safety_reference_guard() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'HrEmailOutbox' THEN
    IF NEW."safetyContractVersion" = 1 THEN
    IF NEW."invitationId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "HrAccountInvitation" i WHERE i."id" = NEW."invitationId"
        AND i."organizationId" = NEW."organizationId"
    ) THEN RAISE EXCEPTION 'Email credential organization mismatch'; END IF;
    IF NEW."resetChallengeId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "HrPasswordResetChallenge" c JOIN "HrUser" u ON u."id" = c."userId"
      WHERE c."id" = NEW."resetChallengeId" AND u."organizationId" = NEW."organizationId"
    ) THEN RAISE EXCEPTION 'Email credential organization mismatch'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'HrEmailDispatchEvent' THEN
    IF NEW."actorUserId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "HrUser" u WHERE u."id" = NEW."actorUserId" AND u."organizationId" = NEW."organizationId"
    ) THEN RAISE EXCEPTION 'Email actor organization mismatch'; END IF;
    IF NEW."auditEventId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "HrAuditEvent" a WHERE a."id" = NEW."auditEventId" AND a."organizationId" = NEW."organizationId"
    ) THEN RAISE EXCEPTION 'Email audit organization mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrEmailOutbox_safety_references"
  BEFORE INSERT OR UPDATE ON "HrEmailOutbox" FOR EACH ROW EXECUTE FUNCTION hr_email_safety_reference_guard();
CREATE TRIGGER "HrEmailDispatchEvent_safety_references"
  BEFORE INSERT ON "HrEmailDispatchEvent" FOR EACH ROW EXECUTE FUNCTION hr_email_safety_reference_guard();

-- Once classified, a row cannot escape safety checks by clearing its discriminator.
-- Legacy rows are not rewritten; initial classification is separately authorized work.
CREATE FUNCTION hr_email_safety_update_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."safetyContractVersion" IS NULL AND NEW."safetyContractVersion" = 1 THEN
    IF NEW."attemptCount" IS DISTINCT FROM OLD."attemptCount"
      OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
      OR NEW."recipient" IS DISTINCT FROM OLD."recipient"
      OR NEW."payload" IS DISTINCT FROM OLD."payload"
      OR NEW."template" IS DISTINCT FROM OLD."template"
      OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
      RAISE EXCEPTION 'Legacy email classification must preserve message and counters';
    END IF;
  END IF;
  IF OLD."safetyContractVersion" = 1 THEN
    IF NEW."safetyContractVersion" IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'Email safety contract downgrade prohibited';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'Email safety version must advance once';
    END IF;
    IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
      OR NEW."recipient" IS DISTINCT FROM OLD."recipient"
      OR NEW."payload" IS DISTINCT FROM OLD."payload"
      OR NEW."template" IS DISTINCT FROM OLD."template"
      OR NEW."subject" IS DISTINCT FROM OLD."subject"
      OR NEW."invitationId" IS DISTINCT FROM OLD."invitationId"
      OR NEW."resetChallengeId" IS DISTINCT FROM OLD."resetChallengeId"
      OR NEW."messageExpiresAt" IS DISTINCT FROM OLD."messageExpiresAt"
      OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
      RAISE EXCEPTION 'Email message identity is immutable';
    END IF;
    IF OLD."status" IN ('DELIVERED', 'ABANDONED') THEN
      RAISE EXCEPTION 'Terminal email records cannot transition';
    END IF;
    IF OLD."status" = 'HELD' AND NEW."status" NOT IN ('HELD', 'PENDING') THEN
      RAISE EXCEPTION 'Held email requires a separate release before processing';
    END IF;
    IF OLD."status" = 'PROCESSING' AND OLD."dispatchPhase" = 'RESERVED'
      AND NEW."status" = 'PROCESSING' AND NEW."dispatchPhase" = 'ATTEMPTED' THEN
      IF NEW."attemptCount" <> OLD."attemptCount" + 1 THEN
        RAISE EXCEPTION 'Email invocation boundary requires one attempt';
      END IF;
    ELSIF NEW."attemptCount" <> OLD."attemptCount" THEN
      RAISE EXCEPTION 'Email attempt counter changes only at invocation boundary';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrEmailOutbox_safety_update"
  BEFORE UPDATE ON "HrEmailOutbox" FOR EACH ROW EXECUTE FUNCTION hr_email_safety_update_guard();

CREATE FUNCTION hr_prevent_email_dispatch_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Email dispatch events are immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HrEmailDispatchEvent_immutable"
  BEFORE UPDATE OR DELETE ON "HrEmailDispatchEvent"
  FOR EACH ROW EXECUTE FUNCTION hr_prevent_email_dispatch_event_mutation();
CREATE TRIGGER "HrEmailDispatchEvent_no_truncate"
  BEFORE TRUNCATE ON "HrEmailDispatchEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION hr_prevent_email_dispatch_event_mutation();

-- Journal/queue writes MUST be one future CAS transaction. These constraints
-- do not enforce the caller's expected version/owner, cross-event ordering, live policy,
-- credential validity, cancellation/invocation exclusion or exactly-once delivery.
-- No legacy backfill, UPDATE of existing rows, attempt mutation or automatic release.
COMMIT;
