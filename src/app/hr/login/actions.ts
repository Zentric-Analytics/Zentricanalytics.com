"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateHrCredentials, GENERIC_LOGIN_ERROR } from "@/lib/hr/auth/login";
import { createHrSession } from "@/lib/hr/auth/session";
import { sha256 } from "@/lib/security";

const schema = z.object({ email: z.string().email().max(180), password: z.string().min(1).max(256), mfaCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal("")) });

export async function hrLoginAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  const organization = await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" }, select: { id: true } });
  if (!organization) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const user = await authenticateHrCredentials(organization.id, parsed.data.email, parsed.data.password, ip, parsed.data.mfaCode);
  if (!user) redirect(`/hr/login?error=${encodeURIComponent(GENERIC_LOGIN_ERROR)}`);
  await createHrSession(user.id, { ipHash: sha256(ip), userAgent: requestHeaders.get("user-agent")?.slice(0, 500) });
  redirect("/hr");
}
