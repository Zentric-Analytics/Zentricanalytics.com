"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeHrInvitation } from "@/lib/hr/auth/invitations";
const schema = z.object({ password: z.string().min(12).max(256), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword);
export async function acceptInvitationAction(formData: FormData) { const jar = await cookies(); const token = jar.get("za_hr_invitation")?.value; const parsed = schema.safeParse(Object.fromEntries(formData)); if (!token || !parsed.success) redirect("/hr/invitation?error=invalid"); try { await consumeHrInvitation(token, parsed.data.password); } catch { redirect("/hr/invitation?error=invalid"); } jar.delete("za_hr_invitation"); redirect("/hr/login?setup=complete"); }
