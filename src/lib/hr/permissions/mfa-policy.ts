export function privilegedMfaRequired(auth: {
  roles: readonly string[];
  user: { mfaEnabled: boolean };
}) {
  return ["staging", "production"].includes(String(process.env.APP_ENV).toLowerCase())
    && auth.roles.some((role) => ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "COMPENSATION_ADMIN", "BUDGET_OWNER", "PAYROLL_READER", "AUDITOR"].includes(role))
    && !auth.user.mfaEnabled;
}
