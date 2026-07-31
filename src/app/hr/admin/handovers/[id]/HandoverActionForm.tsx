"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { handoverAction, type HandoverActionState } from "./actions";

const initialState: HandoverActionState = { status: "idle" };

export function HandoverActionForm({ children, label, className = "space-y-2" }: { children: ReactNode; label: string; className?: string }) {
  const [state, action, pending] = useActionState(handoverAction, initialState);
  return <form action={action} className={className} aria-busy={pending}>
    {children}
    <button className="btn btn-secondary" disabled={pending}>{pending ? "Working…" : label}</button>
    <p className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">{state.message}</p>
  </form>;
}
