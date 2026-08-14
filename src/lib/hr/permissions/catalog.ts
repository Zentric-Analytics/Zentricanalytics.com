import type { HrRoleKey } from "@prisma/client";

export const HR_PERMISSIONS = [
  "user.create", "user.read", "user.update", "user.suspend", "user.invite", "user.role.assign", "user.role.revoke",
  "employee.create", "employee.read_all", "employee.read_assigned", "employee.read_self", "employee.update", "employee.update_self",
  "employee.profile_change.request", "employee.profile_change.review", "workforce_event.create", "workforce_event.review", "workforce_event.apply", "workforce_event.read_self", "workforce_event.read_team",
  "department.manage", "position.manage", "assignment.create", "assignment.update", "assignment.end", "assignment.override",
  "organization.structure.manage", "organization.structure.import", "organization.position.create", "organization.position.approve",
  "organization.position.manage_state", "organization.position.fill", "organization.assignment.transfer",
  "organization.report.read", "organization.report.export",
  "supervisor.assign", "supervisor.revoke", "supervisor.read_team", "supervisor.review_assigned",
  "leave.request", "leave.read_self", "leave.read_all", "leave.review_assigned", "leave.approve", "leave.override", "leave.policy.manage",
  "time.capture_self", "time.read_self", "time.read_team", "time.read_all", "time.schedule.manage", "time.policy.manage", "time.correction.request", "time.correction.review", "time.timesheet.submit", "time.timesheet.approve", "time.period.lock", "time.authoritative.read", "time.authoritative.export",
  "performance.goal.read_self", "performance.goal.manage_self", "performance.goal.read_team", "performance.goal.review_team", "performance.goal.read_all", "performance.goal.admin",
  "performance.feedback.create", "performance.feedback.read_self", "performance.feedback.read_team", "performance.feedback.read_confidential",
  "performance.checkin.manage_self", "performance.checkin.manage_team",
  "performance.review.submit_self", "performance.review.read_self", "performance.review.manage_team", "performance.review.read_all", "performance.review.admin",
  "performance.calibration.participate", "performance.calibration.admin",
  "performance.career.manage_self", "performance.career.read_team", "performance.development.manage_self", "performance.development.manage_team", "performance.development.admin",
  "performance.readiness.read_self", "performance.readiness.assess", "performance.promotion.recommend", "performance.promotion.review", "performance.promotion.approve",
  "performance.framework.manage", "performance.report.read", "performance.report.export", "performance.audit.read",
  "compensation.architecture.manage", "compensation.cycle.manage", "compensation.budget.manage", "compensation.budget.read", "compensation.recommendation.create", "compensation.recommendation.review", "compensation.calibration.manage", "compensation.exception.review", "compensation.decision.approve", "compensation.read_all", "compensation.read_self", "compensation.statement.read", "compensation.payroll_handoff.read", "compensation.audit.read", "compensation.bonus.manage", "compensation.retroactive.manage", "compensation.report.read",
  "payroll.read", "payroll.create", "payroll.certify", "payroll.freeze", "payroll.calculate", "payroll.review", "payroll.approve", "payroll.finalize", "payroll.mark_paid", "payroll.export", "payroll.read_salary", "payroll.read_bank_details",
  "payroll.rules.manage", "payroll.rules.certify", "payroll.regulatory_watch.manage", "payroll.payment.prepare", "payroll.payment.approve", "payroll.payment.submit", "payroll.payment.reconcile",
  "payroll.accounting.read", "payroll.accounting.export", "payroll.statutory.read", "payroll.statutory.prepare", "payroll.statutory.submit", "payroll.audit.read",
  "document.upload", "document.read_self", "document.read_employee", "document.read_sensitive", "document.update", "document.archive",
  "asset.manage", "asset.assign", "asset.return", "asset.read_self", "workflow.create", "workflow.assign", "workflow.review", "workflow.task.complete", "workflow.override",
  "hiring_team.manage", "hiring_team.create", "hiring_team.view", "hiring_team.update", "hiring_team.manage_members", "hiring_team.manage_permissions", "hiring_team.deactivate",
  "vacancy.create", "vacancy.view", "vacancy.edit", "vacancy.submit", "vacancy.approve", "vacancy.publish", "vacancy.pause", "vacancy.close", "vacancy.cancel", "vacancy.fill", "vacancy.reassign",
  "application.view", "application.review", "application.request_information", "application.shortlist", "application.reject", "application.hold",
  "interview.schedule", "interview.reschedule", "interview.cancel", "interview.feedback.submit", "interview.feedback.view",
  "assessment.create", "assessment.evaluate",
  "offer.create", "offer.edit", "offer.submit", "offer.approve", "offer.issue", "offer.cancel",
  "handover.view", "handover.review", "handover.request_information", "handover.return", "handover.approve", "handover.cancel",
  "document.verify", "document.reject", "document.request_replacement",
  "employee.prehire.create", "employee.activate", "onboarding.view", "onboarding.manage", "onboarding.complete_task", "onboarding.override", "recruitment.admin",
  "report.read", "report.export", "audit.read", "settings.manage",
] as const;

