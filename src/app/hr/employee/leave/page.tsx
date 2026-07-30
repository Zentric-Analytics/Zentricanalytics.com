import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { availableLeaveBalance } from "@/lib/hr/leave/engine";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { createLeaveRequestAction, withdrawLeaveRequestAction } from "./actions";

export default async function EmployeeLeavePage() {
  const auth = await requirePermission("leave.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const [balances, requests, policyAssignments] = await Promise.all([
    prisma.hrLeaveBalance.findMany({ where: { employeeId: auth.user.employee.id }, include: { leaveType: true }, orderBy: { periodYear: "desc" } }),
    prisma.hrLeaveRequest.findMany({ where: { employeeId: auth.user.employee.id }, include: { leaveType: true, approvals: { include: { reviewer: true }, orderBy: { createdAt: "asc" } }, attachments: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hrEmployeeLeavePolicy.findMany({ where: { employeeId: auth.user.employee.id, status: "ACTIVE" }, include: { leavePolicy: { include: { leaveType: true } } }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  return <>
    <h1 className="text-3xl font-bold">My leave</h1>
    <p className="mt-2 text-slate-600">Balances, requests, decisions, and policy coverage.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {balances.map((balance) => <div className="rounded-2xl bg-white p-5" key={balance.id}>
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
        <tbody>{requests.map((request) => <tr className="border-b last:border-0" key={request.id}><td className="py-3">{request.leaveType.name}</td><td>{request.startDate.toLocaleDateString()} – {request.endDate.toLocaleDateString()}</td><td>{request.amount.toString()}</td><td>{request.status}</td><td>{request.attachments.length ? `${request.attachments.length} private file` : "—"}</td><td>{request.approvals.at(-1)?.notes ?? "—"}</td><td>{request.status === "PENDING" ? <form action={withdrawLeaveRequestAction}><input type="hidden" name="requestId" value={request.id} /><button className="font-semibold text-red-700">Withdraw</button></form> : "—"}</td></tr>)}</tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-3">{requests.flatMap((request) => request.attachments.map((attachment) => <Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-teal-700" href={`/api/hr/leave/attachments/${attachment.id}`} key={attachment.id}>{request.leaveType.name}: {attachment.fileName}</Link>))}</div>
    </section>
  </>;
}
