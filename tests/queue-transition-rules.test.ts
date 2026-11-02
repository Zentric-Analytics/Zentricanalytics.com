import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { evaluateQueueTransition as evaluate } from "../src/lib/hr/notifications/queue-transition-rules.mjs";
import type { QueueSnapshot, QueueCommand } from "../src/lib/hr/notifications/queue-transition-rules.mjs";
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");
const now = 1000;
const pending = Object.freeze({ state: "PENDING", version: 2, claimId: null, claimExpiresAt: null,
  dispatchPhase: "NONE", attemptCount: 0, maxAttempts: 5, nextAttemptAt: 100,
  holdReason: null, credentialState: "NOT_APPLICABLE", credentialExpiresAt: null } satisfies QueueSnapshot);
const processing = Object.freeze({ ...pending, state: "PROCESSING", claimId: "claim-fixture", claimExpiresAt: 2000 } satisfies QueueSnapshot);
const intent = Object.freeze({ ...processing, dispatchPhase: "INTENT" } satisfies QueueSnapshot);
const reserved = Object.freeze({ ...processing, dispatchPhase: "RESERVED" } satisfies QueueSnapshot);
const attempted = Object.freeze({ ...processing, dispatchPhase: "ATTEMPTED", attemptCount: 1 } satisfies QueueSnapshot);
const held = Object.freeze({ ...pending, state: "HELD", holdReason: "STAGING_RECIPIENT_NOT_ALLOWLISTED" } satisfies QueueSnapshot);
const command = (type: QueueCommand["type"], overrides = {}) => ({ type, expectedVersion: 2, claimId: "claim-fixture", policy: "ALLOW", ...overrides });
function check(snapshot: unknown, cmd: unknown, reason: string, state: string | null = null, delta = 0, disposition = state ? "TRANSITION" : "REJECT", time = now) {
  const result = evaluate(snapshot, cmd, time);
  assert.equal(result.reasonCode, reason);
  assert.equal(result.disposition, disposition);
  assert.equal(result.nextState, state);
  assert.equal(result.attemptDelta, delta);
  if (disposition === "TRANSITION") assert.ok(result.requirements.includes("ATOMIC_VERSION_CHECK"));
  return result;
}

describe("queue transitions and distinct dispatch phases", () => {
  for (const state of ["PENDING", "FAILED"] as const) it(`claims due ${state} without consuming attempts`, () => check({ ...pending, state }, command("CLAIM"), "CLAIM_APPROVED", "PROCESSING"));
  it("records intent without consuming attempts", () => {
    const result = check(processing, command("DISPATCH_INTENT"), "DISPATCH_INTENT_APPROVED", "PROCESSING");
    assert.equal(result.nextDispatchPhase, "INTENT");
  });
  it("reserves an attempt separately from intent and acceptance", () => {
    const result = check(intent, command("BEGIN_ATTEMPT"), "PROVIDER_ATTEMPT_RESERVED", "PROCESSING", 0);
    assert.equal(result.nextDispatchPhase, "RESERVED");
    assert.ok(result.requirements.includes("UNCERTAIN_ON_CRASH_NO_AUTO_RETRY"));
  });
  it("acceptance is not confirmed mailbox delivery", () => check(attempted, command("PROVIDER_ACCEPTED"), "PROVIDER_ACCEPTED_NOT_MAILBOX_DELIVERY", "DELIVERED"));
  it("confirmed retryable failure schedules retry", () => check(attempted, command("PROVIDER_FAILED", { retryable: true }), "CONFIRMED_PROVIDER_FAILURE", "FAILED"));
  it("permanent failure is terminal", () => check(attempted, command("PROVIDER_FAILED", { retryable: false }), "CONFIRMED_PROVIDER_FAILURE", "ABANDONED"));
  it("exhausted provider budget is terminal", () => check({ ...attempted, attemptCount: 5 }, command("PROVIDER_FAILED", { retryable: true }), "CONFIRMED_PROVIDER_FAILURE", "ABANDONED"));
  it("unknown provider outcome preserves message", () => check(attempted, command("PROVIDER_UNCERTAIN"), "PROVIDER_OUTCOME_UNCERTAIN", "HELD"));
  it("later policy change does not erase a confirmed provider outcome", () => check(attempted, command("PROVIDER_ACCEPTED", { policy: "CONFIGURATION_BLOCKED" }), "PROVIDER_ACCEPTED_NOT_MAILBOX_DELIVERY", "DELIVERED"));
  for (const type of ["PROVIDER_ACCEPTED", "PROVIDER_FAILED", "PROVIDER_UNCERTAIN"] as const) it(`cannot invent attempt for ${type}`, () => check(intent, command(type, { retryable: true }), "ATTEMPT_NOT_STARTED"));
  it("failure requires explicit retry classification", () => check(attempted, command("PROVIDER_FAILED"), "INVALID_COMMAND"));
  it("does not start before intent", () => check(processing, command("BEGIN_ATTEMPT"), "INVALID_TRANSITION"));
  it("does not repeat dispatch intent", () => check(intent, command("DISPATCH_INTENT"), "INVALID_TRANSITION"));
  it("does not reserve a second attempt", () => check(attempted, command("BEGIN_ATTEMPT"), "OUTCOME_REQUIRED"));
  it("does not claim a processing row", () => check(processing, command("CLAIM"), "INVALID_TRANSITION"));
  it("does not dispatch unclaimed work", () => check(pending, command("BEGIN_ATTEMPT"), "INVALID_TRANSITION"));
  it("does not claim before due time", () => check({ ...pending, nextAttemptAt: 1001 }, command("CLAIM"), "NOT_DUE"));
  it("requires a new claim identity", () => check(pending, { type: "CLAIM", expectedVersion: 2, policy: "ALLOW" }, "NEW_CLAIM_REQUIRED"));
  it("does not exceed retry budget", () => check({ ...pending, attemptCount: 5 }, command("CLAIM"), "ATTEMPT_BUDGET_EXHAUSTED"));
});

