"use client";

import { useActionState } from "react";
import { resendHrInvitationWithStateAction } from "./actions";

export function ResendInvitationForm({ userId, invitationId }: { userId: string; invitationId: string }) {
  const [state, action, pending] = useActionState(resendHrInvitationWithStateAction, { status: "idle" });
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <button disabled={pending}>{pending ? "Resending…" : "Resend invitation"}</button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}
