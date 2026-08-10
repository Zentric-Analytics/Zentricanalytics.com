"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { beginHrLogin, completeHrMfaLogin, GENERIC_LOGIN_ERROR } from "@/lib/hr/auth/login";
import { sealHrCredential, unsealHrCredential } from "@/lib/hr/auth/crypto";
import { createHrSession } from "@/lib/hr/auth/session";
import { sha256 } from "@/lib/security";

const credentialsSchema = z.object({ email: z.string().email().max(180), password: z.string().min(1).max(256) });
const mfaSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
const CHALLENGE_COOKIE = "za_hr_mfa_challenge"; const CHALLENGE_TTL = 5 * 60;
type Challenge = { organizationId: string; userId: string; emailHash: string; ipHash: string; expiresAt: number };
async function requestContext() { const requestHeaders = await headers(); const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"; return { requestHeaders, ip }; }

export async function hrLoginAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  const organization = await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" }, select: { id: true } });
  if (!organization) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  const { requestHeaders, ip } = await requestContext();
  const result = await beginHrLogin(organization.id, parsed.data.email, parsed.data.password, ip);
  if (!result) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  if (result.status === "MFA_REQUIRED") {
    const challenge: Challenge = { organizationId: organization.id, userId: result.userId, emailHash: result.emailHash, ipHash: sha256(ip), expiresAt: Date.now() + CHALLENGE_TTL * 1000 };
    (await cookies()).set(CHALLENGE_COOKIE, sealHrCredential(JSON.stringify(challenge)), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: CHALLENGE_TTL, path: "/hr/login" });
    redirect("/hr/login/authenticator");
  }
  await createHrSession(result.user.id, { ipHash: sha256(ip), userAgent: requestHeaders.get("user-agent")?.slice(0, 500) }); redirect("/hr");
}

export async function hrMfaAction(formData: FormData) {
  const parsed = mfaSchema.safeParse(Object.fromEntries(formData)); const jar = await cookies(); const envelope = jar.get(CHALLENGE_COOKIE)?.value;
  if (!parsed.success || !envelope) redirect("/hr/login/authenticator?error=Invalid+authenticator+code.");
  let challenge: Challenge;
  try { challenge = JSON.parse(unsealHrCredential(envelope)); } catch { redirect("/hr/login?error=Your+sign-in+attempt+expired."); }
  const { requestHeaders, ip } = await requestContext();
  if (challenge.expiresAt <= Date.now() || challenge.ipHash !== sha256(ip)) { jar.delete(CHALLENGE_COOKIE); redirect("/hr/login?error=Your+sign-in+attempt+expired."); }
  const user = await completeHrMfaLogin(challenge.organizationId, challenge.userId, challenge.emailHash, parsed.data.code, ip);
  if (!user) redirect("/hr/login/authenticator?error=Invalid+authenticator+code.");
  jar.delete(CHALLENGE_COOKIE); await createHrSession(user.id, { ipHash: sha256(ip), userAgent: requestHeaders.get("user-agent")?.slice(0, 500) }); redirect("/hr");
}

export async function cancelHrMfaAction() { (await cookies()).delete(CHALLENGE_COOKIE); redirect("/hr/login"); }
