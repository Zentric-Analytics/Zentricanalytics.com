import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { availableLeaveBalance } from "@/lib/hr/leave/engine";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createLeaveRequestAction, resubmitReturnedLeaveRequestAction, withdrawLeaveRequestAction } from "./actions";
import { projectedPeriodBalance, usageLabel } from "@/lib/hr/leave/unit5";

export default async function EmployeeLeavePage() {
  const auth = await requirePermission("leave.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const [balances, requests, policyAssignments, accountPeriods] = await Promise.all([
    prisma.hrLeaveBalance.findMany({ where: { employeeId: auth.user.employee.id }, include: { leaveType: true }, orderBy: { periodYear: "desc" } }),
    prisma.hrLeaveRequest.findMany({ where: { employeeId: auth.user.employee.id }, include: { leaveType: true, approvals: { include: { reviewer: true }, orderBy: { createdAt: "asc" } }, attachments: true, HrLeaveRequestVersion: { include: { evidence: { include: { documentVersion: true } }, transitions: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { version: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hrEmployeeLeavePolicy.findMany({ where: { employeeId: auth.user.employee.id, status: "ACTIVE" }, include: { leavePolicy: { include: { leaveType: true } } }, orderBy: { effectiveFrom: "desc" } }),
    prisma.hrLeaveAccountPeriod.findMany({ where: { account: { organizationId: auth.user.organizationId, employeeId: auth.user.employee.id } }, include: { account: { include: { leaveType: true } }, leavePolicy: true }, orderBy: { periodStart: "desc" }, take: 50 }),
  ]);
  return <>
    <h1 className="text-3xl font-bold">My leave</h1>
    <p className="mt-2 text-slate-600">Balances, requests, decisions, and policy coverage.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {accountPeriods.length ? accountPeriods.map((period) => { const used = Number(period.consumed); const unlimited = usageLabel(period.leavePolicy.entitlementModel, used, period.account.unit); return <div className="rounded-2xl bg-white p-5" key={period.id}><p className="text-sm text-slate-500">{period.account.leaveType.name} · {period.periodStart.getUTCFullYear()}</p><p className="mt-2 text-3xl font-bold">{unlimited ?? projectedPeriodBalance({ granted: Number(period.granted), accrued: Number(period.accrued), carriedOver: Number(period.carriedOver), carriedOut: Number(period.carriedOut), adjusted: Number(period.adjusted), reserved: Number(period.reserved), consumed: used, expired: Number(period.expired) })}</p><p className="text-xs text-slate-500">{unlimited ? "Approval remains policy-governed" : `Available · ${period.reserved.toString()} reserved · ${period.consumed.toString()} used`}</p></div>; }) : balances.map((balance) => <div className="rounded-2xl bg-white p-5" key={balance.id}>
        <p className="text-sm text-slate-500">{balance.leaveType.name} · {balance.periodYear}</p>
        <p className="mt-2 text-3xl font-bold">{availableLeaveBalance({ opening: Number(balance.opening), accrued: Number(balance.accrued), carriedOver: Number(balance.carriedOver), adjusted: Number(balance.adjusted), reserved: Number(balance.reserved), used: Number(balance.used), expired: Number(balance.expired) })}</p>
        <p className="text-xs text-slate-500">Available · {balance.reserved.toString()} reserved</p>
      </div>)}
    </div>
    <section className="mt-6 rounded-2xl bg-white p-5">
      <h2 className="font-bold">Request leave</h2>
      {policyAssignments.length ? <form action={createLeaveRequestAction} className="mt-4 grid gap-3 md:grid-cols-4">
        <select className="input" name="leaveTypeId" required><option value="">Leave type</option>{policyAssignments.map(({ leavePolicy }) => <option value={leavePolicy.leaveTypeId} key={leavePolicy.id}>{leavePolicy.leaveType.name} · {leavePolicy.name}</option>)}</select>
        <input className="input" name="startDate" type="date" required /><input className="input" name="endDate" type="date" required /><input className="input" name="hours" type="number" min="0.25" max="24" step="0.25" placeholder="Hours (hour-based leave only)" /><input className="input" name="reason" placeholder="Reason" required />
        <label className="text-sm font-semibold md:col-span-4">Supporting attachment (PDF, JPEG, or PNG; maximum 10 MB)<input className="input mt-1" name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /></label>
        <button className="btn btn-primary md:col-span-4">Submit request</button>
      </form> : <p className="mt-3 text-sm text-slate-600">No active leave policy has been assigned. Contact HR.</p>}
    </section>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5">
      <h2 className="font-bold">Request history</h2>
      <table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Leave</th><th>Dates</th><th>Amount</th><th>Status</th><th>Attachment</th><th>Decision notes</th><th>Action</th></tr></thead>
        <tbody>{requests.map((request) => { const version = request.HrLeaveRequestVersion[0]; const evidence = version?.evidence ?? []; const currentStatus = version?.transitions[0]?.toStatus ?? request.status; return <tr className="border-b last:border-0" key={request.id}><td className="py-3">{request.leaveType.name}</td><td>{request.startDate.toLocaleDateString()} – {request.endDate.toLocaleDateString()}</td><td>{request.amount.toString()}</td><td>{currentStatus}</td><td>{evidence.length ? evidence.map(({ status }) => status).join(", ") : request.attachments.length ? `${request.attachments.length} legacy private file` : "—"}</td><td>{request.approvals.at(-1)?.notes ?? "—"}</td><td>{!version && request.status === "PENDING" ? <form action={withdrawLeaveRequestAction}><input type="hidden" name="requestId" value={request.id} /><button className="font-semibold text-red-700">Withdraw</button></form> : "—"}</td></tr>; })}</tbody>
      </table>
      <div className="mt-5 space-y-4">{requests.filter((request) => request.HrLeaveRequestVersion[0]?.transitions[0]?.toStatus === "RETURNED").map((request) => { const version = request.HrLeaveRequestVersion[0]; return <form action={resubmitReturnedLeaveRequestAction} className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-4" key={`returned-${request.id}`}><input type="hidden" name="requestId" value={request.id}/><input type="hidden" name="expectedVersion" value={version.version}/><input type="hidden" name="leaveTypeId" value={request.leaveTypeId}/><p className="md:col-span-4 text-sm font-semibold text-amber-950">{request.leaveType.name} was returned for changes. Editing creates a new immutable request version and restarts approval.</p><input className="input" name="startDate" type="date" defaultValue={request.startDate.toISOString().slice(0, 10)} required/><input className="input" name="endDate" type="date" defaultValue={request.endDate.toISOString().slice(0, 10)} required/><input className="input" name="hours" type="number" min="0.25" max="24" step="0.25" placeholder="Hours if applicable"/><input className="input" name="reason" defaultValue={request.reason} required/><button className="btn btn-primary md:col-span-4">Resubmit revised request</button></form>; })}</div>
      <div className="mt-4 flex flex-wrap gap-3">{requests.flatMap((request) => request.HrLeaveRequestVersion.flatMap((version) => version.evidence.map((item) => <Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-teal-700" href={`/api/hr/documents/versions/${item.documentVersionId}`} key={item.id}>{request.leaveType.name}: {item.documentVersion.displayFileName} ({item.status})</Link>)))}</div>
    </section>
  </>;
}