describe("holds, configuration pauses and release", () => {
  for (const [policy, reason] of [["HOLD", "STAGING_RECIPIENT_NOT_ALLOWLISTED"], ["INVALID_RECIPIENT", "INVALID_RECIPIENT"], ["UNSUPPORTED_TEMPLATE", "UNSUPPORTED_TEMPLATE"]]) {
    for (const snapshot of [pending, intent]) it(`holds ${snapshot.dispatchPhase} ${policy} with zero attempts`, () => check(snapshot, command(snapshot.state === "PROCESSING" ? "BEGIN_ATTEMPT" : "CLAIM", { policy }), reason, "HELD"));
  }
  for (const snapshot of [pending, intent]) it(`configuration pauses ${snapshot.dispatchPhase} without state mutation`, () => check(snapshot, command(snapshot.state === "PROCESSING" ? "BEGIN_ATTEMPT" : "CLAIM", { policy: "CONFIGURATION_BLOCKED" }), "CONFIGURATION_UNVERIFIED", null, 0, "PAUSE"));
  it("simulation cannot mutate live queues", () => check(pending, command("CLAIM", { policy: "SIMULATED" }), "SIMULATION_NO_LIVE_QUEUE_TRANSITION", null, 0, "PAUSE"));
  it("requires current policy", () => check(pending, { type: "CLAIM", expectedVersion: 2 }, "CURRENT_POLICY_REQUIRED", null, 0, "PAUSE"));
  it("hold needs a hold reason", () => check(pending, command("HOLD"), "HOLD_REASON_REQUIRED"));
  it("ordinary processing cannot release a hold", () => check(held, command("CLAIM"), "HELD_REQUIRES_RELEASE"));
  it("release needs authorization", () => check(held, command("RELEASE"), "RELEASE_NOT_AUTHORIZED"));
  it("release needs fresh eligible policy", () => check(held, command("RELEASE", { authorized: true, policy: "HOLD" }), "CURRENT_POLICY_REQUIRED", null, 0, "PAUSE"));
  it("authorized release preserves attempts", () => {
    const result = check({ ...held, attemptCount: 3 }, command("RELEASE", { authorized: true }), "HOLD_RELEASE_APPROVED", "PENDING");
    assert.ok(result.requirements.includes("PRESERVE_MESSAGE_AND_ATTEMPTS"));
  });
  for (const reason of ["PROVIDER_OUTCOME_UNCERTAIN", "LEGACY_PROCESSING_REVIEW_REQUIRED"]) it(`requires reconciliation for ${reason}`, () => {
    check({ ...held, holdReason: reason }, command("RELEASE", { authorized: true }), "RECONCILIATION_REQUIRED");
    check({ ...held, holdReason: reason }, command("RELEASE", { authorized: true, reconciled: true, nonInvocationEstablished: true, invocationFenced: true }), "HOLD_RELEASE_APPROVED", "PENDING");
  });
  it("release cannot reset exhausted attempts", () => check({ ...held, attemptCount: 5 }, command("RELEASE", { authorized: true }), "ATTEMPT_BUDGET_EXHAUSTED"));
  for (const credentialState of ["EXPIRED", "REVOKED", "USED", "SUPERSEDED"] as const) it(`cannot blindly replay ${credentialState}`, () => {
    check({ ...held, credentialState, credentialExpiresAt: 3000 }, command("RELEASE", { authorized: true }), "CREDENTIAL_UNUSABLE");
    check({ ...pending, credentialState, credentialExpiresAt: 3000 }, command("CLAIM"), "CREDENTIAL_EXPIRED_OR_UNUSABLE", "HELD");
  });
  it("credential expiry is checked against injected time", () => {
    check({ ...held, credentialState: "VALID", credentialExpiresAt: now }, command("RELEASE", { authorized: true }), "CREDENTIAL_UNUSABLE");
    check({ ...held, credentialState: "VALID", credentialExpiresAt: now + 1 }, command("RELEASE", { authorized: true }), "HOLD_RELEASE_APPROVED", "PENDING");
  });
});

