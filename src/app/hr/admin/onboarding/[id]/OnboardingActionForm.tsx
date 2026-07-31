"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { onboardingAction, type OnboardingActionState } from "./actions";

const initialState: OnboardingActionState = { status: "idle" };

export function OnboardingActionForm({ children, label, className = "space-y-2" }: { children: ReactNode; label: string; className?: string }) {
  const [state, action, pending] = useActionState(onboardingAction, initialState);
  return <form action={action} className={className} aria-busy={pending}>{children}<button className="btn btn-secondary" disabled={pending}>{pending ? "Working…" : label}</button><p className={`text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">{state.message}</p></form>;
}