export type HrPermissionKey = (typeof HR_PERMISSIONS)[number];

export const HR_ASSIGNABLE_ROLES = [
  "ADMIN",
  "HR_ADMIN",
  "PAYROLL_ADMIN",
  "PAYROLL_PROCESSOR",
  "PAYROLL_APPROVER",
  "PAYROLL_COMPLIANCE_ADMIN",
  "PAYMENT_OPERATOR",
  "PAYMENT_APPROVER",
  "FINANCE_READER",
  "PAYROLL_AUDITOR",
  "STATUTORY_COMPLIANCE_OPERATOR",
  "COMPENSATION_ADMIN",
  "BUDGET_OWNER",
  "PAYROLL_READER",
  "EMPLOYEE",
  "AUDITOR",
] as const satisfies readonly HrRoleKey[];

const rolePermissions: Record<HrRoleKey, readonly HrPermissionKey[]> = {
  ADMIN: HR_PERMISSIONS.filter((permission) => !permission.startsWith("compensation.") && !permission.startsWith("payroll.")),
  HR_ADMIN: HR_PERMISSIONS.filter((permission) => !permission.startsWith("payroll.") && !permission.startsWith("compensation.") && !["user.role.assign", "user.role.revoke", "settings.manage"].includes(permission)),
  PAYROLL_ADMIN: HR_PERMISSIONS.filter((permission) => permission.startsWith("payroll.") || ["employee.read_all", "workflow.task.complete", "report.read", "report.export", "time.authoritative.read", "time.authoritative.export"].includes(permission)),
  PAYROLL_PROCESSOR: ["payroll.read", "payroll.create", "payroll.certify", "payroll.freeze", "payroll.calculate", "payroll.review", "payroll.read_salary", "time.authoritative.read", "compensation.payroll_handoff.read"],
  PAYROLL_APPROVER: ["payroll.read", "payroll.review", "payroll.approve", "payroll.finalize", "payroll.read_salary"],
  PAYROLL_COMPLIANCE_ADMIN: ["payroll.read", "payroll.rules.manage", "payroll.rules.certify", "payroll.regulatory_watch.manage", "payroll.statutory.read", "payroll.audit.read"],
  PAYMENT_OPERATOR: ["payroll.read", "payroll.payment.prepare", "payroll.payment.submit", "payroll.payment.reconcile", "payroll.read_bank_details", "payroll.export"],
  PAYMENT_APPROVER: ["payroll.read", "payroll.payment.approve", "payroll.read_bank_details"],
  FINANCE_READER: ["payroll.read", "payroll.accounting.read", "payroll.statutory.read"],
  PAYROLL_AUDITOR: ["payroll.read", "payroll.audit.read", "payroll.accounting.read", "payroll.statutory.read", "audit.read"],
  STATUTORY_COMPLIANCE_OPERATOR: ["payroll.read", "payroll.statutory.read", "payroll.statutory.prepare", "payroll.statutory.submit", "payroll.payment.reconcile"],
  COMPENSATION_ADMIN: HR_PERMISSIONS.filter((permission) => permission.startsWith("compensation.")),
  BUDGET_OWNER: ["compensation.budget.read", "compensation.budget.manage", "compensation.recommendation.review", "compensation.decision.approve", "compensation.report.read"],
  PAYROLL_READER: ["compensation.payroll_handoff.read"],
  EMPLOYEE: ["employee.read_self", "employee.update_self", "employee.profile_change.request", "workforce_event.read_self", "leave.request", "leave.read_self", "time.capture_self", "time.read_self", "time.correction.request", "time.timesheet.submit", "performance.goal.read_self", "performance.goal.manage_self", "performance.feedback.create", "performance.feedback.read_self", "performance.checkin.manage_self", "performance.review.submit_self", "performance.review.read_self", "performance.career.manage_self", "performance.development.manage_self", "performance.readiness.read_self", "compensation.read_self", "compensation.statement.read", "compensation.recommendation.create", "document.read_self", "asset.read_self", "workflow.task.complete"],
  AUDITOR: ["audit.read", "report.read", "performance.audit.read", "compensation.audit.read"],
};

export function permissionsForRole(role: HrRoleKey) {
  return rolePermissions[role];
}

export function canAssignRole(actorRoles: HrRoleKey[], targetRole: HrRoleKey) {
  if (actorRoles.includes("ADMIN")) return true;
  if (actorRoles.includes("HR_ADMIN")) return targetRole === "EMPLOYEE";
  return false;
}
