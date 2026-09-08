'use client';
import React, { useActionState } from 'react';
import { submitAssessmentResponse } from './assessment-actions';

export function AssessmentResponseForm({ session, assessmentId, version }: { session: string; assessmentId: string; version: number }) {
  const [state, action, pending] = useActionState(submitAssessmentResponse, {});
  if (state.success) return <p role="status">Your response has been submitted for review.</p>;
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="session" value={session} />
    <input type="hidden" name="assessmentId" value={assessmentId} />
    <input type="hidden" name="expectedVersion" value={version} />
    <label className="block">Your assessment response<textarea className="input mt-1 w-full" name="response" maxLength={10000} required /></label>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="btn btn-primary" disabled={pending} type="submit">{pending ? 'Submitting…' : 'Submit assessment response'}</button>
  </form>;
}
