'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { requestAccessCode, verifyAccessCode } from './actions';

type TrackFormsProps = {
  applicationId?: string;
  email?: string;
  requested?: boolean;
  limited?: boolean;
  error?: boolean;
  verifiedFailed?: boolean;
};

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full justify-center sm:w-auto" type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? pending : idle}
    </button>
  );
}

export function TrackForms({ applicationId, email, requested, limited, error, verifiedFailed }: TrackFormsProps) {
  const codeFormRef = useRef<HTMLFormElement>(null);
  const codeFormActive = requested || verifiedFailed;

  useEffect(() => {
    if (requested) {
      codeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      codeFormRef.current?.querySelector<HTMLInputElement>('input[name="code"]')?.focus({ preventScroll: true });
    }
  }, [requested]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <form action={requestAccessCode} className="card space-y-5 border border-slate-200 p-5 sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Secure access</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Open your candidate portal</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your Application ID and email. We will send a one-time passcode if the details match our records.
          </p>
        </div>

        {requested ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800" role="status">
            <p className="font-semibold">Passcode sent</p>
            <p className="mt-1 text-sm">Check your email, then enter the code in the next panel.</p>
          </div>
        ) : null}

        {limited ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" role="status">
            <p className="font-semibold">Please wait before requesting another code.</p>
            <p className="mt-1 text-sm">Try again after the wait period.</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-semibold">We could not send the code.</p>
            <p className="mt-1 text-sm">Please try again shortly.</p>
          </div>
        ) : null}

        <div className="grid gap-4">
          <label className="field">
            Application ID
            <input className="input" name="applicationId" defaultValue={applicationId} placeholder="ZA-APP-2026-00041" autoComplete="off" required />
          </label>

          <label className="field">
            Email
            <input className="input" name="email" defaultValue={email} type="email" autoComplete="email" required />
          </label>
        </div>

        <SubmitButton idle="Send passcode" pending="Sending..." />
      </form>

      <form
        ref={codeFormRef}
        action={verifyAccessCode}
        className={`card scroll-mt-6 space-y-5 border p-5 sm:p-6 ${codeFormActive ? 'border-brand bg-white shadow-lg ring-4 ring-blue-50' : 'border-slate-200 bg-white'}`}
        aria-labelledby="track-code-heading"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Verification</p>
          <h2 id="track-code-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink">Enter passcode</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use the latest code from your email to view your progress and approved PDFs.
          </p>
        </div>

        {requested ? (
          <p className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800" role="status">
            Ready for your code.
          </p>
        ) : null}

        {verifiedFailed ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
            The code is invalid or expired. Request a new code if needed.
          </p>
        ) : null}

        <input type="hidden" name="applicationId" value={applicationId ?? ''} />
        <input type="hidden" name="email" value={email ?? ''} />

        <label className="field text-base font-semibold text-slate-900">
          One-time passcode
          <input className="input bg-white text-lg tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
        </label>

        <SubmitButton idle="Open portal" pending="Verifying..." />
      </form>
    </div>
  );
}
