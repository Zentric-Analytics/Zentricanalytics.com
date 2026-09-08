"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { consumeHrInvitation, HrInvitationAcceptanceError } from "@/lib/hr/auth/invitations";
import { invitationFormSchema } from "@/lib/hr/auth/invitation-form";
import { createHrSession } from "@/lib/hr/auth/session";

export async function acceptInvitationAction(formData: FormData) {
  const jar = await cookies();
  const token = jar.get("za_hr_invitation")?.value;
  const parsed = invitationFormSchema.safeParse(Object.fromEntries(formData));
  if (!token) redirect("/hr/invitation?error=invalid");
  if (!parsed.success) redirect("/hr/invitation?error=password_policy");
  try {
    const user = await consumeHrInvitation(token, parsed.data.password);
    await createHrSession(user.id);
  } catch (error) {
    if (error instanceof HrInvitationAcceptanceError && error.code === "PASSWORD_POLICY") {
      redirect("/hr/invitation?error=password_policy");
    }
    redirect("/hr/invitation?error=invalid");
  }
  jar.delete("za_hr_invitation");
  redirect("/hr/security?onboarding=invitation");
}
