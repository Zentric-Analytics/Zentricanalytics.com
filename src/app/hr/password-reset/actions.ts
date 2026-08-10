"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requestPasswordReset, consumePasswordReset } from "@/lib/hr/auth/password-reset";
const requestSchema = z.object({ email: z.string().email().max(180) });
export async function requestResetAction(formData: FormData) { const parsed = requestSchema.safeParse(Object.fromEntries(formData)); const organization = await prisma.hrOrganization.findUnique({ where: { slug: "zentric-analytics" } }); if (parsed.success && organization) await requestPasswordReset(organization.id, parsed.data.email); redirect("/hr/password-reset?requested=1"); }
export async function completeResetAction(formData: FormData) { const jar = await cookies(); const token = jar.get("za_hr_reset")?.value; const password = String(formData.get("password") ?? ""); if (!token) redirect("/hr/password-reset?error=invalid"); try { await consumePasswordReset(token, password); } catch { redirect("/hr/password-reset?stage=new&error=invalid"); } jar.delete("za_hr_reset"); redirect("/hr/password-reset?complete=1"); }
