"use client";

import { useActionState } from "react";
import {
  hardDeleteHrUserWithStateAction,
  softDeleteHrUserWithStateAction,
  type HrUserDeletionState,
} from "./actions";

const initialState: HrUserDeletionState = { status: "idle" };

export function UserDeletionForm({
  hard,
  userId,
}: {
  hard: boolean;
  userId: string;
}) {
  const action = hard ? hardDeleteHrUserWithStateAction : softDeleteHrUserWithStateAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const label = hard ? "Permanently delete user" : "Soft-delete user";

  return (
    <form action={formAction} className="mt-2 flex flex-wrap gap-2" aria-busy={pending}>
      <input type="hidden" name="userId" value={userId} />
      <input
        className="input min-w-64"
        name="reason"
        placeholder={hard ? "Required permanent deletion reason" : "Required deletion reason"}
        required
      />
      <button
        className={hard ? "btn bg-red-700 text-white" : "btn btn-secondary text-red-700"}
        disabled={pending}
      >
        {pending ? "Processing…" : label}
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
