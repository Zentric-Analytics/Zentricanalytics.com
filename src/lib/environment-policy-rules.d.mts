import type { DeploymentResolution } from "./deployment-environment.mjs";

/** Explicit, environment-scoped authorization supplied by a future trusted adapter. */
export type InternalHrmsAccountAuthorization =
  | Readonly<{ authorized: boolean; environment: "staging"; purpose: "INTERNAL_HRMS_TEST" }>
  | Readonly<{ authorized: boolean; environment: "production"; purpose: "INTERNAL_HRMS" }>;

export type EnvironmentPolicyRejection =
  | "INVALID_DEPLOYMENT_RESOLUTION" | "UNVERIFIED_ENVIRONMENT"
  | "SYNTHETIC_RESOLUTION_REJECTED" | "WORKLOAD_NOT_PERMITTED";

export type InternalHrmsEmailDecision =
  | Readonly<{ eligible: true; reasonCode: "STAGING_TEST_ACCOUNT_ELIGIBLE" | "PRODUCTION_ACCOUNT_EMAIL_ELIGIBLE" }>
  | Readonly<{
      eligible: false;
      reasonCode: EnvironmentPolicyRejection | "INVALID_ACCOUNT_AUTHORIZATION" | "ACCOUNT_NOT_AUTHORIZED"
        | "AUTHORIZATION_SCOPE_MISMATCH" | "INVALID_EMAIL_ADDRESS" | "PRODUCTION_COMPANY_DOMAIN_REQUIRED";
    }>;

export type OutgoingEmailRecipientDecision =
  | Readonly<{ eligible: true; reasonCode: "STAGING_RECIPIENT_ALLOWLISTED" | "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE" }>
  | Readonly<{
      eligible: false;
      reasonCode: EnvironmentPolicyRejection | "INVALID_EMAIL_ADDRESS"
        | "INVALID_STAGING_RECIPIENT_ALLOWLIST" | "STAGING_RECIPIENT_NOT_ALLOWLISTED";
    }>;

/**
 * Defense-in-depth eligibility only; requires a consistent U02-I01 configuration
 * match for a web workload. Never substitutes for provenance, password, MFA,
 * session, tenant, RBAC or public candidate authorization. Ordinary data only;
 * no executable objects/proxies. Emails normalize by trimming/lowercasing, with
 * plain single ASCII mailbox syntax (not quoted locals/display names/lists).
 */
export function evaluateInternalHrmsEmailEligibility(
  resolution: DeploymentResolution,
  email: string,
  accountAuthorization: InternalHrmsAccountAuthorization,
): InternalHrmsEmailDecision;

/**
 * Separate from HRMS login eligibility. Web workloads only. Staging requires a
 * nonempty array of valid complete mailboxes; one invalid entry denies the list.
 * Case/outer spaces normalize; aliases, plus-tags and dots are not rewritten.
 * Production ignores the staging allowlist. Eligible does not grant consent,
 * authorize dispatch, change queue state or prove independent provider identity.
 */
export function evaluateOutgoingEmailRecipientEligibility(
  resolution: DeploymentResolution,
  recipient: string,
  approvedRecipients?: readonly string[],
): OutgoingEmailRecipientDecision;
