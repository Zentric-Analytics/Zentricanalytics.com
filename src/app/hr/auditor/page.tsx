import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";

export default async function AuditorPage() {
  const auth = await requirePermission("audit.read");
  const events = await prisma.hrAuditEvent.findMany({
    where: { organizationId: auth.user.organizationId },
    select: { id: true, createdAt: true, action: true, entityType: true, entityId: true, reason: true, correlationId: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  return <><h1 className="text-3xl font-bold">Read-only audit evidence</h1><p className="mt-2 text-slate-600">Tenant-scoped immutable history. Protected field values are not exposed in this workspace.</p><div className="mt-6 overflow-x-auto rounded-2xl bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Time</th><th className="p-4">Action</th><th className="p-4">Entity</th><th className="p-4">Reason</th><th className="p-4">Correlation</th></tr></thead><tbody>{events.map((event) => <tr className="border-b last:border-0 align-top" key={event.id}><td className="whitespace-nowrap p-4">{event.createdAt.toLocaleString()}</td><td className="p-4 font-mono">{event.action}</td><td className="p-4">{event.entityType}{event.entityId ? <span className="block max-w-48 break-all text-xs text-slate-500">{event.entityId}</span> : null}</td><td className="max-w-80 whitespace-pre-wrap p-4">{event.reason ?? "—"}</td><td className="max-w-56 break-all p-4 font-mono text-xs">{event.correlationId}</td></tr>)}</tbody></table></div></>;
}
