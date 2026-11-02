import { validateDeploymentRuntimeMetadata } from "./deployment-runtime-metadata.mjs";
import { resolveDeploymentEnvironment } from "./deployment-environment.mjs";
import { evaluateOutgoingEmailRecipientEligibility } from "./environment-policy-rules.mjs";

/** Pure classification only. Configuration matching is not Render attestation or send authority. */
function result(decision, stage, reasonCode) {
  return Object.freeze({ decision, stage, reasonCode });
}

/**
 * Defense against executable array containers before delegating binding validation.
 * Does not validate binding identities; that remains exclusively U02-I01's job.
 * Ordinary records/arrays only. Proxies are outside the existing components' contract.
 */
function bindingData(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const length = descriptors.length.value;
  if (Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const copy = [];
  for (let i = 0; i < length; i++) {
    const entry = descriptors[i];
    if (!entry || !("value" in entry)) return null;
    copy.push(entry.value);
  }
  return copy;
}

/**
 * Precedence: metadata -> independent bindings -> web workload -> synthetic -> recipient.
 * No recipient rewriting, authority acquisition, transport, persistence or counters.
 * Invalid recipient is CONFIGURATION_BLOCKED because this contract has no INVALID_MESSAGE
 * category; stage/reason distinguish it from deployment configuration defects.
 */
export function decideEmailDispatch(snapshot, approvedBindings, recipient, approvedRecipients) {
  const validated = validateDeploymentRuntimeMetadata(snapshot);
  if (validated.status === "REJECTED") return result("CONFIGURATION_BLOCKED", "METADATA", validated.reasonCode);
  const bindings = bindingData(approvedBindings);
  if (!bindings) return result("CONFIGURATION_BLOCKED", "BINDING", "INVALID_BINDINGS");
  const resolution = resolveDeploymentEnvironment(validated.metadata, bindings, validated.executionContext);
  if (resolution.status === "UNVERIFIED") return result("CONFIGURATION_BLOCKED", "BINDING", resolution.reasonCode);
  if (resolution.workloadType !== "web") return result("CONFIGURATION_BLOCKED", "WORKLOAD", "WORKLOAD_NOT_PERMITTED");
  if (resolution.verificationBasis === "SYNTHETIC_FIXTURE") return result("SIMULATED", "SIMULATION", "SYNTHETIC_DISPATCH_ONLY");
  const eligibility = evaluateOutgoingEmailRecipientEligibility(resolution, recipient, approvedRecipients);
  if (eligibility.eligible) return result("ALLOW", "RECIPIENT", eligibility.reasonCode);
  return result(eligibility.reasonCode === "STAGING_RECIPIENT_NOT_ALLOWLISTED" ? "HOLD" : "CONFIGURATION_BLOCKED", "RECIPIENT", eligibility.reasonCode);
}

/**
 * Separate retrospective caller attestation, not a policy override or evidence we sent.
 * Only the exact explicit own-data shape { attempted: true, status: 'failed' } is accepted.
 * No error strings, provider payloads, recipients or credentials are accepted/echoed.
 */
export function classifyEmailProviderAttempt(outcome) {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(outcome))) {
    return result("CONFIGURATION_BLOCKED", "PROVIDER_OUTCOME", "INVALID_PROVIDER_ATTEMPT_OUTCOME");
  }
  const descriptors = Object.getOwnPropertyDescriptors(outcome);
  if (Reflect.ownKeys(descriptors).length !== 2
    || !descriptors.attempted || !("value" in descriptors.attempted) || descriptors.attempted.value !== true
    || !descriptors.status || !("value" in descriptors.status) || descriptors.status.value !== "failed") {
    return result("CONFIGURATION_BLOCKED", "PROVIDER_OUTCOME", "INVALID_PROVIDER_ATTEMPT_OUTCOME");
  }
  return result("PROVIDER_FAILED", "PROVIDER_OUTCOME", "PROVIDER_ATTEMPT_FAILED");
}
