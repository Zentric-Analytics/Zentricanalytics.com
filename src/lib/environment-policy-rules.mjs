/**
 * Pure eligibility rules; never authentication, provider attestation or send authority.
 * A future trusted adapter must establish resolution and authorization provenance.
 * Both operations currently belong to the web workload (including its workers).
 * Ordinary data records/arrays are supported; executable objects/proxies are not.
 */
const resolutionKeys = new Set(["status", "reasonCode", "environment", "workloadType", "verificationBasis"]);
const authorizationKeys = new Set(["authorized", "environment", "purpose"]);

function dataRecord(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const data = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== "string" || !allowedKeys.has(key) || !("value" in descriptor)) return null;
    data[key] = descriptor.value;
  }
  return data;
}

function decision(eligible, reasonCode) {
  return Object.freeze({ eligible, reasonCode });
}

function webEnvironment(resolution) {
  const value = dataRecord(resolution, resolutionKeys);
  if (!value) return "INVALID_DEPLOYMENT_RESOLUTION";
  if (value.status === "UNVERIFIED") {
    return Object.keys(value).length === 2 && typeof value.reasonCode === "string" && value.reasonCode.length > 0
      ? "UNVERIFIED_ENVIRONMENT" : "INVALID_DEPLOYMENT_RESOLUTION";
  }
  if (Object.keys(value).length !== 5
    || !["web", "cron"].includes(value.workloadType)
    || !((value.status === "VERIFIED_STAGING" && value.environment === "staging")
      || (value.status === "VERIFIED_PRODUCTION" && value.environment === "production"))) {
    return "INVALID_DEPLOYMENT_RESOLUTION";
  }
  if (value.verificationBasis === "SYNTHETIC_FIXTURE" && value.reasonCode === "SYNTHETIC_BINDING_MATCH") {
    return "SYNTHETIC_RESOLUTION_REJECTED";
  }
  if (value.verificationBasis !== "CONFIGURATION_MATCH" || value.reasonCode !== "BINDING_MATCH") {
    return "INVALID_DEPLOYMENT_RESOLUTION";
  }
  return value.workloadType === "web" ? value.environment : "WORKLOAD_NOT_PERMITTED";
}

function normalizedEmail(input) {
  if (typeof input !== "string" || /[\u0000-\u001f\u007f]/u.test(input)) return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  // Plain single ASCII mailbox syntax, not display names, recipient lists or quoted locals.
  // This does not validate DNS, mailbox ownership, consent or message eligibility.
  if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+$/u.test(local)
    || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some(label => label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label))) return null;
  if (!/^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/u.test(labels[labels.length - 1])) return null;
  return email;
}

function recipientSet(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const length = descriptors.length.value;
  if (!length || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const recipients = new Set();
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[i];
    if (!descriptor || !("value" in descriptor)) return null;
    const email = normalizedEmail(descriptor.value);
    if (!email) return null;
    recipients.add(email);
  }
  return recipients;
}

/** Explicit authorization is a caller attestation, not established by an email address. */
export function evaluateInternalHrmsEmailEligibility(resolution, email, accountAuthorization) {
  const environment = webEnvironment(resolution);
  if (environment !== "staging" && environment !== "production") return decision(false, environment);
  const authorization = dataRecord(accountAuthorization, authorizationKeys);
  if (!authorization || Object.keys(authorization).length !== 3 || typeof authorization.authorized !== "boolean"
    || !["staging", "production"].includes(authorization.environment)
    || !["INTERNAL_HRMS_TEST", "INTERNAL_HRMS"].includes(authorization.purpose)) {
    return decision(false, "INVALID_ACCOUNT_AUTHORIZATION");
  }
  if (!authorization.authorized) return decision(false, "ACCOUNT_NOT_AUTHORIZED");
  if (authorization.environment !== environment
    || authorization.purpose !== (environment === "staging" ? "INTERNAL_HRMS_TEST" : "INTERNAL_HRMS")) {
    return decision(false, "AUTHORIZATION_SCOPE_MISMATCH");
  }
  const normalized = normalizedEmail(email);
  if (!normalized) return decision(false, "INVALID_EMAIL_ADDRESS");
  if (environment === "production" && normalized.split("@")[1] !== "zentricanalytics.com") {
    return decision(false, "PRODUCTION_COMPANY_DOMAIN_REQUIRED");
  }
  return decision(true, environment === "staging" ? "STAGING_TEST_ACCOUNT_ELIGIBLE" : "PRODUCTION_ACCOUNT_EMAIL_ELIGIBLE");
}

/** Recipient eligibility alone never authorizes a message or bypasses existing safeguards. */
export function evaluateOutgoingEmailRecipientEligibility(resolution, recipient, approvedRecipients) {
  const environment = webEnvironment(resolution);
  if (environment !== "staging" && environment !== "production") return decision(false, environment);
  const normalized = normalizedEmail(recipient);
  if (!normalized) return decision(false, "INVALID_EMAIL_ADDRESS");
  // Do not inspect staging-only configuration when deciding production eligibility.
  if (environment === "production") return decision(true, "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE");
  const recipients = recipientSet(approvedRecipients);
  if (!recipients) return decision(false, "INVALID_STAGING_RECIPIENT_ALLOWLIST");
  return recipients.has(normalized)
    ? decision(true, "STAGING_RECIPIENT_ALLOWLISTED")
    : decision(false, "STAGING_RECIPIENT_NOT_ALLOWLISTED");
}
