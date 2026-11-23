import type { HrRoleKey } from "@prisma/client";
import { HR_PRIVILEGED_MFA_ROLES } from "./catalog";

export function privilegedMfaRequired(auth: {
  roles: readonly string[];
  user: { mfaEnabled: boolean };
}) {
  return ["staging", "production"].includes(String(process.env.APP_ENV).toLowerCase())
    && auth.roles.some((role) => HR_PRIVILEGED_MFA_ROLES.includes(role as HrRoleKey))
    && !auth.user.mfaEnabled;
}

export function hrMfaEnrollmentRequired(auth: {
  roles: readonly string[];
  user: { mfaEnabled: boolean; mfaSecretEncrypted?: string | null };
}) {
  return privilegedMfaRequired(auth) || Boolean(auth.user.mfaSecretEncrypted && !auth.user.mfaEnabled);
}
