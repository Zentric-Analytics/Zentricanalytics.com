"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { runId: string; status: string; canCalculate: boolean; canApprove: boolean; canFinalize: boolean; canPreparePayment: boolean; periodKey: string };
export function Unit9RunActions(props: Props) {
  const router = useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function act(body: Record<string, unknown>) { setBusy(true); setMessage(""); try { const response=await fetch(`/api/hr/payroll/unit9/runs/${props.runId}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}); const result=await response.json(); if(!response.ok) throw new Error(result.error??"Payroll action failed."); setMessage("Action completed and audit evidence was recorded."); router.refresh(); } catch(error){setMessage(error instanceof Error?error.message:"Payroll action failed.");} finally{setBusy(false);} }
  const primary="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
  return <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Governed actions</h2><p className="mt-1 text-sm text-slate-600">Only actions permitted for your explicit payroll role are shown. Finalization and payment controls remain independent.</p><div className="mt-4 flex flex-wrap gap-3">
    {props.canCalculate&&["FROZEN","CALCULATED","RECONCILED"].includes(props.status)&&<button className={primary} disabled={busy} onClick={()=>act({action:"calculate",reason:props.status==="FROZEN"?undefined:"Governed recalculation",idempotencyKey:crypto.randomUUID()})}>Calculate payroll</button>}
    {props.canApprove&&props.status==="RECONCILED"&&<><button className={primary} disabled={busy} onClick={()=>act({action:"decide",decision:"APPROVED",reason:"Reviewed reconciled authoritative results"})}>Approve payroll</button><button className="rounded-xl border px-4 py-2 text-sm font-semibold" disabled={busy} onClick={()=>act({action:"decide",decision:"REJECTED",reason:"Requires governed correction"})}>Reject payroll</button></>}
    {props.canFinalize&&props.status==="APPROVED"&&<button className={primary} disabled={busy} onClick={()=>act({action:"finalize"})}>Finalize immutable payroll</button>}
    {props.canFinalize&&props.status==="FINALIZED"&&<><button className={primary} disabled={busy} onClick={()=>act({action:"generate-payslips"})}>Generate payslips</button><button className={primary} disabled={busy} onClick={()=>act({action:"generate-financial-outputs",periodKey:props.periodKey})}>Generate accounting/statutory outputs</button></>}
    {props.canPreparePayment&&props.status==="FINALIZED"&&<button className={primary} disabled={busy} onClick={()=>act({action:"create-payment-batch"})}>Prepare payment batch</button>}
  </div>{message&&<p className="mt-3 text-sm" role="status">{message}</p>}</section>;
}
