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
  const step2Ref = useRef<HTMLFormElement>(null);
  const step2Active = requested || verifiedFailed;

  useEffect(() => {
    if (requested) {
      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      step2Ref.current?.querySelector<HTMLInputElement>('input[name="code"]')?.focus({ preventScroll: true });
    }
  }, [requested]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <form action={requestAccessCode} className="card space-y-4 border-2 border-slate-200 p-5 sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Step 1</p>
          <h2 className="text-xl font-bold text-slate-950">Request your one-time passcode</h2>
          <p className="text-slate-700">
            Enter your Application ID and email. If they match our records, a one-time access code
            will be sent. For privacy, this page does not reveal whether a record exists.
          </p>
        </div>

        {requested ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800" role="status">
            <p className="font-semibold">Code request received</p>
            <p>If your details match our records, an access code will be sent.</p>
            <p className="text-sm">Please check your email, then use Step 2.</p>
          </div>
        ) : null}

        {limited ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900" role="status">
            <p className="font-semibold">Rate limited: please wait before requesting another code</p>
            <p className="text-sm">If your details match our records, an access code will be sent after the wait period.</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert">
            <p className="font-semibold">Temporary delivery issue: please try again shortly</p>
            <p className="text-sm">We could not process that request right now.</p>
          </div>
        ) : null}

        <label className="field">
          Application ID
          <input className="input" name="applicationId" defaultValue={applicationId} placeholder="ZA-APP-2026-00041" autoComplete="off" required />
        </label>

        <label className="field">
          Email
          <input className="input" name="email" defaultValue={email} type="email" autoComplete="email" required />
        </label>

        <SubmitButton idle="Send one-time passcode" pending="Sending..." />
      </form>

      <form
        ref={step2Ref}
        action={verifyAccessCode}
        className={`card scroll-mt-6 space-y-4 border-2 p-5 shadow-lg sm:p-6 ${step2Active ? 'border-teal-500 bg-teal-50/60 ring-4 ring-teal-100' : 'border-indigo-200 bg-indigo-50/40'}`}
        aria-labelledby="track-step-2-heading"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Step 2</p>
          <h2 id="track-step-2-heading" className="text-xl font-bold text-slate-950">Step 2: Enter your one-time passcode</h2>
          <p className="text-slate-700">
            First request a code in Step 1. Then enter the latest passcode from your email here to open your candidate portal.
          </p>
          {requested ? <p className="rounded-lg bg-white p-2 text-sm font-semibold text-teal-800">Please check your email — this panel is ready for your passcode.</p> : null}
        </div>

        {verifiedFailed ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
            We could not verify that code. Please request a new code if it expired.
          </p>
        ) : null}

        <input type="hidden" name="applicationId" value={applicationId ?? ''} />
        <input type="hidden" name="email" value={email ?? ''} />

        <label className="field text-base font-semibold text-slate-900">
          One-time passcode
          <input className="input bg-white text-lg tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
        </label>

        <SubmitButton idle="Open candidate portal" pending="Verifying..." />
      </form>
    </div>
  );
}
