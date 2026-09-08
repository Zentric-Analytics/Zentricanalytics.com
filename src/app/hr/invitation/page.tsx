import { acceptInvitationAction } from "./actions";
import { invitationErrorMessage, INVITATION_PASSWORD_MIN, INVITATION_PASSWORD_MAX } from "@/lib/hr/auth/invitation-form";
export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = invitationErrorMessage(error);
  return <main className="min-h-screen bg-slate-100 px-4 py-16"><section className="mx-auto max-w-md rounded-3xl bg-white p-7">
    <h1 className="text-3xl font-bold">Set up your HR account</h1>
    {message ? <p role="alert" className="mt-4 text-red-700">{message}</p> : null}
    <form action={acceptInvitationAction} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">New password<input className="input mt-1" name="password" type="password" autoComplete="new-password" aria-describedby="password-guidance" minLength={INVITATION_PASSWORD_MIN} maxLength={INVITATION_PASSWORD_MAX} required /></label>
      <p id="password-guidance" className="text-sm text-slate-600">Use {INVITATION_PASSWORD_MIN} to {INVITATION_PASSWORD_MAX} characters. Both passwords must match.</p>
      <label className="block text-sm font-semibold">Confirm password<input className="input mt-1" name="confirmPassword" type="password" autoComplete="new-password" aria-describedby="password-guidance" minLength={INVITATION_PASSWORD_MIN} maxLength={INVITATION_PASSWORD_MAX} required /></label>
      <button className="btn btn-primary w-full">Activate account</button>
    </form>
  </section></main>;
}
