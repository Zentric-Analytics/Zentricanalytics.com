import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function MyCompensationPage() {
  const auth = await requirePermission("compensation.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const organizationId = auth.user.organizationId, employeeId = auth.user.employee.id;
  const [records, awards, statements] = await Promise.all([
    prisma.hrCompensationRecord.findMany({ where: { organizationId, employeeId, status: { in: ["EFFECTIVE", "SUPERSEDED", "CORRECTED"] } }, select: { id: true, eventType: true, amount: true, currency: true, payBasis: true, effectiveFrom: true, effectiveTo: true, status: true }, orderBy: { effectiveFrom: "desc" }, take: 50 }),
    prisma.hrBonusAward.findMany({ where: { organizationId, employeeId, status: "APPROVED" }, select: { id: true, approvedAmount: true, currency: true, effectiveAt: true, status: true }, orderBy: { effectiveAt: "desc" }, take: 20 }),
    prisma.hrCompStatement.findMany({ where: { organizationId, employeeId, releasedAt: { not: null } }, select: { id: true, statementType: true, version: true, releasedAt: true, documentVersionId: true }, orderBy: { releasedAt: "desc" }, take: 20 }),
  ]);
  const current = records.find(({ status }) => status === "EFFECTIVE");
  return <><h1 className="text-3xl font-bold">My compensation</h1><p className="mt-2 text-slate-600">Finalized compensation only. Manager rationale, calibration discussion, exceptions, budgets, and peer pay are never shown here.</p><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Current base compensation</h2>{current ? <p className="mt-3 text-2xl font-bold">{current.currency} {current.amount.toFixed(2)} <span className="text-sm font-normal text-slate-500">{current.payBasis.toLowerCase()}</span></p> : <p className="mt-3 text-sm text-slate-600">No effective authoritative compensation record.</p>}</section><section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Finalized history</h2>{records.map((item) => <p className="mt-3 border-b pb-3 text-sm" key={item.id}>{item.effectiveFrom.toISOString().slice(0,10)} &middot; {item.eventType.replaceAll("_", " ")} &middot; {item.currency} {item.amount.toFixed(2)} &middot; {item.status}</p>)}</section><section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl bg-white p-5"><h2 className="font-bold">Approved rewards</h2>{awards.map((item) => <p className="mt-3 text-sm" key={item.id}>{item.effectiveAt.toISOString().slice(0,10)} &middot; {item.currency} {item.approvedAmount?.toFixed(2)}</p>)}</article><article className="rounded-2xl bg-white p-5"><h2 className="font-bold">Released statements</h2>{statements.map((item) => <p className="mt-3 text-sm" key={item.id}>{item.statementType} &middot; version {item.version} &middot; {item.releasedAt?.toISOString().slice(0,10)}</p>)}</article></section></>;
}
