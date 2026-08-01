import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";

export async function GET(request: Request) {
  if (!authorizeInternalRequest(request, process.env.MONITORING_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const [pendingOutbox, failedOutbox, abandonedOutbox, oldestPending, recentLoginFailures, overdueLifecycle, overdueWorkflow, pendingScans] = await Promise.all([
    prisma.hrEmailOutbox.count({ where: { status: "PENDING" } }),
    prisma.hrEmailOutbox.count({ where: { status: "FAILED" } }),
    prisma.hrEmailOutbox.count({ where: { status: "ABANDONED" } }),
    prisma.hrEmailOutbox.findFirst({ where: { status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.hrLoginAttempt.count({ where: { succeeded: false, createdAt: { gte: oneHourAgo } } }),
    prisma.hrLifecycleTask.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueAt: { lt: now } } }),
    prisma.hrWorkflowStageRun.count({ where: { status: "ACTIVE", dueAt: { lt: now } } }),
    prisma.hrEmployeeDocumentVersion.count({ where: { scanStatus: "PENDING" } }),
  ]);
  return NextResponse.json({
    status: "ok", generatedAt: now.toISOString(),
    outbox: { pending: pendingOutbox, failed: failedOutbox, abandoned: abandonedOutbox, oldestPendingAgeSeconds: oldestPending ? Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000) : 0 },
    security: { failedLoginsLastHour: recentLoginFailures },
    operations: { overdueLifecycleTasks: overdueLifecycle, overdueWorkflowStages: overdueWorkflow, pendingDocumentScans: pendingScans },
  }, { headers: { "Cache-Control": "no-store" } });
}
