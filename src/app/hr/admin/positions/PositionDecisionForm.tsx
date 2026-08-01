"use client";

import { useActionState } from "react";
import {
  approvePositionWithStateAction,
  rejectPositionWithStateAction,
  type PositionDecisionState,
} from "./actions";

const initialState: PositionDecisionState = { status: "idle" };

export function PositionDecisionForm({
  decision,
  id,
}: {
  decision: "approve" | "reject";
  id: string;
}) {
  const action = decision === "approve" ? approvePositionWithStateAction : rejectPositionWithStateAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const label = decision === "approve" ? "Approve" : "Reject";

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2" aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <input className="input" name="reason" placeholder={`${label} reason`} required />
      <button className={`btn ${decision === "reject" ? "btn-secondary" : "btn-primary"}`} disabled={pending}>
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
