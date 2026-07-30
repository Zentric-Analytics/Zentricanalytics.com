import bcrypt from "bcryptjs";

export const HR_PERMISSION_KEYS = [
  "user.create","user.read","user.update","user.suspend","user.invite","user.role.assign","user.role.revoke","employee.create","employee.read_all","employee.read_assigned","employee.read_self","employee.update","employee.update_self","department.manage","position.manage","assignment.create","assignment.update","assignment.end","assignment.override","supervisor.assign","supervisor.revoke","supervisor.read_team","supervisor.review_assigned","leave.request","leave.read_self","leave.read_all","leave.review_assigned","leave.approve","leave.override","leave.policy.manage","payroll.read","payroll.create","payroll.calculate","payroll.review","payroll.approve","payroll.mark_paid","payroll.export","payroll.read_salary","payroll.read_bank_details","document.upload","document.read_self","document.read_employee","document.read_sensitive","document.update","document.archive","asset.manage","asset.assign","asset.return","asset.read_self","workflow.create","workflow.assign","workflow.review","workflow.task.complete","workflow.override","audit.read","settings.manage"
];
export const HR_ROLE_KEYS = ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "EMPLOYEE"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedEnvironments = new Set(["development", "test", "staging", "production"]);

export function validateBootstrapEnvironment(env) {
  const appEnv = String(env.APP_ENV ?? "").trim().toLowerCase();
  if (!appEnv || !allowedEnvironments.has(appEnv)) throw new Error("configuration invalid: APP_ENV must be development, test, staging, or production.");
  if (!env.DATABASE_URL) throw new Error("configuration invalid: DATABASE_URL is required.");
  if (!["development", "test"].includes(appEnv) && String(env.HR_BOOTSTRAP_CONFIRM_ENV ?? "").trim().toLowerCase() !== appEnv) {
    throw new Error(`wrong environment: HR_BOOTSTRAP_CONFIRM_ENV must exactly match APP_ENV (${appEnv}).`);
  }
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) throw new Error("configuration invalid: BOOTSTRAP_ADMIN_EMAIL is required.");
  if (!EMAIL_PATTERN.test(email)) throw new Error("configuration invalid: BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  const passwordHash = String(env.BOOTSTRAP_ADMIN_PASSWORD_HASH ?? "").trim();
  if (!passwordHash) throw new Error("configuration invalid: BOOTSTRAP_ADMIN_PASSWORD_HASH is required; plaintext passwords are refused.");
  if (!passwordHash.startsWith("$2")) throw new Error("configuration invalid: BOOTSTRAP_ADMIN_PASSWORD_HASH must be a bcrypt hash, not plaintext.");
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) throw new Error("configuration invalid: BOOTSTRAP_ADMIN_PASSWORD_HASH must be a valid bcrypt hash with at least 12 rounds.");
  try { if (bcrypt.getRounds(passwordHash) < 12) throw new Error(); } catch { throw new Error("configuration invalid: BOOTSTRAP_ADMIN_PASSWORD_HASH must be a valid bcrypt hash with at least 12 rounds."); }
  return { appEnv, email, passwordHash };
}

const permissionKeysByRole = {
  ADMIN: HR_PERMISSION_KEYS,
  HR_ADMIN: HR_PERMISSION_KEYS.filter((key) => !key.startsWith("payroll.") && !["user.role.assign", "user.role.revoke", "settings.manage"].includes(key)),
  PAYROLL_ADMIN: HR_PERMISSION_KEYS.filter((key) => key.startsWith("payroll.") || ["employee.read_all", "workflow.task.complete"].includes(key)),
  EMPLOYEE: ["employee.read_self", "employee.update_self", "leave.request", "leave.read_self", "document.read_self", "asset.read_self", "workflow.task.complete"],
};

export async function runHrBootstrap(prisma, env, report = () => undefined) {
  const config = validateBootstrapEnvironment(env);
  report(`HRMS bootstrap target environment: ${config.appEnv}. Database location is intentionally hidden.`);

  const existingAdmin = await prisma.hrUserRole.findFirst({ where: { revokedAt: null, role: { key: "ADMIN" } }, include: { user: true, role: { include: { organization: true } } } });
  if (existingAdmin) {
    report("HRMS bootstrap result: already initialized. An ADMIN assignment already exists; no data was changed.");
    return { status: "already_initialized", environment: config.appEnv };
  }
  const existingOrganization = await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" } });
  if (existingOrganization) {
    const conflictingUser = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId: existingOrganization.id, email: config.email } } });
    if (conflictingUser) throw new Error("conflicting existing account: the configured email exists without ADMIN bootstrap authority; no data was changed.");
  }

  await prisma.$transaction(async (tx) => {
    const organization = await tx.hrOrganization.upsert({ where: { slug: "zentric-analytics" }, update: {}, create: { slug: "zentric-analytics", name: "ZENTRIC ANALYTICS LIMITED", registrationNumber: "9598907", taxIdentificationNumber: "2623015127480", defaultCurrency: "NGN" } });
    const roles = {};
    for (const key of HR_ROLE_KEYS) roles[key] = await tx.hrRole.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key, name: key.replaceAll("_", " ") } });
    const permissionRecords = {};
    for (const key of HR_PERMISSION_KEYS) permissionRecords[key] = await tx.hrPermission.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key } });
    for (const [roleKey, keys] of Object.entries(permissionKeysByRole)) for (const key of keys) await tx.hrRolePermission.upsert({ where: { roleId_permissionId: { roleId: roles[roleKey].id, permissionId: permissionRecords[key].id } }, update: {}, create: { roleId: roles[roleKey].id, permissionId: permissionRecords[key].id } });
    const user = await tx.hrUser.create({ data: { organizationId: organization.id, email: config.email, passwordHash: config.passwordHash, status: "ACTIVE", emailVerifiedAt: new Date() } });
    await tx.hrUserRole.create({ data: { userId: user.id, roleId: roles.ADMIN.id } });
    for (const [key, value] of Object.entries({ payrollSchedule: "Monthly", payrollPaymentDay: 29, annualLeaveEntitlementDays: 30, pensionDeductionEnabled: false, attendanceDeductionEnabled: false, salaryAllowancesEnabled: false, defaultReportingManager: "Olayinka Ogunlade", contactEmail: "support@zentricanalytics.com", contactPhone: "+2347044569254", address: "C2 Legacy Bus-stop, Jankata Road, Apata, Ibadan" })) await tx.hrOrganizationSetting.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key, value } });
    await tx.hrAuditEvent.create({ data: { organizationId: organization.id, actorUserId: user.id, actorRole: "ADMIN", entityType: "HrUser", entityId: user.id, action: "hr.bootstrap.completed", correlationId: `bootstrap:${organization.id}` } });
  });
  report("HRMS bootstrap result: created. Initial ADMIN is active and bootstrap was audited; credentials were not displayed.");
  return { status: "created", environment: config.appEnv };
}
