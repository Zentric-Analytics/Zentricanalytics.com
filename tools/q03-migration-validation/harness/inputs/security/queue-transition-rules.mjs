/**
 * Proposed offline contract, independent of Prisma and the current database enum.
 * Caller attestations are not independently verified. No send authority, atomicity,
 * provider evidence or exactly-once guarantee is established. Ordinary data only;
 * proxies are unsupported. Time is explicitly injected as epoch milliseconds.
 */
const snapshotKeys = new Set(["state", "version", "claimId", "claimExpiresAt", "dispatchPhase", "attemptCount", "maxAttempts", "nextAttemptAt", "holdReason", "credentialState", "credentialExpiresAt"]);
const commandKeys = new Set(["type", "expectedVersion", "claimId", "policy", "authorized", "retryable", "reconciled", "nonInvocationEstablished", "invocationFenced"]);
const states = new Set(["PENDING", "PROCESSING", "FAILED", "HELD", "DELIVERED", "ABANDONED"]);
const phases = new Set(["NONE", "INTENT", "RESERVED", "ATTEMPTED"]);
const holds = new Set(["STAGING_RECIPIENT_NOT_ALLOWLISTED", "INVALID_RECIPIENT", "UNSUPPORTED_TEMPLATE", "CREDENTIAL_EXPIRED_OR_UNUSABLE", "PROVIDER_OUTCOME_UNCERTAIN", "LEGACY_PROCESSING_REVIEW_REQUIRED", "PRE_INVOCATION_CANCELLED"]);
const actions = new Set(["CLAIM", "HOLD", "DISPATCH_INTENT", "BEGIN_ATTEMPT", "BEGIN_INVOCATION", "CANCEL_RESERVED", "PROVIDER_ACCEPTED", "PROVIDER_FAILED", "PROVIDER_UNCERTAIN", "RECOVER", "RELEASE"]);
const policies = new Set(["ALLOW", "HOLD", "CONFIGURATION_BLOCKED", "INVALID_RECIPIENT", "UNSUPPORTED_TEMPLATE", "SIMULATED"]);
function record(input, keys) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !keys.has(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}
const integer = value => Number.isSafeInteger(value) && value >= 0;
const identifier = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
function result(disposition, reasonCode, state = null, phase = null, attemptDelta = 0, requirements = []) {
  return Object.freeze({ disposition, reasonCode, nextState: state, nextDispatchPhase: phase,
    attemptDelta, requirements: Object.freeze(requirements) });
}
const reject = reason => result("REJECT", reason);
const pause = reason => result("PAUSE", reason);
function transition(state, phase, reason, attemptDelta = 0, extra = []) {
  return result("TRANSITION", reason, state, phase, attemptDelta,
    ["ATOMIC_VERSION_CHECK", "INCREMENT_VERSION", "APPEND_AUDIT", ...extra]);
}
function validSnapshot(s) {
  if (!s || !states.has(s.state) || !integer(s.version) || s.version === Number.MAX_SAFE_INTEGER
    || !phases.has(s.dispatchPhase) || !integer(s.attemptCount) || !integer(s.maxAttempts)
    || s.maxAttempts < 1 || s.maxAttempts > 100 || s.attemptCount > s.maxAttempts
    || !integer(s.nextAttemptAt) || !["NOT_APPLICABLE", "VALID", "EXPIRED", "REVOKED", "USED", "SUPERSEDED"].includes(s.credentialState)) return false;
  if (s.credentialState === "NOT_APPLICABLE" ? s.credentialExpiresAt !== null : !integer(s.credentialExpiresAt)) return false;
  if (s.state === "PROCESSING" ? !identifier(s.claimId) || !integer(s.claimExpiresAt) : s.claimId !== null || s.claimExpiresAt !== null) return false;
  if (s.state === "HELD" ? !holds.has(s.holdReason) : s.holdReason !== null) return false;
  if (["PENDING", "FAILED"].includes(s.state) && s.dispatchPhase !== "NONE") return false;
  if (s.dispatchPhase === "ATTEMPTED" && s.attemptCount === 0) return false;
  if (s.state === "HELD" && s.dispatchPhase === "ATTEMPTED"
    && !["PROVIDER_OUTCOME_UNCERTAIN", "LEGACY_PROCESSING_REVIEW_REQUIRED"].includes(s.holdReason)) return false;
  return true;
}
function credentialsUsable(s, now) {
  return s.credentialState === "NOT_APPLICABLE" || (s.credentialState === "VALID" && s.credentialExpiresAt > now);
}

