import { HR_PERMISSION_KEYS, HR_ROLE_KEYS } from "./hr-bootstrap-lib.mjs";
import { productionBackupPolicyIssues } from "./hr-backup-policy.mjs";

export function hrEnvironmentChecks(env) {
  const appEnv = String(env.APP_ENV ?? "").trim().toLowerCase();
  const issues = [];
  const protectedEnvironment = ["staging", "production"].includes(appEnv);
  const storageProvider = String(env.OBJECT_STORAGE_PROVIDER ?? "local-private").trim().toLowerCase();
  if (!env.DATABASE_URL) issues.push("DATABASE_URL is not configured.");
  if (!["development", "test", "staging", "production"].includes(appEnv)) issues.push("APP_ENV is missing or invalid.");
  if (String(env.AUTH_SECRET ?? "").length < 32) issues.push("AUTH_SECRET must contain at least 32 characters.");
  const baseUrl = String(env.APPLICATION_BASE_URL ?? "");
  try {
    const parsed = new URL(baseUrl);
    if (appEnv === "staging" && !parsed.hostname.toLowerCase().includes("staging")) issues.push("APPLICATION_BASE_URL does not look like a staging URL.");
    if (appEnv === "production" && (parsed.protocol !== "https:" || parsed.hostname.toLowerCase().includes("staging"))) issues.push("APPLICATION_BASE_URL is unsafe for production.");
  } catch { issues.push("APPLICATION_BASE_URL is missing or invalid."); }
  if (!["local", "local-private", "s3-compatible", "aws-s3"].includes(storageProvider)) issues.push("OBJECT_STORAGE_PROVIDER must be local-private, s3-compatible, or aws-s3.");
  if (protectedEnvironment && !["s3-compatible", "aws-s3"].includes(storageProvider)) issues.push("Staging and production HR document storage must use the s3-compatible provider or AWS S3 provider.");
  if (["s3-compatible", "aws-s3"].includes(storageProvider)) {
    const required = storageProvider === "aws-s3" ? ["OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_REGION"] : ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY"];
    for (const key of required) {
      if (!String(env[key] ?? "").trim()) issues.push(`${key} is required for S3-compatible HR storage.`);
    }
    if (storageProvider === "aws-s3" && env.MALWARE_SCANNER_PROVIDER !== "aws-guardduty-s3") issues.push("AWS S3 HR storage requires MALWARE_SCANNER_PROVIDER=aws-guardduty-s3.");
    if (storageProvider === "aws-s3" && !String(env.AWS_ACCOUNT_ID ?? "").trim()) issues.push("AWS_ACCOUNT_ID is required to authenticate GuardDuty scan events.");
    const endpoint = String(env.OBJECT_STORAGE_ENDPOINT ?? "");
    if (endpoint) {
      try {
        const parsed = new URL(endpoint);
        const localHttp = ["development", "test"].includes(appEnv) && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        if (parsed.protocol !== "https:" && !localHttp) issues.push("OBJECT_STORAGE_ENDPOINT must use HTTPS except for local development or tests.");
        if (parsed.username || parsed.password || parsed.search || parsed.hash) issues.push("OBJECT_STORAGE_ENDPOINT must not contain credentials, query parameters, or fragments.");
      } catch {
        issues.push("OBJECT_STORAGE_ENDPOINT is invalid.");
      }
    }
    const bucket = String(env.OBJECT_STORAGE_BUCKET ?? "");
    if (bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) issues.push("OBJECT_STORAGE_BUCKET is invalid.");
    const forcePathStyle = String(env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "false").toLowerCase();
    if (!["true", "false"].includes(forcePathStyle)) issues.push("OBJECT_STORAGE_FORCE_PATH_STYLE must be true or false.");
  }
  for (const key of ["EMAIL_WORKER_SECRET", "DOCUMENT_SCANNER_SECRET", "MONITORING_SECRET"]) {
    const value = String(env[key] ?? "");
    if (protectedEnvironment && !value) issues.push(`${key} is not configured.`);
    if (value && value.length < 64) issues.push(`${key} must contain at least 64 characters (for example, 32 random bytes encoded as hexadecimal).`);
  }
  if (appEnv === "production") {
    if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY) issues.push("Production email delivery must use the configured Resend provider.");
    issues.push(...productionBackupPolicyIssues(env));
  }
  return { appEnv, issues, emailMode: env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY ? "provider configured" : "delivery intentionally disabled or console-only", workerMode: env.EMAIL_WORKER_SECRET ? "configured" : "missing" };
}

