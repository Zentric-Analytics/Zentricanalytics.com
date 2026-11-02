/**
 * Pure configuration matching, not provider attestation or account authorization.
 * A future trusted server adapter must establish metadata/binding provenance.
 * Synthetic matches are explicitly marked and must never authorize live effects.
 * Inputs must be ordinary data records, not proxies or executable objects.
 */
const environments = new Set(["staging", "production"]);
const workloads = new Set(["web", "cron"]);
const sources = new Set(["render", "synthetic"]);
const bindingKeys = new Set([
  "serviceId", "identitySource", "workloadType", "repository", "branch",
  "environment", "configuredOrigin",
]);
const metadataKeys = new Set([...bindingKeys, "isPreview", "nodeEnv"]);
const contextKeys = new Set(["kind", "syntheticFixtures"]);

function record(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== "string" || !allowedKeys.has(key) || !("value" in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && value.trim() === value && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function origin(value) {
  if (!identifier(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      && parsed.pathname === "/" && !parsed.search && !parsed.hash
      && parsed.origin === value;
  } catch {
    return false;
  }
}

function validIdentity(value) {
  return identifier(value.serviceId) && sources.has(value.identitySource)
    && workloads.has(value.workloadType) && environments.has(value.environment)
    && identifier(value.repository) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository)
    && identifier(value.branch)
    && (value.workloadType === "web" ? origin(value.configuredOrigin) : value.configuredOrigin === undefined);
}

function unverified(reasonCode) {
  return Object.freeze({ status: "UNVERIFIED", reasonCode });
}

/** No imports, environment reads, logging, I/O, or application initialization. */
export function resolveDeploymentEnvironment(metadata, approvedBindings, executionContext) {
  const context = record(executionContext, contextKeys);
  if (!context || !["render", "local", "test", "ci"].includes(context.kind)
    || (context.kind === "render"
      ? context.syntheticFixtures !== undefined && context.syntheticFixtures !== false
      : context.syntheticFixtures !== true)) return unverified("INVALID_CONTEXT");

  if (!Array.isArray(approvedBindings) || approvedBindings.length === 0) return unverified("INVALID_BINDINGS");
  const bindings = new Map();
  for (const item of approvedBindings) {
    const binding = record(item, bindingKeys);
    if (!binding || !validIdentity(binding)) return unverified("INVALID_BINDINGS");
    if (bindings.has(binding.serviceId)) return unverified("DUPLICATE_SERVICE_BINDING");
    bindings.set(binding.serviceId, binding);
  }

  const actual = record(metadata, metadataKeys);
  if (!actual || !validIdentity(actual) || typeof actual.isPreview !== "boolean"
    || (actual.nodeEnv !== undefined && !identifier(actual.nodeEnv))) return unverified("INVALID_METADATA");
  if (actual.isPreview) return unverified("PREVIEW_NOT_APPROVED");
  const binding = bindings.get(actual.serviceId);
  if (!binding) return unverified("UNKNOWN_SERVICE");
  if ((binding.identitySource === "render") !== (context.kind === "render")) return unverified("CONTEXT_MISMATCH");
  if (actual.identitySource !== binding.identitySource) return unverified("IDENTITY_SOURCE_MISMATCH");
  for (const [key, reason] of [
    ["workloadType", "WORKLOAD_MISMATCH"],
    ["repository", "REPOSITORY_MISMATCH"],
    ["branch", "BRANCH_MISMATCH"],
    ["environment", "ENVIRONMENT_MISMATCH"],
    ["configuredOrigin", "ORIGIN_MISMATCH"],
  ]) {
    if (actual[key] !== binding[key]) return unverified(reason);
  }
  return Object.freeze({
    status: binding.environment === "production" ? "VERIFIED_PRODUCTION" : "VERIFIED_STAGING",
    reasonCode: binding.identitySource === "synthetic" ? "SYNTHETIC_BINDING_MATCH" : "BINDING_MATCH",
    environment: binding.environment,
    workloadType: binding.workloadType,
    verificationBasis: binding.identitySource === "synthetic" ? "SYNTHETIC_FIXTURE" : "CONFIGURATION_MATCH",
  });
}
