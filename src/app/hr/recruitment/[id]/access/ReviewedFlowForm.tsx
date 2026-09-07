"use client";
import { useActionState } from "react";
import { reconcileReviewedFlowAction } from "./actions";

export function ReviewedFlowForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(reconcileReviewedFlowAction, { message: "" });
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="applicationId" value={applicationId} />
    <p>For previously completed applications, carry forward matching approval evidence, then connect the completed journey. Unverified requirements and conflicting records remain blocked.</p>
    <button disabled={pending} name="operation" value="EVIDENCE" className="btn btn-secondary">Connect approved stage evidence</button>
    <button disabled={pending} name="operation" value="COMPLETE" className="btn btn-primary">Connect completed onboarding</button>
    <p role="status">{state.message}</p>
  </form>;
}
