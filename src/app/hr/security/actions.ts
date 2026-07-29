"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { sealHrCredential, unsealHrCredential, verifyHrPassword } from "@/lib/hr/auth/crypto";
import { revokeAllHrSessions } from "@/lib/hr/auth/session";
import { generateTotpSecret, matchingTotpStep, verifyTotp } from "@/lib/hr/auth/totp";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";

export async function beginMfaEnrollmentAction() {
  const auth = await requireAuthenticatedUser();
  if (auth.user.mfaEnabled) throw new Error("MFA is already enabled.");
  const secret = generateTotpSecret();
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: auth.user.id }, data: { mfaSecretEncrypted: sealHrCredential(secret), mfaEnabled: false, mfaLastUsedStep: null } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: auth.user.id, action: "hr.auth.mfa.enrollment_started" });
  });
  revalidatePath("/hr/security");
}

const codeSchema = z.string().trim().regex(/^\d{6}$/);
export async function enableMfaAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const code = codeSchema.parse(formData.get("code"));
  const user = await prisma.hrUser.findUniqueOrThrow({ where: { id: auth.user.id }, select: { mfaEnabled: true, mfaSecretEncrypted: true } });
  const step = user.mfaSecretEncrypted ? matchingTotpStep(code, unsealHrCredential(user.mfaSecretEncrypted)) : null;
  if (user.mfaEnabled || step === null) throw new Error("The authenticator code is invalid.");
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: auth.user.id }, data: { mfaEnabled: true, mfaLastUsedStep: step } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: auth.user.id, action: "hr.auth.mfa.enabled" });
  });
  revalidatePath("/hr/security");
}

const disableSchema = z.object({ code: codeSchema, password: z.string().min(1).max(256) });
export async function disableMfaAction(formData: FormData) {
  const auth = await requireAuthenticatedUser();
  const input = disableSchema.parse(Object.fromEntries(formData));
  const user = await prisma.hrUser.findUniqueOrThrow({ where: { id: auth.user.id }, select: { passwordHash: true, mfaEnabled: true, mfaSecretEncrypted: true } });
  const passwordValid = Boolean(user.passwordHash && await verifyHrPassword(input.password, user.passwordHash));
  const codeValid = Boolean(user.mfaEnabled && user.mfaSecretEncrypted && verifyTotp(input.code, unsealHrCredential(user.mfaSecretEncrypted)));
  if (!passwordValid || !codeValid) throw new Error("Password or authenticator code is invalid.");
  await prisma.$transaction(async (tx) => {
    await tx.hrUser.update({ where: { id: auth.user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaLastUsedStep: null } });
    await appendHrAudit(tx, { organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrUser", entityId: auth.user.id, action: "hr.auth.mfa.disabled" });
  });
  await revokeAllHrSessions(auth.user.id);
  redirect("/hr/login");
}
