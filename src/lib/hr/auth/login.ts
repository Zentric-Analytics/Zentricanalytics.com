import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { appendHrAudit } from "@/lib/hr/audit";
import { normalizeHrEmail, unsealHrCredential, verifyHrPassword } from "./crypto";
import { matchingTotpStep } from "./totp";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
export const GENERIC_LOGIN_ERROR = "Invalid email or password.";

const DUMMY_PASSWORD_HASH = "$2b$12$i4pxAMZzkF4mSHrvhGf5bOZfuOH5TbAiFRr0G4fA/8L0BCs587cii";
function mfaStep(code: string, encryptedSecret: string | null) {
  if (!encryptedSecret) return null;
  try { return matchingTotpStep(code, unsealHrCredential(encryptedSecret)); } catch { return null; }
}

export async function beginHrLogin(organizationId: string, emailInput: string, password: string, ip: string) {
  const email = normalizeHrEmail(emailInput); const emailHash = sha256(email); const ipHash = sha256(ip);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const attempts = await prisma.hrLoginAttempt.count({ where: { organizationId, emailHash, ipHash, succeeded: false, createdAt: { gte: since } } });
  if (attempts >= LOGIN_LIMIT) return null;
  const user = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId, email } } });
  const passwordValid = await verifyHrPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordValid || user.status !== "ACTIVE") {
    await prisma.hrLoginAttempt.create({ data: { organizationId, userId: user?.id, emailHash, ipHash, succeeded: false, reason: !user || !passwordValid ? "INVALID_CREDENTIALS" : "INACTIVE_ACCOUNT" } });
    await appendHrAudit(prisma, { organizationId, entityType: "HrUser", entityId: user?.id, action: "hr.auth.login_failed", ipHash });
    return null;
  }
  if (user.mfaEnabled) return { status: "MFA_REQUIRED" as const, userId: user.id, emailHash };
  await prisma.hrLoginAttempt.create({ data: { organizationId, userId: user.id, emailHash, ipHash, succeeded: true } });
  await appendHrAudit(prisma, { organizationId, actorUserId: user.id, entityType: "HrUser", entityId: user.id, action: "hr.auth.login_succeeded", ipHash });
  await prisma.hrUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { status: "AUTHENTICATED" as const, user };
}

export async function completeHrMfaLogin(organizationId: string, userId: string, emailHash: string, code: string, ip: string) {
  const ipHash = sha256(ip);
  const user = await prisma.hrUser.findFirst({ where: { id: userId, organizationId, status: "ACTIVE", mfaEnabled: true } });
  const step = user?.mfaSecretEncrypted ? mfaStep(code, user.mfaSecretEncrypted) : null;
  let valid = false;
  if (user && step !== null) {
    const consumed = await prisma.hrUser.updateMany({ where: { id: user.id, mfaEnabled: true, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }] }, data: { mfaLastUsedStep: step, lastLoginAt: new Date() } });
    valid = consumed.count === 1;
  }
  await prisma.hrLoginAttempt.create({ data: { organizationId, userId: user?.id, emailHash, ipHash, succeeded: valid, reason: valid ? null : "INVALID_MFA" } });
  await appendHrAudit(prisma, { organizationId, actorUserId: valid ? user?.id : undefined, entityType: "HrUser", entityId: user?.id, action: valid ? "hr.auth.login_succeeded" : "hr.auth.login_failed", ipHash });
  return valid ? user : null;
}

export async function authenticateHrCredentials(organizationId: string, emailInput: string, password: string, ip: string, mfaCode = "") {
  const email = normalizeHrEmail(emailInput);
  const emailHash = sha256(email);
  const ipHash = sha256(ip);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const attempts = await prisma.hrLoginAttempt.count({ where: { organizationId, emailHash, ipHash, succeeded: false, createdAt: { gte: since } } });
  if (attempts >= LOGIN_LIMIT) return null;
  const user = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId, email } } });
  const passwordValid = await verifyHrPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  let mfaValid = !user?.mfaEnabled;
  if (user?.mfaEnabled && passwordValid && user.status === "ACTIVE") {
    const step = mfaStep(mfaCode, user.mfaSecretEncrypted);
    if (step !== null) {
      const consumed = await prisma.hrUser.updateMany({ where: { id: user.id, mfaEnabled: true, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }] }, data: { mfaLastUsedStep: step } });
      mfaValid = consumed.count === 1;
    }
  }
  const valid = Boolean(user && passwordValid && mfaValid && user.status === "ACTIVE");
  const failureReason = !passwordValid || !user ? "INVALID_CREDENTIALS" : !mfaValid ? "INVALID_MFA" : "INACTIVE_ACCOUNT";
  await prisma.hrLoginAttempt.create({ data: { organizationId, userId: user?.id, emailHash, ipHash, succeeded: valid, reason: valid ? null : failureReason } });
  await appendHrAudit(prisma, { organizationId, actorUserId: valid ? user?.id : undefined, entityType: "HrUser", entityId: user?.id, action: valid ? "hr.auth.login_succeeded" : "hr.auth.login_failed", ipHash });
  if (!valid || !user) return null;
  await prisma.hrUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}
