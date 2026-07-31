"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import {
  createAssessmentWithStateAction,
  createOfferWithStateAction,
  evaluateAssessmentWithStateAction,
  feedbackWithStateAction,
  manageInterviewWithStateAction,
  manageOfferWithStateAction,
  scheduleInterviewWithStateAction,
  transitionApplicationWithStateAction,
  type RecruitmentActionState,
} from "./actions";

const initialState: RecruitmentActionState = { status: "idle" };
const actions = {
  transition: transitionApplicationWithStateAction,
  scheduleInterview: scheduleInterviewWithStateAction,
  manageInterview: manageInterviewWithStateAction,
  feedback: feedbackWithStateAction,
  createAssessment: createAssessmentWithStateAction,
  evaluateAssessment: evaluateAssessmentWithStateAction,
  createOffer: createOfferWithStateAction,
  manageOffer: manageOfferWithStateAction,
} as const;

export function WorkflowActionForm({
  actionName,
  children,
  submitLabel,
  className = "space-y-2",
}: {
  actionName: keyof typeof actions;
  children: ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(actions[actionName], initialState);
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      <button className="btn btn-secondary" disabled={pending}>
        {pending ? "Working…" : submitLabel}
      </button>
      <p
        className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
