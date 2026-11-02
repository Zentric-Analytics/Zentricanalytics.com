import type { RuntimeMetadataRejectionCode } from "./deployment-runtime-metadata.mjs";
import type { UnverifiedReasonCode } from "./deployment-environment.mjs";
import type { OutgoingEmailRecipientDecision } from "./environment-policy-rules.mjs";

export type EmailPolicyDecision =
  | Readonly<{ decision: "ALLOW"; stage: "RECIPIENT";
      reasonCode: "STAGING_RECIPIENT_ALLOWLISTED" | "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE" }>
  | Readonly<{ decision: "HOLD"; stage: "RECIPIENT"; reasonCode: "STAGING_RECIPIENT_NOT_ALLOWLISTED" }>
  | Readonly<{ decision: "SIMULATED"; stage: "SIMULATION"; reasonCode: "SYNTHETIC_DISPATCH_ONLY" }>
  | Readonly<{ decision: "CONFIGURATION_BLOCKED"; stage: "METADATA"; reasonCode: RuntimeMetadataRejectionCode }>
  | Readonly<{ decision: "CONFIGURATION_BLOCKED"; stage: "BINDING"; reasonCode: UnverifiedReasonCode }>
  | Readonly<{ decision: "CONFIGURATION_BLOCKED"; stage: "WORKLOAD"; reasonCode: "WORKLOAD_NOT_PERMITTED" }>
  | Readonly<{ decision: "CONFIGURATION_BLOCKED"; stage: "RECIPIENT";
      reasonCode: Exclude<Extract<OutgoingEmailRecipientDecision, { eligible: false }>["reasonCode"], "STAGING_RECIPIENT_NOT_ALLOWLISTED"> }>;

export type EmailProviderAttemptOutcome = Readonly<{ attempted: true; status: "failed" }>;
export type EmailProviderAttemptDecision =
  | Readonly<{ decision: "PROVIDER_FAILED"; stage: "PROVIDER_OUTCOME"; reasonCode: "PROVIDER_ATTEMPT_FAILED" }>
  | Readonly<{ decision: "CONFIGURATION_BLOCKED"; stage: "PROVIDER_OUTCOME"; reasonCode: "INVALID_PROVIDER_ATTEMPT_OUTCOME" }>;

/**
 * Runs U02-I03-01, then U02-I01 with independently approved bindings, then U02-I02.
 * Never accepts precomputed resolution/status as authority. Matching is not independent
 * Render attestation: future callers must establish configuration/binding provenance.
 * Precedence: metadata failures, binding failures, non-web rejection, synthetic simulation,
 * recipient policy (invalid recipient precedes allowlist validity per U02-I02).
 * Synthetic simulation does not validate a message or imply an attempt. Cron always blocks.
 * Production ignores the staging list. No outputs contain addresses or transformed recipients.
 * Ordinary data objects/arrays only; proxies are unsupported. Frozen, deterministic results.
 * ALLOW is configuration eligibility only, not workflow authorization or live send authority.
 */
export function decideEmailDispatch(
  snapshot: unknown, approvedBindings: unknown, recipient: unknown, approvedRecipients?: unknown,
): EmailPolicyDecision;

/**
 * Validates an explicit failure outcome, independently of policy classification.
 * This is a retrospective caller attestation; no independent provider evidence is established.
 * Missing/invalid/unattempted/success outcomes block; they never imply a provider failure.
 * No function here initiates a send, records a delivery, mutates attempts or retries anything.
 */
export function classifyEmailProviderAttempt(outcome: unknown): EmailProviderAttemptDecision;
