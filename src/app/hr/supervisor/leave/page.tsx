import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/hr/permissions/authorize";
import { reviewLeaveRequestAction } from "./actions";

export default async function SupervisorLeavePage() {
  const auth = await requireAuthenticatedUser();
  const requests = await prisma.hrLeaveRequest.findMany({
    where: { organizationId: auth.user.organizationId, status: "PENDING", ...(auth.permissions.has("leave.read_all") ? {} : { currentReviewerId: auth.user.id }) },
    include: { employee: true, leaveType: true, balance: true, HrLeaveRequestVersion: { include: { segments: { orderBy: { sequence: "asc" } }, evidence: { select: { status: true } } }, orderBy: { version: "desc" }, take: 1 } },
    orderBy: { submittedAt: "asc" }, take: 100,
  });
  return <><h1 className="text-3xl font-bold">Leave requests</h1><p className="mt-2 text-slate-600">Only requests within your active assignment scope are available unless you hold organization-wide leave permission. Confidential evidence contents are never shown here.</p><div className="mt-6 space-y-4">{requests.map((request) => {
    const calculation = request.HrLeaveRequestVersion[0];
    return <article className="rounded-2xl bg-white p-5" key={request.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold">{request.employee.legalFirstName} {request.employee.lastName} · {request.leaveType.name}</h2><p className="text-sm text-slate-600">{request.startDate.toLocaleDateString()} – {request.endDate.toLocaleDateString()} · {request.amount.toString()} units</p><p className="mt-2 whitespace-pre-wrap text-sm">{request.reason}</p>{calculation ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><p>Immutable calculation v{calculation.version}: {calculation.segments.length} scheduled segment(s), {calculation.segments.filter(({ excludedMinutes }) => excludedMinutes > 0).length} holiday/non-working exclusion(s), {calculation.requestedAmount.toString()} chargeable {calculation.unit.toLowerCase()}.</p><p>Evidence status: {calculation.evidence.length ? calculation.evidence.map(({ status }) => status).join(", ") : "not supplied"}. Contents restricted to authorized HR.</p></div> : null}</div><span>{request.status}</span></div><form action={reviewLeaveRequestAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="expectedRequestVersion" value={calculation?.version ?? 1} /><input className="input" name="notes" placeholder="Decision notes" /><button className="btn btn-primary" name="decision" value="APPROVED">Approve</button><button className="btn btn-secondary" name="decision" value="RETURNED">Return for changes</button><button className="btn btn-secondary text-red-700" name="decision" value="REJECTED">Reject</button></form></article>;
  })}{!requests.length ? <p className="rounded-2xl bg-white p-6 text-slate-500">No pending leave requests in your scope.</p> : null}</div></>;
}
