import bcrypt from "bcryptjs";

export const HR_PERMISSION_KEYS = [
  "user.create","user.read","user.update","user.suspend","user.invite","user.role.assign","user.role.revoke","employee.create","employee.read_all","employee.read_assigned","employee.read_self","employee.update","employee.update_self","department.manage","position.manage","assignment.create","assignment.update","assignment.end","assignment.override","organization.structure.manage","organization.structure.import","organization.position.create","organization.position.approve","organization.position.manage_state","organization.position.fill","organization.assignment.transfer","organization.report.read","organization.report.export","supervisor.assign","supervisor.revoke","supervisor.read_team","supervisor.review_assigned","leave.request","leave.read_self","leave.read_all","leave.review_assigned","leave.approve","leave.override","leave.policy.manage","time.capture_self","time.read_self","time.read_team","time.read_all","time.schedule.manage","time.policy.manage","time.correction.request","time.correction.review","time.timesheet.submit","time.timesheet.approve","time.period.lock","time.authoritative.read","time.authoritative.export","performance.goal.read_self","performance.goal.manage_self","performance.goal.read_team","performance.goal.review_team","performance.goal.read_all","performance.goal.admin","performance.feedback.create","performance.feedback.read_self","performance.feedback.read_team","performance.feedback.read_confidential","performance.checkin.manage_self","performance.checkin.manage_team","performance.review.submit_self","performance.review.read_self","performance.review.manage_team","performance.review.read_all","performance.review.admin","performance.calibration.participate","performance.calibration.admin","performance.career.manage_self","performance.career.read_team","performance.development.manage_self","performance.development.manage_team","performance.development.admin","performance.readiness.read_self","performance.readiness.assess","performance.promotion.recommend","performance.promotion.review","performance.promotion.approve","performance.framework.manage","performance.report.read","performance.report.export","performance.audit.read","compensation.read_self","compensation.read_team","compensation.read_scoped","compensation.architecture.manage","compensation.cycle.manage","compensation.budget.manage","compensation.budget.read","compensation.budget.approve","compensation.recommendation.create","compensation.recommendation.review","compensation.calibration.manage","compensation.exception.approve","compensation.decision.approve","compensation.reward.manage","compensation.statement.read","compensation.report.read","compensation.payroll_handoff.read","compensation.audit.read","payroll.read","payroll.create","payroll.certify","payroll.freeze","payroll.calculate","payroll.review","payroll.approve","payroll.finalize","payroll.mark_paid","payroll.export","payroll.read_salary","payroll.read_bank_details","payroll.rules.manage","payroll.rules.certify","payroll.regulatory_watch.manage","payroll.payment.prepare","payroll.payment.approve","payroll.payment.submit","payroll.payment.reconcile","payroll.accounting.read","payroll.accounting.export","payroll.statutory.read","payroll.statutory.prepare","payroll.statutory.submit","payroll.audit.read","payroll.exception.read","payroll.exception.manage","payroll.exception.resolve","payroll.population_partition.approve","payroll.roles.assign","document.upload","document.read_self","document.read_employee","document.read_sensitive","document.update","document.archive","asset.manage","asset.assign","asset.return","asset.read_self","workflow.create","workflow.assign","workflow.review","workflow.task.complete","workflow.override","report.read","report.export","audit.read","settings.manage"
];
export const HR_ROLE_KEYS = ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "PAYROLL_PROCESSOR", "PAYROLL_APPROVER", "PAYROLL_COMPLIANCE_ADMIN", "PAYMENT_OPERATOR", "PAYMENT_APPROVER", "FINANCE_READER", "PAYROLL_AUDITOR", "STATUTORY_COMPLIANCE_OPERATOR", "COMPENSATION_ADMIN", "BUDGET_OWNER", "PAYROLL_READER", "EMPLOYEE", "AUDITOR"];
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

