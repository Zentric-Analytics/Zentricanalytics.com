/**
 * Pure validation of an injected, normalized, non-secret configuration snapshot.
 * Field names are this module's contract, not a claim about provider variables.
 * No bindings, provenance verification, environment acquisition or live authority.
 * Ordinary data records only; executable objects and proxies are unsupported.
 */
const keys = new Set(["executionKind", "identitySource", "serviceId", "workloadType",
  "repository", "branch", "environment", "deploymentEnvironment", "configuredOrigin", "isPreview", "nodeEnv"]);

function record(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !keys.has(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function reject(reasonCode) { return Object.freeze({ status: "REJECTED", reasonCode }); }
function identifier(value) {
  return typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}
function repository(value) {
  return typeof value === "string" && value.length <= 256 && value.split("/").length === 2
    && value.split("/").every(identifier);
}
function branch(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/u.test(value)
    && !value.includes("..") && !value.includes("//")
    && value.split("/").every(part => part && !part.startsWith(".") && !part.endsWith(".") && !part.endsWith(".lock"));
}
function origin(value) {
  if (typeof value !== "string" || value.length > 256) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && url.pathname === "/" && !url.search && !url.hash && url.origin === value;
  } catch { return false; }
}

/** VALIDATED means syntax/consistency only; even identitySource=render is a claim. */
export function validateDeploymentRuntimeMetadata(snapshot) {
  const value = record(snapshot);
  if (!value) return reject("INVALID_SNAPSHOT");
  if (!["render", "local", "test", "ci"].includes(value.executionKind)) return reject("INVALID_EXECUTION_KIND");
  if (!["render", "synthetic"].includes(value.identitySource)) return reject("INVALID_IDENTITY_SOURCE");
  if ((value.executionKind === "render") !== (value.identitySource === "render")) return reject("CONTEXT_SOURCE_CONFLICT");
  if (!identifier(value.serviceId)) return reject("INVALID_SERVICE_ID");
  if (!["web", "cron"].includes(value.workloadType)) return reject("INVALID_WORKLOAD_TYPE");
  if (!repository(value.repository)) return reject("INVALID_REPOSITORY");
  if (!branch(value.branch)) return reject("INVALID_BRANCH");
  if (!["staging", "production"].includes(value.environment)) return reject("INVALID_ENVIRONMENT");
  if (Object.hasOwn(value, "deploymentEnvironment")) {
    if (!["staging", "production"].includes(value.deploymentEnvironment)) return reject("INVALID_ENVIRONMENT");
    if (value.deploymentEnvironment !== value.environment) return reject("ENVIRONMENT_CONFLICT");
  }
  if (typeof value.isPreview !== "boolean") return reject("INVALID_PREVIEW_CLASSIFICATION");
  if (value.isPreview) return reject("PREVIEW_NOT_APPROVED");
  if (value.workloadType === "web" ? !origin(value.configuredOrigin) : Object.hasOwn(value, "configuredOrigin")) return reject("INVALID_APPLICATION_ORIGIN");
  if (Object.hasOwn(value, "nodeEnv") && !["development", "test", "production"].includes(value.nodeEnv)) return reject("INVALID_NODE_ENV");
  const metadata = {
    serviceId: value.serviceId, identitySource: value.identitySource, workloadType: value.workloadType,
    repository: value.repository, branch: value.branch, environment: value.environment, isPreview: false,
    ...(value.workloadType === "web" ? { configuredOrigin: value.configuredOrigin } : {}),
    ...(Object.hasOwn(value, "nodeEnv") ? { nodeEnv: value.nodeEnv } : {}),
  };
  const executionContext = value.executionKind === "render"
    ? { kind: "render" } : { kind: value.executionKind, syntheticFixtures: true };
  return Object.freeze({ status: "VALIDATED", reasonCode: "METADATA_VALIDATED",
    assurance: "VALIDATED_CONFIGURATION_ONLY", metadata: Object.freeze(metadata),
    executionContext: Object.freeze(executionContext) });
}