/** No input is mutated. TRANSITION is a conditional proposal, never an applied action. */
export function evaluateQueueTransition(snapshot, command, now) {
  const s = record(snapshot, snapshotKeys), c = record(command, commandKeys);
  if (!integer(now) || !validSnapshot(s)) return reject("INVALID_SNAPSHOT");
  if (!c || !actions.has(c.type) || !integer(c.expectedVersion)
    || (Object.hasOwn(c, "policy") && !policies.has(c.policy))
    || ["authorized", "retryable", "reconciled", "nonInvocationEstablished", "invocationFenced"].some(key => Object.hasOwn(c, key) && typeof c[key] !== "boolean")
    || (Object.hasOwn(c, "claimId") && !identifier(c.claimId))) return reject("INVALID_COMMAND");
  if (c.expectedVersion !== s.version) return reject("VERSION_MISMATCH");
  if (["DELIVERED", "ABANDONED"].includes(s.state)) return reject("TERMINAL_STATE");
  if (c.type === "RELEASE") {
    if (s.state !== "HELD") return reject("INVALID_TRANSITION");
    if (c.authorized !== true) return reject("RELEASE_NOT_AUTHORIZED");
    if (c.policy !== "ALLOW") return pause("CURRENT_POLICY_REQUIRED");
    if (!credentialsUsable(s, now)) return reject("CREDENTIAL_UNUSABLE");
    if (["PROVIDER_OUTCOME_UNCERTAIN", "LEGACY_PROCESSING_REVIEW_REQUIRED"].includes(s.holdReason) && c.reconciled !== true) return reject("RECONCILIATION_REQUIRED");
    if (["PROVIDER_OUTCOME_UNCERTAIN", "LEGACY_PROCESSING_REVIEW_REQUIRED"].includes(s.holdReason)
      && (c.nonInvocationEstablished !== true || c.invocationFenced !== true)) return reject("NON_INVOCATION_PROOF_REQUIRED");
    if (s.attemptCount >= s.maxAttempts) return reject("ATTEMPT_BUDGET_EXHAUSTED");
    return transition("PENDING", "NONE", "HOLD_RELEASE_APPROVED", 0, ["CLEAR_HOLD_AND_CLAIM", "PRESERVE_MESSAGE_AND_ATTEMPTS", "RECHECK_POLICY_AT_DISPATCH"]);
  }
  if (s.state === "HELD") return reject("HELD_REQUIRES_RELEASE");
  if (c.type === "CLAIM" && !["PENDING", "FAILED"].includes(s.state)) return reject("INVALID_TRANSITION");
  if (["DISPATCH_INTENT", "BEGIN_ATTEMPT", "BEGIN_INVOCATION", "CANCEL_RESERVED"].includes(c.type) && s.state !== "PROCESSING") return reject("INVALID_TRANSITION");
  if (s.state === "PROCESSING") {
    if (c.claimId !== s.claimId) return reject("CLAIM_MISMATCH");
    if (c.type === "RECOVER") {
      if (s.claimExpiresAt > now) return reject("CLAIM_NOT_EXPIRED");
      return s.dispatchPhase === "NONE"
        ? transition("PENDING", "NONE", "UNSTARTED_CLAIM_RECOVERABLE", 0, ["FENCE_OLD_OWNER", "CLEAR_CLAIM"])
        : transition("HELD", s.dispatchPhase, "PROVIDER_OUTCOME_UNCERTAIN", 0, ["FENCE_OLD_OWNER", "CLEAR_CLAIM", "RECONCILE_BEFORE_REPLAY"]);
    }
    if (s.claimExpiresAt <= now) return reject("CLAIM_EXPIRED");
  } else if (c.type === "RECOVER") return reject("INVALID_TRANSITION");
  if (c.type === "CANCEL_RESERVED") {
    if (s.dispatchPhase !== "RESERVED") return reject("INVALID_TRANSITION");
    if (c.nonInvocationEstablished !== true || c.invocationFenced !== true) return reject("NON_INVOCATION_PROOF_REQUIRED");
    return transition("HELD", "RESERVED", "PRE_INVOCATION_CANCELLED", 0,
      ["MATCH_CLAIM_AND_DISPATCH", "FENCE_OLD_OWNER", "VERIFY_DURABLE_NON_INVOCATION", "APPEND_RESERVATION_CANCELLATION", "CLEAR_CLAIM", "PRESERVE_MESSAGE_AND_ATTEMPTS"]);
  }
  if (["PROVIDER_ACCEPTED", "PROVIDER_FAILED", "PROVIDER_UNCERTAIN"].includes(c.type)) {
    if (s.state !== "PROCESSING" || s.dispatchPhase !== "ATTEMPTED") return reject("ATTEMPT_NOT_STARTED");
    if (c.type === "PROVIDER_ACCEPTED") return transition("DELIVERED", "ATTEMPTED", "PROVIDER_ACCEPTED_NOT_MAILBOX_DELIVERY", 0, ["MATCH_CLAIM_AND_DISPATCH", "RECORD_PROVIDER_ACCEPTANCE", "CLEAR_CLAIM"]);
    if (c.type === "PROVIDER_UNCERTAIN") return transition("HELD", "ATTEMPTED", "PROVIDER_OUTCOME_UNCERTAIN", 0, ["MATCH_CLAIM_AND_DISPATCH", "CLEAR_CLAIM", "RECONCILE_BEFORE_REPLAY"]);
    if (typeof c.retryable !== "boolean") return reject("INVALID_COMMAND");
    return transition(c.retryable && s.attemptCount < s.maxAttempts ? "FAILED" : "ABANDONED", "NONE", "CONFIRMED_PROVIDER_FAILURE", 0, ["MATCH_CLAIM_AND_DISPATCH", "RECORD_CONFIRMED_FAILURE", "CLEAR_CLAIM", "SCHEDULE_RETRY_ONLY_IF_FAILED"]);
  }
  if (s.dispatchPhase === "ATTEMPTED") return reject("OUTCOME_REQUIRED");
  if (s.dispatchPhase === "RESERVED" && c.type !== "BEGIN_INVOCATION") return reject("RESERVATION_OUTCOME_REQUIRED");
  if (c.type === "BEGIN_INVOCATION" && s.dispatchPhase !== "RESERVED") return reject("INVALID_TRANSITION");
  if (!c.policy) return pause("CURRENT_POLICY_REQUIRED");
  if (c.policy === "CONFIGURATION_BLOCKED") return pause("CONFIGURATION_UNVERIFIED");
  if (c.policy === "SIMULATED") return pause("SIMULATION_NO_LIVE_QUEUE_TRANSITION");
  const holdReason = c.policy === "HOLD" ? "STAGING_RECIPIENT_NOT_ALLOWLISTED"
    : ["INVALID_RECIPIENT", "UNSUPPORTED_TEMPLATE"].includes(c.policy) ? c.policy : null;
  if (holdReason || !credentialsUsable(s, now)) {
    if (s.dispatchPhase === "RESERVED") return pause("RESERVATION_CANCELLATION_REQUIRED");
    if (!["CLAIM", "HOLD", "DISPATCH_INTENT", "BEGIN_ATTEMPT"].includes(c.type)) return reject("INVALID_TRANSITION");
    return transition("HELD", s.dispatchPhase, holdReason ?? "CREDENTIAL_EXPIRED_OR_UNUSABLE", 0, ["CLEAR_CLAIM", "PRESERVE_MESSAGE_AND_ATTEMPTS"]);
  }
  if (c.type === "HOLD") return reject("HOLD_REASON_REQUIRED");
  if (s.attemptCount >= s.maxAttempts) return reject("ATTEMPT_BUDGET_EXHAUSTED");
  if (c.type === "CLAIM") {
    if (!["PENDING", "FAILED"].includes(s.state)) return reject("INVALID_TRANSITION");
    if (s.nextAttemptAt > now) return reject("NOT_DUE");
    if (!c.claimId) return reject("NEW_CLAIM_REQUIRED");
    return transition("PROCESSING", "NONE", "CLAIM_APPROVED", 0, ["SET_NEW_CLAIM_AND_LEASE", "RECHECK_POLICY_BEFORE_RENDER"]);
  }
  if (s.state !== "PROCESSING") return reject("INVALID_TRANSITION");
  if (c.type === "DISPATCH_INTENT" && s.dispatchPhase === "NONE") return transition("PROCESSING", "INTENT", "DISPATCH_INTENT_APPROVED", 0, ["MATCH_CLAIM_AND_DISPATCH", "APPEND_DISPATCH_INTENT", "RECHECK_POLICY_AT_DISPATCH"]);
  if (c.type === "BEGIN_ATTEMPT" && s.dispatchPhase === "INTENT") return transition("PROCESSING", "RESERVED", "PROVIDER_ATTEMPT_RESERVED", 0, ["MATCH_CLAIM_AND_DISPATCH", "APPEND_RESERVATION", "RECHECK_POLICY_AT_DISPATCH", "UNCERTAIN_ON_CRASH_NO_AUTO_RETRY"]);
  if (c.type === "BEGIN_INVOCATION" && s.dispatchPhase === "RESERVED") return transition("PROCESSING", "ATTEMPTED", "PROVIDER_INVOCATION_BOUNDARY", 1,
    ["MATCH_CLAIM_AND_DISPATCH", "APPEND_ATTEMPT_START", "FINAL_GATE_BEFORE_PROVIDER", "FENCE_INVOCATION_AND_CANCELLATION", "UNCERTAIN_ON_CRASH_NO_AUTO_RETRY"]);
  return reject("INVALID_TRANSITION");
}
