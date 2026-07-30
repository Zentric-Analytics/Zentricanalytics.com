import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { acknowledgeAssetAction } from "@/app/hr/admin/assets/actions";

export default async function EmployeeAssetsPage() {
  const auth = await requirePermission("asset.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const assignments = await prisma.hrAssetAssignment.findMany({ where: { employeeId: auth.user.employee.id }, include: { asset: true }, orderBy: { assignedAt: "desc" } });
  return <>
    <h1 className="text-3xl font-bold">My assets</h1><p className="mt-2 text-slate-600">Current custody, expected return dates, receipt acknowledgement, and return history.</p>
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Asset</th><th>Assigned</th><th>Expected return</th><th>Condition</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{assignments.map((assignment) => <tr className="border-b last:border-0" key={assignment.id}><td className="py-3">{assignment.asset.assetTag} — {assignment.asset.name}<br /><span className="text-xs text-slate-500">{assignment.asset.type} · {assignment.asset.manufacturer} {assignment.asset.model}</span></td><td>{assignment.assignedAt.toLocaleDateString()}</td><td>{assignment.expectedReturnAt?.toLocaleDateString() ?? "—"}</td><td>Issued {assignment.issueCondition}{assignment.returnCondition ? ` · returned ${assignment.returnCondition}` : ""}</td><td>{assignment.status}</td><td>{assignment.acknowledgedAt ? assignment.acknowledgedAt.toLocaleDateString() : assignment.status === "ACTIVE" ? <form action={acknowledgeAssetAction}><input type="hidden" name="assignmentId" value={assignment.id} /><button className="font-semibold text-teal-700">Acknowledge receipt</button></form> : "—"}</td></tr>)}</tbody></table>{!assignments.length && <p className="py-8 text-center text-slate-500">No assets have been assigned to you.</p>}</section>
  </>;
}
