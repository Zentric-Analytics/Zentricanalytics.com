import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { appendHrAudit } from "@/lib/hr/audit";
import { normalizeHrEmail, verifyHrPassword } from "./crypto";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
export const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export async function authenticateHrCredentials(organizationId: string, emailInput: string, password: string, ip: string) {
  const email = normalizeHrEmail(emailInput);
  const emailHash = sha256(email);
  const ipHash = sha256(ip);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const attempts = await prisma.hrLoginAttempt.count({ where: { organizationId, emailHash, ipHash, succeeded: false, createdAt: { gte: since } } });
  if (attempts >= LOGIN_LIMIT) return null;
  const user = await prisma.hrUser.findUnique({ where: { organizationId_email: { organizationId, email } } });
  const valid = Boolean(user?.passwordHash && user.status === "ACTIVE" && await verifyHrPassword(password, user.passwordHash));
  await prisma.hrLoginAttempt.create({ data: { organizationId, userId: user?.id, emailHash, ipHash, succeeded: valid, reason: valid ? null : "INVALID_CREDENTIALS" } });
  await appendHrAudit(prisma, { organizationId, actorUserId: valid ? user?.id : undefined, entityType: "HrUser", entityId: user?.id, action: valid ? "hr.auth.login_succeeded" : "hr.auth.login_failed", ipHash });
  if (!valid || !user) return null;
  await prisma.hrUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}
