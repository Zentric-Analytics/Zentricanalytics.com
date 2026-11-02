/** Proposed contract only: HELD and ownership fields do not exist in current Prisma. */
export type QueueState = "PENDING" | "PROCESSING" | "FAILED" | "HELD" | "DELIVERED" | "ABANDONED";
export type DispatchPhase = "NONE" | "INTENT" | "RESERVED" | "ATTEMPTED";
export type HoldReason = "STAGING_RECIPIENT_NOT_ALLOWLISTED" | "INVALID_RECIPIENT" | "UNSUPPORTED_TEMPLATE"
  | "CREDENTIAL_EXPIRED_OR_UNUSABLE" | "PROVIDER_OUTCOME_UNCERTAIN" | "LEGACY_PROCESSING_REVIEW_REQUIRED" | "PRE_INVOCATION_CANCELLED";
export type QueueSnapshot = Readonly<{
  state: QueueState; version: number; claimId: string | null; claimExpiresAt: number | null;
  dispatchPhase: DispatchPhase; attemptCount: number; maxAttempts: number; nextAttemptAt: number;
  holdReason: HoldReason | null;
  credentialState: "NOT_APPLICABLE" | "VALID" | "EXPIRED" | "REVOKED" | "USED" | "SUPERSEDED";
  credentialExpiresAt: number | null;
}>;
export type QueueCommand = Readonly<{
  type: "CLAIM" | "HOLD" | "DISPATCH_INTENT" | "BEGIN_ATTEMPT" | "BEGIN_INVOCATION" | "CANCEL_RESERVED" | "PROVIDER_ACCEPTED" | "PROVIDER_FAILED" | "PROVIDER_UNCERTAIN" | "RECOVER" | "RELEASE";
  expectedVersion: number; claimId?: string;
  policy?: "ALLOW" | "HOLD" | "CONFIGURATION_BLOCKED" | "INVALID_RECIPIENT" | "UNSUPPORTED_TEMPLATE" | "SIMULATED";
  authorized?: boolean; retryable?: boolean; reconciled?: boolean;
  /** Trusted adapter attestations: not proven by these booleans or this pure module. */
  nonInvocationEstablished?: boolean; invocationFenced?: boolean;
}>;
export type QueueReasonCode = HoldReason | "INVALID_SNAPSHOT" | "INVALID_COMMAND" | "VERSION_MISMATCH"
  | "TERMINAL_STATE" | "INVALID_TRANSITION" | "RELEASE_NOT_AUTHORIZED" | "CURRENT_POLICY_REQUIRED"
  | "CREDENTIAL_UNUSABLE" | "RECONCILIATION_REQUIRED" | "ATTEMPT_BUDGET_EXHAUSTED" | "HOLD_RELEASE_APPROVED"
  | "HELD_REQUIRES_RELEASE" | "CLAIM_MISMATCH" | "CLAIM_NOT_EXPIRED" | "UNSTARTED_CLAIM_RECOVERABLE"
  | "CLAIM_EXPIRED" | "ATTEMPT_NOT_STARTED" | "PROVIDER_ACCEPTED_NOT_MAILBOX_DELIVERY"
  | "CONFIRMED_PROVIDER_FAILURE" | "OUTCOME_REQUIRED" | "CONFIGURATION_UNVERIFIED"
  | "SIMULATION_NO_LIVE_QUEUE_TRANSITION" | "HOLD_REASON_REQUIRED" | "NOT_DUE"
  | "NEW_CLAIM_REQUIRED" | "CLAIM_APPROVED" | "DISPATCH_INTENT_APPROVED" | "PROVIDER_ATTEMPT_RESERVED"
  | "NON_INVOCATION_PROOF_REQUIRED" | "RESERVATION_OUTCOME_REQUIRED" | "RESERVATION_CANCELLATION_REQUIRED" | "PROVIDER_INVOCATION_BOUNDARY";
export type QueueRequirement = "ATOMIC_VERSION_CHECK" | "INCREMENT_VERSION" | "APPEND_AUDIT"
  | "CLEAR_HOLD_AND_CLAIM" | "PRESERVE_MESSAGE_AND_ATTEMPTS" | "RECHECK_POLICY_AT_DISPATCH"
  | "FENCE_OLD_OWNER" | "CLEAR_CLAIM" | "RECONCILE_BEFORE_REPLAY" | "MATCH_CLAIM_AND_DISPATCH"
  | "RECORD_PROVIDER_ACCEPTANCE" | "RECORD_CONFIRMED_FAILURE" | "SCHEDULE_RETRY_ONLY_IF_FAILED"
  | "SET_NEW_CLAIM_AND_LEASE" | "RECHECK_POLICY_BEFORE_RENDER" | "APPEND_DISPATCH_INTENT"
  | "APPEND_ATTEMPT_START" | "FINAL_GATE_BEFORE_PROVIDER" | "UNCERTAIN_ON_CRASH_NO_AUTO_RETRY"
  | "VERIFY_DURABLE_NON_INVOCATION" | "APPEND_RESERVATION_CANCELLATION" | "APPEND_RESERVATION" | "FENCE_INVOCATION_AND_CANCELLATION";
export type QueueTransitionDecision = Readonly<{
  disposition: "TRANSITION" | "PAUSE" | "REJECT"; reasonCode: QueueReasonCode;
  nextState: QueueState | null; nextDispatchPhase: DispatchPhase | null;
  attemptDelta: 0 | 1; requirements: readonly QueueRequirement[];
}>;
/**
 * Pure conditional proposals, never a database update or permission to send.
 * Requires ordinary own-data records (no executable/accessor objects; no proxies).
 * All snapshot fields required; epoch-ms times and counters are nonnegative safe integers;
 * maxAttempts 1..100. Expected version and live ownership precede policy evaluation.
 * RELEASE requires fresh policy/authorization and credential usability. RECOVER requires
 * an expired matching claim, but any dispatch intent makes replay uncertain.
 * Provider outcomes are explicit caller attestations, not independently verified evidence.
 * ACCEPTED maps to legacy DELIVERED without asserting mailbox delivery.
 * BEGIN_ATTEMPT enters RESERVED with zero attempt delta. BEGIN_INVOCATION requires a
 * fresh ALLOW decision and crosses a durable invocation boundary with delta +1. ATTEMPTED
 * denotes possible invocation, not proof of transmission: a crash before the actual HTTP
 * call remains uncertain. No DB/network atomicity is claimed. A policy change after that
 * boundary MUST prevent provider invocation; preserve the counted uncertainty, never refund.
 * RESERVED cancellation requires current ownership and established durable non-invocation
 * plus invocation fencing. Both are trusted adapter attestations, not boolean proof.
 * Cancellation always holds with no counter decrement. A crash at INTENT/RESERVED still
 * holds conservatively unless separately reconciled. Late/expired actors cannot cancel.
 * Release of uncertain/legacy holds additionally requires established non-invocation and
 * fencing; a generic reconciled flag alone cannot authorize replay. Other reconciliation
 * dispositions (e.g. recording a late acceptance) are outside this pure release contract.
 * No refunds or counter resets are proposed. Adapters must implement fencing, journal/atomic
 * writes and final policy checks; Q01 cannot establish atomicity or exactly-once delivery.
 * Retention, lease duration, reviewer role and retry schedule remain operator decisions.
 */
export function evaluateQueueTransition(snapshot: unknown, command: unknown, now: number): QueueTransitionDecision;