export const permissionKeysByRole = {
  ADMIN: HR_PERMISSION_KEYS.filter((key) => !key.startsWith("compensation.") && !key.startsWith("payroll.")),
  HR_ADMIN: HR_PERMISSION_KEYS.filter((key) => !key.startsWith("payroll.") && !key.startsWith("compensation.") && !["user.role.assign", "user.role.revoke", "settings.manage"].includes(key)),
  COMPENSATION_ADMIN: HR_PERMISSION_KEYS.filter((key) => key.startsWith("compensation.")),
  BUDGET_OWNER: ["compensation.budget.read", "compensation.budget.manage", "compensation.recommendation.review", "compensation.decision.approve", "compensation.report.read"],
  PAYROLL_READER: ["compensation.payroll_handoff.read"],
  PAYROLL_ADMIN: HR_PERMISSION_KEYS.filter((key) => key.startsWith("payroll.") || ["employee.read_all", "workflow.task.complete", "report.read", "report.export", "time.authoritative.read", "time.authoritative.export"].includes(key)),
  PAYROLL_PROCESSOR: ["payroll.read", "payroll.create", "payroll.certify", "payroll.freeze", "payroll.calculate", "payroll.review", "payroll.read_salary", "time.authoritative.read", "compensation.payroll_handoff.read"],
  PAYROLL_APPROVER: ["payroll.read", "payroll.review", "payroll.approve", "payroll.finalize", "payroll.read_salary"],
  PAYROLL_COMPLIANCE_ADMIN: ["payroll.read", "payroll.rules.manage", "payroll.rules.certify", "payroll.regulatory_watch.manage", "payroll.statutory.read", "payroll.audit.read", "payroll.exception.read", "payroll.exception.manage", "payroll.exception.resolve"],
  PAYMENT_OPERATOR: ["payroll.read", "payroll.payment.prepare", "payroll.payment.submit", "payroll.payment.reconcile", "payroll.read_bank_details", "payroll.export"],
  PAYMENT_APPROVER: ["payroll.read", "payroll.payment.approve", "payroll.read_bank_details"],
  FINANCE_READER: ["payroll.read", "payroll.accounting.read", "payroll.statutory.read"],
  PAYROLL_AUDITOR: ["payroll.read", "payroll.audit.read", "payroll.accounting.read", "payroll.statutory.read", "audit.read"],
  STATUTORY_COMPLIANCE_OPERATOR: ["payroll.read", "payroll.statutory.read", "payroll.statutory.prepare", "payroll.statutory.submit", "payroll.payment.reconcile"],
  EMPLOYEE: ["employee.read_self", "employee.update_self", "leave.request", "leave.read_self", "time.capture_self", "time.read_self", "time.correction.request", "time.timesheet.submit", "performance.goal.read_self", "performance.goal.manage_self", "performance.feedback.create", "performance.feedback.read_self", "performance.checkin.manage_self", "performance.review.submit_self", "performance.review.read_self", "performance.career.manage_self", "performance.development.manage_self", "performance.readiness.read_self", "compensation.read_self", "compensation.statement.read", "document.read_self", "asset.read_self", "workflow.task.complete"],
  AUDITOR: ["audit.read", "report.read", "performance.audit.read", "compensation.audit.read"],
};