describe("ownership, stale claims and input safety", () => {
  it("version mismatch precedes policy", () => check(processing, command("BEGIN_ATTEMPT", { expectedVersion: 1, policy: "HOLD" }), "VERSION_MISMATCH"));
  it("different owner cannot send or finalize", () => {
    check(intent, command("BEGIN_ATTEMPT", { claimId: "other" }), "CLAIM_MISMATCH");
    check(attempted, command("PROVIDER_ACCEPTED", { claimId: "other" }), "CLAIM_MISMATCH");
  });
  it("expired owner cannot send or finalize", () => {
    check({ ...intent, claimExpiresAt: now }, command("BEGIN_ATTEMPT"), "CLAIM_EXPIRED");
    check({ ...attempted, claimExpiresAt: now }, command("PROVIDER_ACCEPTED"), "CLAIM_EXPIRED");
  });
  it("cannot recover a live claim", () => check(processing, command("RECOVER"), "CLAIM_NOT_EXPIRED"));
  it("unstarted stale claim can recover with fencing", () => {
    const result = check({ ...processing, claimExpiresAt: now }, command("RECOVER"), "UNSTARTED_CLAIM_RECOVERABLE", "PENDING");
    assert.ok(result.requirements.includes("FENCE_OLD_OWNER"));
  });
  for (const snapshot of [intent, attempted]) it(`stale ${snapshot.dispatchPhase} never auto-retries`, () => check({ ...snapshot, claimExpiresAt: now }, command("RECOVER"), "PROVIDER_OUTCOME_UNCERTAIN", "HELD"));
  for (const state of ["DELIVERED", "ABANDONED"] as const) it(`terminal ${state} is protected`, () => check({ ...pending, state }, command("CLAIM"), "TERMINAL_STATE"));
  for (const input of [undefined, null, [], {}, Object.create(pending), { ...pending, [Symbol("extra")]: true }, { ...pending, version: -1 }, { ...pending, attemptCount: 6 }, { ...pending, maxAttempts: 101 }, { ...pending, claimId: "orphan" }, { ...held, holdReason: null }]) it("rejects malformed snapshot", () => check(input, command("CLAIM"), "INVALID_SNAPSHOT"));
  for (const cmd of [null, {}, { ...command("CLAIM"), authorized: "true" }, { ...command("CLAIM"), policy: "PROVIDER_FAILED" }, { ...command("CLAIM"), secret: "fixture" }]) it("rejects malformed command", () => check(pending, cmd, "INVALID_COMMAND"));
  it("never executes getters", () => check(Object.defineProperty({ ...pending }, "state", { get() { throw new Error("Getter executed"); } }), command("CLAIM"), "INVALID_SNAPSHOT"));
  it("cannot disguise an attempted uncertain hold as an ordinary policy hold", () => check({ ...held, dispatchPhase: "ATTEMPTED", attemptCount: 1 }, command("RELEASE", { authorized: true }), "INVALID_SNAPSHOT"));
  it("never executes command getters", () => check(pending, Object.defineProperty(command("CLAIM"), "authorized", { get() { throw new Error("Getter executed"); } }), "INVALID_COMMAND"));
  it("invalid time cannot authorize a transition", () => check(pending, command("CLAIM"), "INVALID_SNAPSHOT", null, 0, "REJECT", Number.NaN));
  for (const type of ["CLAIM", "HOLD", "DISPATCH_INTENT", "BEGIN_ATTEMPT", "BEGIN_INVOCATION", "CANCEL_RESERVED", "PROVIDER_ACCEPTED", "PROVIDER_FAILED", "PROVIDER_UNCERTAIN", "RECOVER"] as const) {
    it(`held state rejects ordinary ${type}`, () => check(held, command(type, { authorized: true, retryable: true }), "HELD_REQUIRES_RELEASE"));
  }
  it("freezes deterministic results and requirements without echoing claim IDs", () => {
    const before = JSON.stringify([pending, held, intent]);
    const result = evaluate(intent, command("BEGIN_ATTEMPT"), now);
    for (let i = 0; i < 40; i++) assert.deepEqual(evaluate(intent, command("BEGIN_ATTEMPT"), now), result);
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.requirements));
    assert.equal(JSON.stringify(result).includes("claim-fixture"), false);
    assert.equal(JSON.stringify([pending, held, intent]), before);
  });
  it("uses no environment, logging, filesystem, network or subprocess APIs", () => {
    const guarded: Array<[object, string]> = [[process, "env"], [globalThis, "fetch"], [globalThis, "setTimeout"], [globalThis, "setInterval"],
      ...["log", "info", "warn", "error", "debug"].map(key => [console, key] as [object, string]),
      ...["readFile", "readFileSync", "writeFile", "writeFileSync", "open", "openSync"].map(key => [fs, key] as [object, string]),
      ...["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"].map(key => [childProcess, key] as [object, string]),
      [net, "connect"], [net, "createConnection"], [http, "request"], [http, "get"], [https, "request"], [https, "get"]];
    const originals = guarded.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    const results: unknown[] = [];
    try {
      for (const [target, key] of guarded) Object.defineProperty(target, key, { configurable: true, get() { throw new Error("Forbidden API access"); } });
      results.push(evaluate(pending, command("CLAIM"), now), evaluate(held, command("RELEASE", { authorized: true }), now), evaluate(attempted, command("PROVIDER_UNCERTAIN"), now));
    } finally {
      guarded.forEach(([target, key], index) => { const original = originals[index]; if (original) Object.defineProperty(target, key, original); else Reflect.deleteProperty(target, key); });
    }
    assert.equal(results.length, 3);
  });
  it("has no runtime imports or clients", () => {
    const source = fs.readFileSync(new URL("../src/lib/hr/notifications/queue-transition-rules.mjs", import.meta.url), "utf8");
    assert.equal(/\bimport\s*(?:\(|["'{*])|\b(?:process|console|prisma)\s*\.|\b(?:fetch|require)\s*\(/u.test(source), false);
  });
});

describe("final policy boundary, reservation cancellation and crash evidence", () => {
  const cancellation = () => command("CANCEL_RESERVED", { nonInvocationEstablished: true, invocationFenced: true });
  it("denial before intent holds with zero attempts", () => check(processing, command("DISPATCH_INTENT", { policy: "HOLD" }), "STAGING_RECIPIENT_NOT_ALLOWLISTED", "HELD"));
  it("final recipient denial immediately before reservation consumes zero attempts", () => check(intent, command("BEGIN_ATTEMPT", { policy: "HOLD" }), "STAGING_RECIPIENT_NOT_ALLOWLISTED", "HELD"));
  it("environment denial immediately before reservation pauses without attempts", () => check(intent, command("BEGIN_ATTEMPT", { policy: "CONFIGURATION_BLOCKED" }), "CONFIGURATION_UNVERIFIED", null, 0, "PAUSE"));
  it("crosses the invocation boundary only with fresh eligible policy", () => {
    const result = check(reserved, command("BEGIN_INVOCATION"), "PROVIDER_INVOCATION_BOUNDARY", "PROCESSING", 1);
    assert.equal(result.nextDispatchPhase, "ATTEMPTED");
    assert.ok(result.requirements.includes("FENCE_INVOCATION_AND_CANCELLATION"));
  });
  for (const policy of ["HOLD", "INVALID_RECIPIENT", "UNSUPPORTED_TEMPLATE"]) it(`reserved ${policy} cannot invoke or consume attempts`, () => check(reserved, command("BEGIN_INVOCATION", { policy }), "RESERVATION_CANCELLATION_REQUIRED", null, 0, "PAUSE"));
  it("reserved environment denial cannot invoke", () => check(reserved, command("BEGIN_INVOCATION", { policy: "CONFIGURATION_BLOCKED" }), "CONFIGURATION_UNVERIFIED", null, 0, "PAUSE"));
  it("missing final policy cannot invoke", () => check(reserved, { type: "BEGIN_INVOCATION", expectedVersion: 2, claimId: "claim-fixture" }, "CURRENT_POLICY_REQUIRED", null, 0, "PAUSE"));
  it("established non-invocation can cancel only into HELD without a refund", () => {
    const result = check(reserved, cancellation(), "PRE_INVOCATION_CANCELLED", "HELD");
    assert.ok(result.requirements.includes("VERIFY_DURABLE_NON_INVOCATION"));
    assert.ok(result.requirements.includes("FENCE_OLD_OWNER"));
    assert.equal(result.nextDispatchPhase, "RESERVED");
  });
  for (const overrides of [{}, { nonInvocationEstablished: true }, { invocationFenced: true }, { nonInvocationEstablished: false, invocationFenced: true }]) it("cannot cancel without both proof attestations", () => check(reserved, command("CANCEL_RESERVED", overrides), "NON_INVOCATION_PROOF_REQUIRED"));
  it("a counter for a prior attempt is not refunded by reservation cancellation", () => check({ ...reserved, attemptCount: 2 }, cancellation(), "PRE_INVOCATION_CANCELLED", "HELD"));
  it("crash after intent remains held conservatively", () => check({ ...intent, claimExpiresAt: now }, command("RECOVER"), "PROVIDER_OUTCOME_UNCERTAIN", "HELD"));
  it("crash after reservation preserves uncertainty with zero newly counted attempts", () => {
    const result = check({ ...reserved, claimExpiresAt: now }, command("RECOVER"), "PROVIDER_OUTCOME_UNCERTAIN", "HELD");
    assert.equal(result.nextDispatchPhase, "RESERVED");
  });
  it("crash after invocation boundary preserves counted uncertain evidence", () => check({ ...attempted, claimExpiresAt: now }, command("RECOVER"), "PROVIDER_OUTCOME_UNCERTAIN", "HELD"));
  it("reservation alone cannot assert provider success or failure", () => {
    check(reserved, command("PROVIDER_ACCEPTED"), "ATTEMPT_NOT_STARTED");
    check(reserved, command("PROVIDER_FAILED", { retryable: true }), "ATTEMPT_NOT_STARTED");
  });
  it("a possibly invoked attempt cannot be cancelled or refunded", () => check(attempted, cancellation(), "INVALID_TRANSITION"));
  it("late policy denial after invocation boundary cannot trigger a new send or confirmed failure", () => check(attempted, command("BEGIN_INVOCATION", { policy: "HOLD" }), "OUTCOME_REQUIRED"));
  it("expired or conflicting actors cannot cancel", () => {
    check({ ...reserved, claimExpiresAt: now }, cancellation(), "CLAIM_EXPIRED");
    check(reserved, { ...cancellation(), claimId: "other" }, "CLAIM_MISMATCH");
    check(reserved, { ...cancellation(), expectedVersion: 1 }, "VERSION_MISMATCH");
  });
  it("generic reconciliation cannot release uncertainty", () => check({ ...held, holdReason: "PROVIDER_OUTCOME_UNCERTAIN", dispatchPhase: "RESERVED" }, command("RELEASE", { authorized: true, reconciled: true }), "NON_INVOCATION_PROOF_REQUIRED"));
  it("stale version cannot reconcile or release", () => check({ ...held, holdReason: "PROVIDER_OUTCOME_UNCERTAIN" }, command("RELEASE", { authorized: true, reconciled: true, nonInvocationEstablished: true, invocationFenced: true, expectedVersion: 1 }), "VERSION_MISMATCH"));
  it("cancelled holds remain nondispatchable", () => check({ ...held, holdReason: "PRE_INVOCATION_CANCELLED", dispatchPhase: "RESERVED" }, command("BEGIN_INVOCATION"), "HELD_REQUIRES_RELEASE"));
  it("invalid proof flags cannot be coerced", () => check(reserved, command("CANCEL_RESERVED", { nonInvocationEstablished: "true", invocationFenced: true }), "INVALID_COMMAND"));
});
