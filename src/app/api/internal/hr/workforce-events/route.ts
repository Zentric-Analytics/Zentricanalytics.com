import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/hr/internal-auth";
import { prisma } from "@/lib/prisma";
import { applyWorkforceEvent } from "@/lib/hr/workforce/commands";
import { activateContractVersion, applySeparationCase } from "@/lib/hr/workforce/lifecycle-commands";

export async function POST(request: Request) {
  if (!authorizeInternalRequest(request, process.env.ORGANIZATION_WORKER_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const [events, contracts, separations] = await Promise.all([
    prisma.hrWorkforceEvent.findMany({ where: { status: { in: ["APPROVED", "SCHEDULED", "FAILED"] }, requestedEffectiveAt: { lte: now } }, select: { id: true, organizationId: true, initiatedById: true, reference: true }, take: 50 }),
    prisma.hrEmploymentContract.findMany({ where: { status: { in: ["SIGNED", "SCHEDULED"] }, effectiveFrom: { lte: now } }, select: { id: true, organizationId: true, createdById: true, contractRef: true }, take: 50 }),
    prisma.hrSeparationCase.findMany({ where: { status: { in: ["SCHEDULED", "FAILED"] }, finalWorkingDate: { lte: now } }, select: { id: true, organizationId: true, approvedById: true, initiatedById: true }, take: 50 }),
  ]);
  const results: Array<{ kind: string; id: string; status: string; reason?: string }> = [];
  for (const event of events) try { await prisma.$transaction((tx) => applyWorkforceEvent(tx, { organizationId: event.organizationId, actorUserId: event.initiatedById, actorRole: "WORKER" }, event.id, now), { isolationLevel: "Serializable" }); results.push({ kind: "workforce-event", id: event.reference, status: "APPLIED" }); } catch (error) { const reason = error instanceof Error ? error.message : "Workforce event failed"; await prisma.hrWorkforceEvent.updateMany({ where: { id: event.id, status: { in: ["APPROVED", "SCHEDULED", "FAILED"] } }, data: { status: "FAILED", failedAt: now, failureReason: reason.slice(0, 1000) } }); results.push({ kind: "workforce-event", id: event.reference, status: "FAILED", reason }); }
  for (const contract of contracts) try { await prisma.$transaction((tx) => activateContractVersion(tx, { organizationId: contract.organizationId, actorUserId: contract.createdById, actorRole: "WORKER" }, contract.id, now), { isolationLevel: "Serializable" }); results.push({ kind: "contract", id: contract.contractRef, status: "ACTIVE" }); } catch (error) { results.push({ kind: "contract", id: contract.contractRef, status: "BLOCKED", reason: error instanceof Error ? error.message : "Contract activation failed" }); }
  for (const separation of separations) try { await prisma.$transaction((tx) => applySeparationCase(tx, { organizationId: separation.organizationId, actorUserId: separation.approvedById ?? separation.initiatedById, actorRole: "WORKER" }, separation.id, now), { isolationLevel: "Serializable" }); results.push({ kind: "separation", id: separation.id, status: "APPLIED" }); } catch (error) { results.push({ kind: "separation", id: separation.id, status: "BLOCKED", reason: error instanceof Error ? error.message : "Separation execution failed" }); }
  return NextResponse.json({ inspected: results.length, applied: results.filter(({ status }) => ["APPLIED", "ACTIVE"].includes(status)).length, results });
}
