import Link from "next/link";
import QRCode from "qrcode";
import { unsealHrCredential } from "@/lib/hr/auth/crypto";
import { totpProvisioningUri } from "@/lib/hr/auth/totp";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { beginMfaEnrollmentAction, disableMfaAction, enableMfaAction } from "./actions";

export default async function HrSecurityPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const auth = await requireAuthenticatedUser({ allowMfaEnrollment: true });
  const { onboarding } = await searchParams;
  const pendingSecret = !auth.user.mfaEnabled && auth.user.mfaSecretEncrypted
    ? unsealHrCredential(auth.user.mfaSecretEncrypted)
    : null;
  const provisioningUri = pendingSecret ? totpProvisioningUri(auth.user.email, pendingSecret) : null;
  const qrCode = provisioningUri
    ? await QRCode.toDataURL(provisioningUri, { errorCorrectionLevel: "M", margin: 2, width: 256 })
    : null;

  return <main className="min-h-screen bg-slate-100 px-4 py-12">
    <section className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Account security</p>
      <h1 className="mt-2 text-3xl font-bold">{onboarding === "invitation" ? "Set up your authenticator app" : "Authenticator MFA"}</h1>
      <p className="mt-2 text-slate-600">
        {onboarding === "invitation"
          ? "Your password is ready. Complete this required security step before entering the HR workspace."
          : `Protect ${auth.user.email} with a time-based one-time password.`}
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 p-5">
        <p className="font-semibold">Status: {auth.user.mfaEnabled ? "Enabled" : pendingSecret ? "Enrollment waiting for verification" : "Not enabled"}</p>
        {!auth.user.mfaEnabled && !pendingSecret && <form action={beginMfaEnrollmentAction} className="mt-4">
          <button className="btn btn-primary">Start MFA enrollment</button>
        </form>}
        {pendingSecret && provisioningUri && qrCode && <div className="mt-4 space-y-5">
          <div>
            <p className="font-semibold">1. Scan this QR code</p>
            <p className="mt-1 text-sm text-slate-600">Use Google Authenticator, Microsoft Authenticator, Authy, 1Password, or another TOTP-compatible app.</p>
            {/* The QR is generated locally from the TOTP URI; the secret is never sent to an external image service. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mt-4 h-64 w-64 rounded-xl border border-slate-200" src={qrCode} alt={`Authenticator QR code for ${auth.user.email}`} width={256} height={256} />
          </div>
          <div>
            <p className="font-semibold">Can&apos;t scan it?</p>
            <p className="mt-1 text-sm text-slate-600">Copy this setup key into your authenticator app manually:</p>
            <code className="mt-3 block select-all break-all rounded-xl bg-slate-950 p-4 text-sm tracking-wider text-white">{pendingSecret}</code>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">Copy authenticator setup link</summary>
              <textarea className="input mt-2 min-h-24 w-full font-mono text-xs" readOnly value={provisioningUri} aria-label="Authenticator setup link" />
            </details>
          </div>
          <form action={enableMfaAction} className="space-y-3">
            <label className="block font-semibold">2. Enter the 6-digit code
              <input className="input mt-2 w-full" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="123456" required />
            </label>
            <button className="btn btn-primary w-full">Verify authenticator and continue</button>
          </form>
        </div>}
        {auth.user.mfaEnabled && <form action={disableMfaAction} className="mt-4 grid gap-3">
          <p className="text-sm text-slate-600">Disabling MFA requires your password and a current authenticator code, then revokes every session.</p>
          <input className="input" name="password" type="password" autoComplete="current-password" placeholder="Current password" required />
          <input className="input" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="6-digit code" required />
          <button className="font-semibold text-red-700">Disable MFA and sign out everywhere</button>
        </form>}
      </div>
      {auth.user.mfaEnabled ? <Link className="mt-6 inline-block font-semibold text-teal-700" href="/hr">Return to workspace</Link> : null}
    </section>
  </main>;
}
