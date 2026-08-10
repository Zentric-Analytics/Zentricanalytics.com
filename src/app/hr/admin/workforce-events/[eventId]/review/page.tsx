import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { startWorkflowAction } from "@/app/hr/admin/workflows/actions";

export default async function StartWorkforceReviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePermission("workflow.assign");
  const { eventId } = await params;
  const [event, definitions] = await Promise.all([
    prisma.hrWorkforceEvent.findFirstOrThrow({ where: { id: eventId, organizationId: auth.user.organizationId, status: "SUBMITTED", workflowInstanceId: null }, include: { employee: true } }),
    prisma.hrWorkflowDefinition.findMany({ where: { organizationId: auth.user.organizationId, subjectType: "HrWorkforceEvent", active: true }, orderBy: [{ key: "asc" }, { version: "desc" }] }),
  ]);
  return <main><h1 className="text-3xl font-bold">Start governed workforce review</h1><p className="mt-2 text-slate-600">{event.reference} · {event.type} · {event.employee.employeeNumber}</p>
    {definitions.length ? <form action={startWorkflowAction} className="mt-6 grid max-w-2xl gap-4 rounded-2xl bg-white p-5"><select className="input" name="definitionId" required><option value="">Approval workflow</option>{definitions.map((definition) => <option value={definition.id} key={definition.id}>{definition.name} v{definition.version}</option>)}</select><input type="hidden" name="subjectId" value={event.id}/><input type="hidden" name="subjectEmployeeId" value={event.employeeId}/><input type="hidden" name="context" value={JSON.stringify({ requiresHr: true, eventType: event.type })}/><button className="btn btn-primary">Start approval workflow</button></form> : <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">No active HrWorkforceEvent workflow definition exists. Publish a governed definition before review.</p>}
  </main>;
}
