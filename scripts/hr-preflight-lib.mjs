import { HR_PERMISSION_KEYS, HR_ROLE_KEYS } from "./hr-bootstrap-lib.mjs";

function environmentChecks(env) {
  const appEnv = String(env.APP_ENV ?? "").trim().toLowerCase();
  const issues = [];
  if (!env.DATABASE_URL) issues.push("DATABASE_URL is not configured.");
  if (!["development", "test", "staging", "production"].includes(appEnv)) issues.push("APP_ENV is missing or invalid.");
  if (String(env.AUTH_SECRET ?? "").length < 32) issues.push("AUTH_SECRET must contain at least 32 characters.");
  const baseUrl = String(env.APPLICATION_BASE_URL ?? "");
  try {
    const parsed = new URL(baseUrl);
    if (appEnv === "staging" && !parsed.hostname.toLowerCase().includes("staging")) issues.push("APPLICATION_BASE_URL does not look like a staging URL.");
    if (appEnv === "production" && (parsed.protocol !== "https:" || parsed.hostname.toLowerCase().includes("staging"))) issues.push("APPLICATION_BASE_URL is unsafe for production.");
  } catch { issues.push("APPLICATION_BASE_URL is missing or invalid."); }
  if (appEnv === "production" && (env.OBJECT_STORAGE_PROVIDER ?? "local") === "local") issues.push("Production HR document storage cannot use the local provider.");
  if (!env.EMAIL_WORKER_SECRET) issues.push("EMAIL_WORKER_SECRET is not configured.");
  return { appEnv, issues, emailMode: env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY ? "provider configured" : "delivery intentionally disabled or console-only", workerMode: env.EMAIL_WORKER_SECRET ? "configured" : "missing" };
}

export async function runHrPreflight(prisma, env, report = () => undefined) {
  const configuration = environmentChecks(env);
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
    const [roleCount, permissionCount, activeAdmin] = await Promise.all([
      prisma.hrRole.count({ where: { organizationId: organization.id, key: { in: HR_ROLE_KEYS } } }),
      prisma.hrPermission.count({ where: { organizationId: organization.id, key: { in: HR_PERMISSION_KEYS } } }),
      prisma.hrUserRole.findFirst({ where: { revokedAt: null, role: { organizationId: organization.id, key: "ADMIN" }, user: { status: "ACTIVE" } }, select: { id: true } }),
    ]);
    if (roleCount !== HR_ROLE_KEYS.length) issues.push("HRMS role initialization is incomplete.");
    if (permissionCount !== HR_PERMISSION_KEYS.length) issues.push("HRMS permission initialization is incomplete.");
    if (!activeAdmin) issues.push("HRMS is not initialized: no active ADMIN account exists. Run the documented one-time bootstrap procedure.");
  }
  report(`INFO email delivery: ${configuration.emailMode}`);
  report(`INFO outbox worker: ${configuration.workerMode}`);
  for (const issue of issues) report(`BLOCKED ${issue}`);
  if (!issues.length) report("HRMS preflight result: ready.");
  else report(`HRMS preflight result: not ready (${issues.length} blocking issue${issues.length === 1 ? "" : "s"}).`);
  return { ready: issues.length === 0, issues };
}
