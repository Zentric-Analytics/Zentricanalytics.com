export function privilegedMfaRequired(auth: {
  roles: readonly string[];
  user: { mfaEnabled: boolean };
}) {
  return ["staging", "production"].includes(String(process.env.APP_ENV).toLowerCase())
    && auth.roles.some((role) => ["ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "AUDITOR"].includes(role))
    && !auth.user.mfaEnabled;
}
