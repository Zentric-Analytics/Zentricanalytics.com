"use client";

import { useActionState } from "react";
import {
  transitionVacancyWithStateAction,
  type VacancyTransitionState,
} from "./actions";

const initialState: VacancyTransitionState = { status: "idle" };

export function VacancyTransitionForm({
  vacancyId,
  expectedVersion,
  to,
}: {
  vacancyId: string;
  expectedVersion: number;
  to: string;
}) {
  const [state, formAction, pending] = useActionState(
    transitionVacancyWithStateAction,
    initialState,
  );
  const label = to.replaceAll("_", " ");

  return (
    <form action={formAction} className="flex flex-wrap gap-2" aria-busy={pending}>
      <input type="hidden" name="vacancyId" value={vacancyId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <input type="hidden" name="to" value={to} />
      {to === "SCHEDULED" && <>
        <label>Publication date and time<input className="input" type="datetime-local" name="scheduledPublishAt" required /></label>
        <label>Time zone<select className="input" name="publicationTimeZone" required defaultValue="UTC">
          {["UTC", "Africa/Lagos", "America/Los_Angeles", "America/New_York", "Europe/London"].map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select></label>
        <p className="basis-full text-sm">Publishes on the first worker check at or after this time, only if all safeguards still pass.</p>
      </>}
      <input className="input" name="reason" placeholder={`Reason for ${to.toLowerCase()}`} required minLength={3} />
      <button className="btn btn-secondary" disabled={pending}>
        {pending ? `${label}…` : label}
      </button>
      <p
        className={`basis-full text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
