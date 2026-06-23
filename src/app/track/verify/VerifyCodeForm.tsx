'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { verifyAccessCode } from '../actions';

type VerifyCodeFormProps = {
  applicationId?: string;
  email?: string;
  requested?: boolean;
  verifiedFailed?: boolean;
};

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full justify-center sm:w-auto" type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? 'Verifying...' : 'Open portal'}
    </button>
  );
}

export function VerifyCodeForm({ applicationId, email, requested, verifiedFailed }: VerifyCodeFormProps) {
  return (
    <div className="mx-auto max-w-xl">
      <form action={verifyAccessCode} className="card space-y-6 border border-slate-200 p-5 shadow-sm sm:p-7" aria-labelledby="track-verify-heading">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Verification</p>
          <h2 id="track-verify-heading" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Enter your passcode
          </h2>
          <p className="text-sm leading-6 text-slate-600">Enter the latest code sent to your email.</p>
        </div>

        {requested ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-teal-900" role="status">
            <p className="font-semibold">If the details match Zentric Analytics records, a code was sent.</p>
            <p className="mt-1 text-sm">Use the latest email code to continue.</p>
          </div>
        ) : null}

        {verifiedFailed ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-semibold">The code is invalid or expired.</p>
            <p className="mt-1 text-sm">Check the latest code or request a new one.</p>
          </div>
        ) : null}

        <input type="hidden" name="applicationId" value={applicationId ?? ''} />
        <input type="hidden" name="email" value={email ?? ''} />

        <label className="field text-base font-semibold text-slate-900">
          One-time passcode
          <input className="input bg-white text-lg tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required autoFocus />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton />
          <Link className="text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/track">
            Request a new code
          </Link>
        </div>
      </form>
    </div>
  );
}
