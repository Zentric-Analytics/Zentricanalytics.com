"use server";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { PasswordResetError, consumePasswordReset, requestPasswordReset, resendPasswordReset, verifyPasswordResetCode } from "@/lib/hr/auth/password-reset";
const requestSchema = z.object({ email: z.string().email().max(180) });
const CHALLENGE_COOKIE = "za_hr_reset_challenge"; const RESET_COOKIE = "za_hr_reset"; const COOLDOWN_COOKIE = "za_hr_reset_resend";
const cookieSecure = () => process.env.NODE_ENV === "production" || /^https:\/\//.test(process.env.APPLICATION_BASE_URL ?? "");
async function requestIp() { const h = await headers(); return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim(); }
async function organizationId() { return (await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" }, select: { id: true } }))?.id; }
async function setChallengeCookie(value: string) { const jar = await cookies(); jar.set(CHALLENGE_COOKIE, value, { httpOnly: true, secure: cookieSecure(), sameSite: "strict", maxAge: 600, path: "/hr/password-reset" }); jar.set(COOLDOWN_COOKIE, "1", { httpOnly: true, secure: cookieSecure(), sameSite: "strict", maxAge: 60, path: "/hr/password-reset" }); }
export async function requestResetAction(formData: FormData) {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData)); const orgId = await organizationId(); const ip = await requestIp();
  await setChallengeCookie(crypto.randomUUID());
  const allowed = await checkRateLimit({ scope: "hr-password-reset-request-ip", key: ip, limit: 10, windowMs: 15 * 60_000 });
  if (parsed.success && orgId && allowed.allowed) { const accountLimit = await checkRateLimit({ scope: "hr-password-reset-request-account", key: `${orgId}:${parsed.data.email}`, limit: 5, windowMs: 60 * 60_000 }); if (accountLimit.allowed) await setChallengeCookie((await requestPasswordReset(orgId, parsed.data.email)).challengeId); }
  redirect("/hr/password-reset?stage=verify");
}
export async function verifyResetCodeAction(formData: FormData) {
  const code = String(formData.get("code") ?? ""); const jar = await cookies(); const challengeId = jar.get(CHALLENGE_COOKIE)?.value ?? "missing"; const ip = await requestIp();
  const [challengeLimit, ipLimit] = await Promise.all([checkRateLimit({ scope: "hr-password-reset-verify-challenge", key: challengeId, limit: 8, windowMs: 15 * 60_000 }), checkRateLimit({ scope: "hr-password-reset-verify-ip", key: ip, limit: 30, windowMs: 15 * 60_000 })]);
  if (!challengeLimit.allowed || !ipLimit.allowed) redirect("/hr/password-reset?stage=verify&error=attempts");
  try { const token = await verifyPasswordResetCode(challengeId, code); jar.delete(CHALLENGE_COOKIE); jar.set(RESET_COOKIE, token, { httpOnly: true, secure: cookieSecure(), sameSite: "strict", maxAge: 600, path: "/hr/password-reset" }); }
  catch (error) { const code = error instanceof PasswordResetError ? error.code : "invalid"; redirect(`/hr/password-reset?stage=verify&error=${code}`); }
  redirect("/hr/password-reset?stage=new");
}
export async function resendResetCodeAction() {
  const jar = await cookies(); const challengeId = jar.get(CHALLENGE_COOKIE)?.value ?? "missing"; const ip = await requestIp(); const allowed = await checkRateLimit({ scope: "hr-password-reset-resend-ip", key: ip, limit: 5, windowMs: 15 * 60_000 });
  if (jar.has(COOLDOWN_COOKIE) || !allowed.allowed) redirect("/hr/password-reset?stage=verify&error=cooldown");
  try { await setChallengeCookie((await resendPasswordReset(challengeId)).challengeId); } catch { redirect("/hr/password-reset?stage=verify&error=cooldown"); }
  redirect("/hr/password-reset?stage=verify&resent=1");
}
export async function restartResetAction() { const jar = await cookies(); jar.delete(CHALLENGE_COOKIE); jar.delete(RESET_COOKIE); jar.delete(COOLDOWN_COOKIE); redirect("/hr/password-reset"); }
export async function completeResetAction(formData: FormData) {
  const jar = await cookies(); const token = jar.get(RESET_COOKIE)?.value; const password = String(formData.get("password") ?? ""); const confirmation = String(formData.get("confirmation") ?? "");
  if (!token) redirect("/hr/password-reset?error=session"); if (password !== confirmation) redirect("/hr/password-reset?stage=new&error=mismatch"); if (password.length < 8 || password.length > 128) redirect("/hr/password-reset?stage=new&error=short");
  try { await consumePasswordReset(token, password, confirmation); } catch { redirect("/hr/password-reset?error=session"); }
  jar.delete(RESET_COOKIE); redirect("/hr/password-reset?complete=1");
}
