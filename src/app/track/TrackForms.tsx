'use client';

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
    <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? pending : idle}
    </button>
  );
}

export function TrackForms({ applicationId, email, requested, limited, error, verifiedFailed }: TrackFormsProps) {
  const accessSectionActive = requested || limited || error || Boolean(applicationId || email);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={requestAccessCode} className="card space-y-4 p-5 sm:p-6">
        <p>
          Enter your Application ID and email. If they match, a one-time access code
          will be sent. For privacy, this page does not reveal whether a record exists.
        </p>

        {requested ? (
          <p className="rounded-xl bg-green-50 p-3 text-green-700" role="status">
            If your details match our records, an access code will be sent.
          </p>
        ) : null}

        {limited ? (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-800" role="status">
            You have requested several codes recently. Please wait a few minutes before trying again.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-red-700" role="alert">
            We could not process that request right now. Please try again in a few minutes.
          </p>
        ) : null}

        <label className="field">
          Application ID
          <input className="input" name="applicationId" defaultValue={applicationId} placeholder="ZA-APP-2026-00041" autoComplete="off" required />
        </label>

        <label className="field">
          Email
          <input className="input" name="email" defaultValue={email} type="email" autoComplete="email" required />
        </label>

        <SubmitButton idle="Send one-time access code" pending="Sending..." />
      </form>

      <form action={verifyAccessCode} className={`card space-y-4 p-5 sm:p-6 ${accessSectionActive ? 'ring-2 ring-teal-100' : ''}`}>
        <h2 className="text-xl font-bold">Enter access code</h2>
        <p className="text-sm text-slate-600">
          After requesting a code, keep this page open and enter the latest code from your email.
        </p>

        {verifiedFailed ? (
          <p className="rounded-xl bg-red-50 p-3 text-red-700" role="alert">
            We could not verify that code. Please request a new code if it expired.
          </p>
        ) : null}

        <input type="hidden" name="applicationId" value={applicationId ?? ''} />
        <input type="hidden" name="email" value={email ?? ''} />

        <label className="field">
          One-time code
          <input className="input" name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>

        <SubmitButton idle="Open candidate portal" pending="Verifying..." />
      </form>
    </div>
  );
}