export async function reconcileHrRolePermissions(prisma, report = () => undefined) {
  const startedAt = Date.now();
  const organizations = await prisma.hrOrganization.findMany({ select: { id: true } });
  const organizationDurationsMs = [];
  let removed = 0;
  let rolesCreated = 0;
  for (const { id: organizationId } of organizations) {
    const organizationStartedAt = Date.now();
    await prisma.$transaction(async (tx) => {
      const createdRoles = await tx.hrRole.createMany({
        data: HR_ROLE_KEYS.map((key) => ({ organizationId, key, name: key.replaceAll("_", " ") })),
        skipDuplicates: true,
      });
      rolesCreated += createdRoles.count;
      await tx.hrPermission.createMany({
        data: HR_PERMISSION_KEYS.map((key) => ({ organizationId, key })),
        skipDuplicates: true,
      });

      const [roles, permissions] = await Promise.all([
        tx.hrRole.findMany({ where: { organizationId, key: { in: HR_ROLE_KEYS } }, select: { id: true, key: true } }),
        tx.hrPermission.findMany({ where: { organizationId, key: { in: HR_PERMISSION_KEYS } }, select: { id: true, key: true } }),
      ]);
      const roleByKey = new Map(roles.map((role) => [role.key, role]));
      const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));
      const missingRoles = HR_ROLE_KEYS.filter((key) => !roleByKey.has(key));
      const missingPermissions = HR_PERMISSION_KEYS.filter((key) => !permissionByKey.has(key));
      if (missingRoles.length || missingPermissions.length) {
        throw new Error(`Canonical role-permission reconciliation failed closed: missingRoles=${missingRoles.join(",") || "none"}; missingPermissions=${missingPermissions.join(",") || "none"}.`);
      }

      const desiredPairs = Object.entries(permissionKeysByRole).flatMap(([roleKey, permissionKeys]) => {
        const role = roleByKey.get(roleKey);
        if (!role) throw new Error(`Canonical role-permission reconciliation failed closed: unresolved role ${roleKey}.`);
        return permissionKeys.map((permissionKey) => {
          const permission = permissionByKey.get(permissionKey);
          if (!permission) throw new Error(`Canonical role-permission reconciliation failed closed: unresolved permission ${permissionKey}.`);
          return { roleId: role.id, permissionId: permission.id };
        });
      });
      const desiredPairKeys = new Set(desiredPairs.map(({ roleId, permissionId }) => `${roleId}:${permissionId}`));
      await tx.hrRolePermission.createMany({ data: desiredPairs, skipDuplicates: true });

      const existingPairs = await tx.hrRolePermission.findMany({
        where: { roleId: { in: roles.map(({ id }) => id) } },
        include: { permission: { select: { key: true } } },
      });
      const stalePairs = existingPairs.filter(({ roleId, permissionId }) => !desiredPairKeys.has(`${roleId}:${permissionId}`));
      if (!stalePairs.length) return;
      const deleted = await tx.hrRolePermission.deleteMany({ where: { id: { in: stalePairs.map(({ id }) => id) } } });
      removed += deleted.count;

      const staleByRole = new Map();
      for (const pair of stalePairs) {
        const keys = staleByRole.get(pair.roleId) ?? [];
        keys.push(pair.permission.key);
        staleByRole.set(pair.roleId, keys);
      }
      const roleKeyById = new Map(roles.map((role) => [role.id, role.key]));
      const auditTimestamp = Date.now();
      await tx.hrAuditEvent.createMany({ data: [...staleByRole.entries()].map(([roleId, removedPermissionKeys]) => ({
        organizationId,
        actorRole: "SYSTEM",
        entityType: "HrRole",
        entityId: roleId,
        action: "hr.role.permissions.reconciled",
        previousValues: { removedPermissionKeys },
        newValues: { allowedPermissionKeys: permissionKeysByRole[roleKeyById.get(roleId)] ?? [] },
        reason: "Canonical built-in role permission reconciliation during guarded release.",
        correlationId: `role-permissions:${roleId}:${auditTimestamp}`,
      })) });
    }, { timeout: 15_000 });
    organizationDurationsMs.push(Date.now() - organizationStartedAt);
  }
  const elapsedMs = Date.now() - startedAt;
  const maxOrganizationTransactionMs = Math.max(0, ...organizationDurationsMs);
  report(`PASS canonical built-in role permissions reconciled; rolesCreated=${rolesCreated}; staleGrantsRemoved=${removed}; elapsedMs=${elapsedMs}; maxOrganizationTransactionMs=${maxOrganizationTransactionMs}.`);
  return { organizations: organizations.length, rolesCreated, removed, elapsedMs, maxOrganizationTransactionMs };
}

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
    const user = await tx.hrUser.create({ data: { organizationId: organization.id, email: config.email, passwordHash: config.passwordHash, status: "ACTIVE", emailVerifiedAt: new Date(), isPrimaryAdmin: true } });
    await tx.hrUserRole.create({ data: { userId: user.id, roleId: roles.ADMIN.id } });
    for (const [key, value] of Object.entries({ payrollSchedule: "Monthly", payrollPaymentDay: 29, annualLeaveEntitlementDays: 30, pensionDeductionEnabled: false, attendanceDeductionEnabled: false, salaryAllowancesEnabled: false, defaultReportingManager: "Olayinka Ogunlade", contactEmail: "support@zentricanalytics.com", contactPhone: "+2347044569254", address: "C2 Legacy Bus-stop, Jankata Road, Apata, Ibadan" })) await tx.hrOrganizationSetting.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key, value } });
    await tx.hrAuditEvent.create({ data: { organizationId: organization.id, actorUserId: user.id, actorRole: "ADMIN", entityType: "HrUser", entityId: user.id, action: "hr.bootstrap.completed", correlationId: `bootstrap:${organization.id}` } });
  });
  report("HRMS bootstrap result: created. Initial ADMIN is active and bootstrap was audited; credentials were not displayed.");
  return { status: "created", environment: config.appEnv };
}