export async function runHrPreflight(prisma, env, report = () => undefined, options = {}) {
  const configuration = hrEnvironmentChecks(env);
  const issues = [...configuration.issues];
  report(`HRMS preflight target environment: ${configuration.appEnv || "unknown"}. Database location and secrets are hidden.`);
  let organization = null;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    report("PASS database connectivity");
    organization = await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" } });
    report("PASS HR migration tables are queryable");
    await prisma.hrDepartment.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Core HR migration tables are queryable");
    await prisma.hrLeaveType.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Leave Management migration tables are queryable");
    await prisma.hrPayrollRun.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Payroll migration tables are queryable");
    await prisma.hrEmployeeDocument.count({ where: organization ? { organizationId: organization.id } : undefined });
    await prisma.hrAsset.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Documents and Assets migration tables are queryable");
    await prisma.hrLifecycleTemplate.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Onboarding and Offboarding migration tables are queryable");
    await prisma.hrWorkflowDefinition.count({ where: organization ? { organizationId: organization.id } : undefined });
    report("PASS Workflow Engine migration tables are queryable");
  } catch {
    issues.push("Database connectivity or HR migration check failed. Apply migrations before bootstrap.");
  }
  if (!organization) issues.push("HRMS organization is not initialized.");
  if (organization) {
    const [roleCount, permissionCount, activeAdmin, privilegedWithoutMfa, workforceApprovalDefinition] = await Promise.all([
      prisma.hrRole.count({ where: { organizationId: organization.id, key: { in: HR_ROLE_KEYS } } }),
      prisma.hrPermission.count({ where: { organizationId: organization.id, key: { in: HR_PERMISSION_KEYS } } }),
      prisma.hrUserRole.findFirst({ where: { revokedAt: null, role: { organizationId: organization.id, key: "ADMIN" }, user: { status: "ACTIVE" } }, select: { id: true } }),
      prisma.hrUser.count({ where: { organizationId: organization.id, status: "ACTIVE", mfaEnabled: false, roles: { some: { revokedAt: null, role: { key: { in: ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"] } } } } } }),
      configuration.appEnv === "production"
        ? prisma.hrWorkflowDefinition.findFirst({ where: { organizationId: organization.id, subjectType: "HrWorkforceEvent", active: true }, select: { id: true } })
        : Promise.resolve({ id: "not-required-outside-production" }),
    ]);
    if (roleCount !== HR_ROLE_KEYS.length) issues.push("HRMS role initialization is incomplete.");
    if (permissionCount !== HR_PERMISSION_KEYS.length) issues.push("HRMS permission initialization is incomplete.");
    if (!activeAdmin) issues.push("HRMS is not initialized: no active ADMIN account exists. Run the documented one-time bootstrap procedure.");
    if (configuration.appEnv === "production" && !workforceApprovalDefinition) issues.push("No active production HrWorkforceEvent approval workflow definition exists.");
    if (["staging", "production"].includes(configuration.appEnv) && privilegedWithoutMfa && !options.allowInitialMfaEnrollment) issues.push(`${privilegedWithoutMfa} active privileged account(s) do not have MFA enabled.`);
    if (privilegedWithoutMfa && options.allowInitialMfaEnrollment) report(`INITIALIZATION ONLY ${privilegedWithoutMfa} privileged account(s) must enroll MFA before the next release.`);
  }
  report(`INFO email delivery: ${configuration.emailMode}`);
  report(`INFO outbox worker: ${configuration.workerMode}`);
  for (const issue of issues) report(`BLOCKED ${issue}`);
  if (!issues.length) report("HRMS preflight result: ready.");
  else report(`HRMS preflight result: not ready (${issues.length} blocking issue${issues.length === 1 ? "" : "s"}).`);
  return { ready: issues.length === 0, issues };
}
