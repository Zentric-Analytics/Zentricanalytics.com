import { acceptInvitationAction } from "./actions";

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error === "password_policy"
    ? "Use at least 12 characters, including an uppercase letter, a lowercase letter, and a number. Both passwords must match."
    : error
      ? "This invitation is invalid, expired, or already used."
      : null;
  return <main className="min-h-screen bg-slate-100 px-4 py-16"><section className="mx-auto max-w-md rounded-3xl bg-white p-7"><h1 className="text-3xl font-bold">Set up your HR account</h1>{message ? <p role="alert" className="mt-4 text-red-700">{message}</p> : null}<form action={acceptInvitationAction} className="mt-6 space-y-4"><label className="block text-sm font-semibold">New password<input className="input mt-1" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,256}" title="Use at least 12 characters with uppercase, lowercase, and a number." required /></label><p className="text-sm text-slate-600">At least 12 characters with uppercase, lowercase, and a number.</p><label className="block text-sm font-semibold">Confirm password<input className="input mt-1" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><button className="btn btn-primary w-full">Activate account</button></form></section></main>;
}
