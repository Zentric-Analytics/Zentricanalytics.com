import { z } from "zod";

export const INVITATION_PASSWORD_MIN = 12;
export const INVITATION_PASSWORD_MAX = 128;
export const invitationFormSchema = z.object({
  password: z.string().min(INVITATION_PASSWORD_MIN).max(INVITATION_PASSWORD_MAX),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword);

export function invitationErrorMessage(error?: string) {
  if (error === "password_policy" || error === "password-policy") {
    return `Use ${INVITATION_PASSWORD_MIN} to ${INVITATION_PASSWORD_MAX} characters. Both passwords must match. Please try again.`;
  }
  return error ? "This invitation is invalid, expired, or already used." : null;
}
