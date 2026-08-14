"use client";

import { useState } from "react";

export function PollSourceButton({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function poll() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/hr/payroll/unit9/regulatory-sources/${sourceId}/poll`, { method: "POST" });
      const body = await response.json() as { changed?: boolean; candidateId?: string | null; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Regulatory source check failed.");
      setStatus(body.changed ? `Change candidate created: ${body.candidateId}` : "No content change detected.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Regulatory source check failed.");
    } finally {
      setPending(false);
    }
  }

  return <div className="space-y-2"><button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={pending} onClick={poll} type="button">{pending ? "Checking…" : "Check official source"}</button>{status&&<p className="max-w-xl text-sm text-slate-700" role="status">{status}</p>}</div>;
}
