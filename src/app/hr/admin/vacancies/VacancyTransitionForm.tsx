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
