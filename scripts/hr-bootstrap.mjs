import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
const passwordHash = String(process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH ?? "").trim();
if (!email || !passwordHash || !bcrypt.getRounds(passwordHash)) throw new Error("Valid BOOTSTRAP_ADMIN_EMAIL and bcrypt BOOTSTRAP_ADMIN_PASSWORD_HASH are required.");

const permissions = [
  "user.create","user.read","user.update","user.suspend","user.invite","user.role.assign","user.role.revoke","employee.create","employee.read_all","employee.read_assigned","employee.read_self","employee.update","employee.update_self","department.manage","position.manage","assignment.create","assignment.update","assignment.end","assignment.override","supervisor.assign","supervisor.revoke","supervisor.read_team","supervisor.review_assigned","leave.request","leave.read_self","leave.read_all","leave.review_assigned","leave.approve","leave.override","leave.policy.manage","payroll.read","payroll.create","payroll.calculate","payroll.review","payroll.approve","payroll.mark_paid","payroll.export","payroll.read_salary","payroll.read_bank_details","document.upload","document.read_self","document.read_employee","document.read_sensitive","document.update","document.archive","asset.manage","asset.assign","asset.return","asset.read_self","workflow.create","workflow.assign","workflow.review","workflow.override","audit.read","settings.manage"
];
const permissionKeysByRole = {
  ADMIN: permissions,
  HR_ADMIN: permissions.filter((key) => !key.startsWith("payroll.") && !["user.role.assign", "user.role.revoke", "settings.manage"].includes(key)),
  PAYROLL_ADMIN: permissions.filter((key) => key.startsWith("payroll.") || key === "employee.read_all"),
  EMPLOYEE: ["employee.read_self", "employee.update_self", "leave.request", "leave.read_self", "document.read_self", "asset.read_self"],
};

await prisma.$transaction(async (tx) => {
  const organization = await tx.hrOrganization.upsert({ where: { slug: "zentric-analytics" }, update: {}, create: { slug: "zentric-analytics", name: "ZENTRIC ANALYTICS LIMITED", registrationNumber: "9598907", taxIdentificationNumber: "2623015127480", defaultCurrency: "NGN" } });
  const roles = {};
  for (const key of ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "EMPLOYEE"]) roles[key] = await tx.hrRole.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key, name: key.replaceAll("_", " ") } });
  const permissionRecords = {};
  for (const key of permissions) {
    const permission = await tx.hrPermission.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key } });
    permissionRecords[key] = permission;
  }
  for (const [roleKey, keys] of Object.entries(permissionKeysByRole)) {
    for (const key of keys) {
      const permission = permissionRecords[key];
      await tx.hrRolePermission.upsert({ where: { roleId_permissionId: { roleId: roles[roleKey].id, permissionId: permission.id } }, update: {}, create: { roleId: roles[roleKey].id, permissionId: permission.id } });
    }
  }
  const user = await tx.hrUser.upsert({ where: { organizationId_email: { organizationId: organization.id, email } }, update: {}, create: { organizationId: organization.id, email, passwordHash, status: "ACTIVE", emailVerifiedAt: new Date() } });
  await tx.hrUserRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: roles.ADMIN.id } }, update: { revokedAt: null }, create: { userId: user.id, roleId: roles.ADMIN.id } });
  for (const [key, value] of Object.entries({ payrollSchedule: "Monthly", payrollPaymentDay: 29, annualLeaveEntitlementDays: 30, pensionDeductionEnabled: false, attendanceDeductionEnabled: false, salaryAllowancesEnabled: false, defaultReportingManager: "Olayinka Ogunlade", contactEmail: "support@zentricanalytics.com", contactPhone: "+2347044569254", address: "C2 Legacy Bus-stop, Jankata Road, Apata, Ibadan" })) {
    await tx.hrOrganizationSetting.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: {}, create: { organizationId: organization.id, key, value } });
  }
  await tx.hrAuditEvent.create({ data: { organizationId: organization.id, actorUserId: user.id, actorRole: "ADMIN", entityType: "HrUser", entityId: user.id, action: "hr.bootstrap.completed", correlationId: `bootstrap:${organization.id}` } });
});
await prisma.$disconnect();
console.info("HRMS bootstrap completed without exposing credentials.");
