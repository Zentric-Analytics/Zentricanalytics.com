export type DeploymentEnvironment = "staging" | "production";
export type DeploymentWorkload = "web" | "cron";
export type IdentitySource = "render" | "synthetic";

interface IdentityFields {
  readonly serviceId: string;
  readonly identitySource: IdentitySource;
  readonly repository: string;
  readonly branch: string;
  readonly environment: DeploymentEnvironment;
}

export type ApprovedDeploymentBinding = IdentityFields & (
  | { readonly workloadType: "web"; readonly configuredOrigin: string }
  | { readonly workloadType: "cron"; readonly configuredOrigin?: never }
);

export type DeploymentMetadata = ApprovedDeploymentBinding & {
  readonly isPreview: boolean;
  /** Diagnostic only; never proves deployment identity. */
  readonly nodeEnv?: string;
};

export type DeploymentExecutionContext =
  | { readonly kind: "render"; readonly syntheticFixtures?: false }
  | { readonly kind: "local" | "test" | "ci"; readonly syntheticFixtures: true };

export type UnverifiedReasonCode =
  | "INVALID_CONTEXT" | "INVALID_BINDINGS" | "DUPLICATE_SERVICE_BINDING"
  | "INVALID_METADATA" | "PREVIEW_NOT_APPROVED" | "UNKNOWN_SERVICE"
  | "CONTEXT_MISMATCH" | "IDENTITY_SOURCE_MISMATCH" | "WORKLOAD_MISMATCH"
  | "REPOSITORY_MISMATCH" | "BRANCH_MISMATCH" | "ENVIRONMENT_MISMATCH" | "ORIGIN_MISMATCH";

export type DeploymentResolution =
  | Readonly<{ status: "UNVERIFIED"; reasonCode: UnverifiedReasonCode }>
  | Readonly<{
      status: "VERIFIED_STAGING";
      environment: "staging";
      workloadType: DeploymentWorkload;
      reasonCode: "BINDING_MATCH";
      verificationBasis: "CONFIGURATION_MATCH";
    }>
  | Readonly<{
      status: "VERIFIED_PRODUCTION";
      environment: "production";
      workloadType: DeploymentWorkload;
      reasonCode: "BINDING_MATCH";
      verificationBasis: "CONFIGURATION_MATCH";
    }>
  | Readonly<{
      status: "VERIFIED_STAGING";
      environment: "staging";
      workloadType: DeploymentWorkload;
      reasonCode: "SYNTHETIC_BINDING_MATCH";
      verificationBasis: "SYNTHETIC_FIXTURE";
    }>
  | Readonly<{
      status: "VERIFIED_PRODUCTION";
      environment: "production";
      workloadType: DeploymentWorkload;
      reasonCode: "SYNTHETIC_BINDING_MATCH";
      verificationBasis: "SYNTHETIC_FIXTURE";
    }>;

/**
 * Accepts untrusted data shapes and returns fixed, non-echoing failures.
 * Only ordinary data records are supported (not proxies or executable objects).
 * Callers supply provenance-checked server metadata and reviewed bindings.
 * CONFIGURATION_MATCH is not immutable provider attestation or authorization.
 * SYNTHETIC_FIXTURE must never be used to authorize live operations.
 * No environment reads, imports with side effects, or I/O are performed.
 */
export function resolveDeploymentEnvironment(
  metadata: unknown,
  approvedBindings: unknown,
  executionContext: unknown,
): DeploymentResolution;
