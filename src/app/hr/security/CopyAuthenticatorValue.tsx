"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

export function CopyAuthenticatorValue({
  value,
  label = "Copy setup key",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2_000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        onClick={copyValue}
        aria-label={label}
      >
        {status === "copied" ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
        {status === "copied" ? "Copied" : "Copy"}
      </button>
      <p className={`mt-1 text-xs ${status === "error" ? "text-red-700" : "text-teal-700"}`} role="status" aria-live="polite">
        {status === "copied"
          ? "Copied to clipboard."
          : status === "error"
            ? "Copy failed. Select the value and copy it manually."
            : ""}
      </p>
    </div>
  );
}
