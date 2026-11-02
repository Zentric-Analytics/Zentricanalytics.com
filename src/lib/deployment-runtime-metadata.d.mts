import type { DeploymentMetadata, DeploymentExecutionContext, DeploymentEnvironment, DeploymentWorkload, IdentitySource } from "./deployment-environment.mjs";

/** Normalized non-secret data, explicitly supplied by a caller; no provider acquisition. */
export type RuntimeMetadataSnapshot = Readonly<{
  executionKind: "render" | "local" | "test" | "ci";
  identitySource: IdentitySource;
  serviceId: string;
  workloadType: DeploymentWorkload;
  repository: string;
  branch: string;
  environment: DeploymentEnvironment;
  /** Optional independent configuration assertion; must agree if present. */
  deploymentEnvironment?: DeploymentEnvironment;
  /** Required canonical HTTPS origin for web; property must be absent for cron. */
  configuredOrigin?: string;
  /** Required boolean. Preview deployments are rejected. */
  isPreview: boolean;
  /** Diagnostic only, never environment proof. */
  nodeEnv?: "development" | "test" | "production";
}>;

export type RuntimeMetadataRejectionCode =
  | "INVALID_SNAPSHOT" | "INVALID_EXECUTION_KIND" | "INVALID_IDENTITY_SOURCE"
  | "CONTEXT_SOURCE_CONFLICT" | "INVALID_SERVICE_ID" | "INVALID_WORKLOAD_TYPE"
  | "INVALID_REPOSITORY" | "INVALID_BRANCH" | "INVALID_ENVIRONMENT" | "ENVIRONMENT_CONFLICT"
  | "INVALID_PREVIEW_CLASSIFICATION" | "PREVIEW_NOT_APPROVED" | "INVALID_APPLICATION_ORIGIN" | "INVALID_NODE_ENV";

export type RuntimeMetadataValidation =
  | Readonly<{ status: "REJECTED"; reasonCode: RuntimeMetadataRejectionCode }>
  | Readonly<{ status: "VALIDATED"; reasonCode: "METADATA_VALIDATED";
      assurance: "VALIDATED_CONFIGURATION_ONLY"; metadata: Readonly<DeploymentMetadata>;
      executionContext: DeploymentExecutionContext }>;

/**
 * Validates ordinary own-data records only (no accessors/classes/executable objects;
 * proxies are outside the contract). Unknown/symbol properties reject. No coercion.
 * IDs/repository components: bounded ASCII identifiers. Branches: bounded ASCII
 * ref-name subset, no empty/dot/lock components or '..'. Origins: exact canonical
 * HTTPS origins <=256 chars. No branch/environment or origin-name inference.
 * Failure precedence follows execution/source, service, workload, repository,
 * branch, environment, preview, origin, nodeEnv. Rejections never echo inputs.
 * Results are frozen copies. VALIDATED is not authorization, binding matching or
 * provider attestation. Feed successful metadata/context into U02-I01 with a
 * separately approved binding registry. Never create that registry from this output.
 * Local/test/CI require synthetic identity and remain synthetic through U02-I01.
 */
export function validateDeploymentRuntimeMetadata(snapshot: unknown): RuntimeMetadataValidation;
