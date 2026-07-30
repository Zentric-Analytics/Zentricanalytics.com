"use client";
import { useEffect } from "react";

const ROTATION_INTERVAL_MS = 30 * 60 * 1000;
export function HrSessionRotation() {
  useEffect(() => {
    const rotate = () => { void fetch("/api/hr/session/rotate", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } }); };
    const timer = window.setInterval(rotate, ROTATION_INTERVAL_MS);
    const onVisibility = () => { if (document.visibilityState === "visible") rotate(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  return null;
}
