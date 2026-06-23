'use client';

import { useFormStatus } from 'react-dom';
import { requestAccessCode } from './actions';

type TrackFormsProps = {
  applicationId?: string;
  email?: string;
  limited?: boolean;
  error?: boolean;
};

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button className="btn btn-primary w-full justify-center sm:w-auto" type="submit" disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? 'Sending...' : 'Send code'}
    </button>
  );
}

export function TrackForms({ applicationId, email, limited, error }: TrackFormsProps) {
  return (
    <div className="mx-auto max-w-xl">
      <form action={requestAccessCode} className="card space-y-6 border border-slate-200 p-5 shadow-sm sm:p-7" aria-labelledby="track-access-heading">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Secure access</p>
          <h2 id="track-access-heading" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Open your candidate portal
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Enter your Application ID and email. If the details match Zentric Analytics records, we will send a one-time code to that email.
          </p>
        </div>

        {limited ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" role="status">
            <p className="font-semibold">Please wait before requesting another code.</p>
            <p className="mt-1 text-sm">Try again after the wait period.</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-semibold">We could not process the request.</p>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton />
          <p className="text-xs leading-5 text-slate-500">Codes expire quickly for your security.</p>
        </div>
      </form>
    </div>
  );
}
