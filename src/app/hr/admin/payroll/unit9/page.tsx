import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export const dynamic = "force-dynamic";
export default async function Unit9PayrollPage() {
  const auth = await requirePermission("payroll.read");
  const runs = await prisma.hrPayrollAuthoritativeRun.findMany({ where: { organizationId: auth.user.organizationId }, orderBy: { createdAt: "desc" }, take: 50 });
  return <main>
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">Payroll operations</p><h1 className="mt-2 text-3xl font-bold">Nigeria payroll runs</h1><p className="mt-2 text-slate-600">Certification, frozen inputs, calculation, reconciliation, approval and downstream controls.</p></div>
      <div className="flex flex-wrap gap-2">{auth.permissions.has("payroll.exception.read")&&<Link className="rounded-xl border px-4 py-2 font-semibold" href="/hr/admin/payroll/unit9/compliance-exceptions">Compliance holds</Link>}{auth.permissions.has("payroll.regulatory_watch.manage")&&<Link className="rounded-xl border px-4 py-2 font-semibold" href="/hr/admin/payroll/unit9/regulatory-watch">Regulatory Watch</Link>}<Link className="rounded-xl border px-4 py-2 font-semibold" href="/hr/admin/unit-9-status">Unit 9 status</Link></div></div>
    <section className="mt-8 overflow-hidden rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Run</th><th className="p-4">Kind</th><th className="p-4">Status</th><th className="p-4">Frozen</th><th className="p-4">Finalized</th></tr></thead><tbody>{runs.map((run)=><tr className="border-t" key={run.id}><td className="p-4"><Link className="font-semibold text-indigo-700" href={`/hr/admin/payroll/unit9/${run.id}`}>{run.id}</Link></td><td className="p-4">{run.kind}</td><td className="p-4">{run.status}</td><td className="p-4">{run.frozenAt?.toISOString() ?? "Not frozen"}</td><td className="p-4">{run.finalizedAt?.toISOString() ?? "Not finalized"}</td></tr>)}</tbody></table>{!runs.length&&<p className="p-6 text-slate-600">No Unit 9 payroll runs exist for this tenant.</p>}</section>
  </main>;
}
