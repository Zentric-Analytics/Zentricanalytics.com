import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function CompensationAuditPage() {
  const auth = await requirePermission("compensation.audit.read");
  const organizationId = auth.user.organizationId;
  const [decisions, handoffs, audits] = await Promise.all([
    prisma.hrCompDecision.findMany({ where: { organizationId }, select: { id: true, status: true, eventType: true, effectiveAt: true, correlationId: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hrPayrollCompHandoff.findMany({ where: { organizationId }, select: { id: true, status: true, eventType: true, effectiveAt: true, correlationId: true, schemaVersion: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hrAuditEvent.findMany({ where: { organizationId, action: { startsWith: "hr.compensation." } }, select: { id: true, entityType: true, entityId: true, action: true, correlationId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return <><h1 className="text-3xl font-bold">Compensation audit evidence</h1><p className="mt-2 text-slate-600">Read-only decision and correlation metadata. Amounts, manager rationale, calibration deliberation, and exception narratives are redacted.</p><div className="mt-6 grid gap-4 sm:grid-cols-3">{[["Decisions", decisions.length], ["Payroll handoffs", handoffs.length], ["Audit events", audits.length]].map(([label,value]) => <article className="rounded-2xl bg-white p-5" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>)}</div><section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><h2 className="font-bold">Immutable correlation register</h2><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Time</th><th>Entity</th><th>Action</th><th>Correlation</th></tr></thead><tbody>{audits.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3">{item.createdAt.toISOString()}</td><td>{item.entityType}</td><td>{item.action}</td><td className="font-mono text-xs">{item.correlationId}</td></tr>)}</tbody></table></section></>;
}
