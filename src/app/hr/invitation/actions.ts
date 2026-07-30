"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeHrInvitation, HrInvitationAcceptanceError } from "@/lib/hr/auth/invitations";
import { passwordMeetsPolicy } from "@/lib/hr/auth/crypto";

const schema = z.object({
  password: z.string().min(12).max(256).refine(passwordMeetsPolicy),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword);

export async function acceptInvitationAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("za_hr_invitation")?.value;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!token) redirect("/hr/invitation?error=invalid");
  if (!parsed.success) redirect("/hr/invitation?error=password_policy");
  try {
    await consumeHrInvitation(token, parsed.data.password);
  } catch (error) {
    if (error instanceof HrInvitationAcceptanceError && error.code === "PASSWORD_POLICY") {
      redirect("/hr/invitation?error=password_policy");
    }
    redirect("/hr/invitation?error=invalid");
  }
  jar.delete("za_hr_invitation");
  redirect("/hr/login?setup=complete");
}
