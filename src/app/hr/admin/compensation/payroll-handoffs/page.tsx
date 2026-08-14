import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function PayrollCompensationHandoffsPage() {
  const auth = await requirePermission("compensation.payroll_handoff.read");
  const handoffs = await prisma.hrPayrollCompHandoff.findMany({
    where: { organizationId: auth.user.organizationId },
    select: { id: true, workRelationshipId: true, assignmentId: true, eventType: true, amount: true, currency: true, payBasis: true, effectiveAt: true, status: true, schemaVersion: true, correlationId: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return <><h1 className="text-3xl font-bold">Payroll-authoritative compensation handoffs</h1><p className="mt-2 text-slate-600">Only final effective payroll fields are shown. Draft recommendations, manager rationale, calibration deliberation, exceptions, benchmarks, and diagnostics are excluded.</p><div className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Effective</th><th>Relationship / assignment</th><th>Event</th><th>Rate</th><th>Status</th><th>Correlation</th></tr></thead><tbody>{handoffs.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3">{item.effectiveAt.toISOString().slice(0,10)}</td><td className="font-mono text-xs">{item.workRelationshipId}<br/>{item.assignmentId}</td><td>{item.eventType}</td><td>{item.currency} {item.amount.toFixed(2)} · {item.payBasis?.toLowerCase() ?? "n/a"}</td><td>{item.status} · v{item.schemaVersion}</td><td className="font-mono text-xs">{item.correlationId}</td></tr>)}</tbody></table></div></>;
}
