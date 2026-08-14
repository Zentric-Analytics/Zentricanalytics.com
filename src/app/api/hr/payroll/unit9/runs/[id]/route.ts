import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHrUser } from "@/lib/hr/auth/session";
import { appendHrAudit } from "@/lib/hr/audit";
import { certifyUnit9Population, finalizeUnit9Run, freezeUnit9Inputs } from "@/lib/hr/payroll/unit9-service";

const candidate = z.object({ employeeId: z.string(), personId: z.string().optional(), workRelationshipId: z.string().optional(), assignmentId: z.string().optional(), employmentStatus: z.string(), legalEntityId: z.string().optional(), jurisdictionCode: z.string().optional(), payGroupId: z.string().optional(), workerType: z.enum(["SALARIED", "HOURLY"]), compensationHandoffId: z.string().optional(), compensationCurrency: z.string().optional(), payrollCurrency: z.string(), lockedTimeReference: z.string().optional(), taxProfileVersionId: z.string().optional(), paymentDestinationVersionId: z.string().optional(), conflictingIntervals: z.boolean().optional() });
const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("certify"), candidates: z.array(candidate).min(1) }),
  z.object({ action: z.literal("freeze"), snapshots: z.array(z.object({ candidate, sourceManifest: z.record(z.string(), z.unknown()) })).min(1) }),
  z.object({ action: z.literal("resolve-issue"), issueId: z.string().cuid(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("finalize") }),
]);

async function authFor(permission: string) {
  const auth = await getAuthenticatedHrUser();
  if (!auth) return null;
  if (!auth.permissions.has(permission)) return false;
  return { auth, actor: { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.roles.join(",") } };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authFor("payroll.read");
  if (access === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const run = await prisma.hrPayrollAuthoritativeRun.findFirst({ where: { id, organizationId: access.actor.organizationId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [issues, snapshots, attempts, results, reconciliations, risks, approvals] = await Promise.all([
    prisma.hrPayrollCertificationIssue.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id }, orderBy: { createdAt: "asc" } }),
    prisma.hrPayrollInputSnapshot.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id }, select: { id: true, employeeId: true, inputHash: true, certificationStatus: true, frozenAt: true, correlationId: true } }),
    prisma.hrPayrollCalculationAttempt.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id }, orderBy: { attemptNumber: "asc" } }),
    prisma.hrPayrollAuthoritativeResult.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id }, select: { id: true, employeeId: true, currency: true, grossEarnings: true, paye: true, employeeDeductions: true, employerContributions: true, adjustments: true, netPay: true, outputHash: true, finalizedAt: true } }),
    prisma.hrPayrollReconciliation.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id } }),
    prisma.hrPayrollRiskFinding.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id } }),
    prisma.hrPayrollRunApproval.findMany({ where: { organizationId: access.actor.organizationId, payrollRunId: id } }),
  ]);
  return NextResponse.json({ run, issues, snapshots, attempts, results, reconciliations, risks, approvals }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = actionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payroll action." }, { status: 400 });
  const permission = parsed.data.action === "finalize" ? "payroll.finalize" : parsed.data.action === "resolve-issue" ? "payroll.review" : parsed.data.action === "freeze" ? "payroll.freeze" : "payroll.certify";
  const access = await authFor(permission);
  if (access === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    if (parsed.data.action === "certify") return NextResponse.json(await certifyUnit9Population(prisma, access.actor, id, parsed.data.candidates));
    if (parsed.data.action === "freeze") return NextResponse.json(await freezeUnit9Inputs(prisma, access.actor, id, parsed.data.snapshots.map((snapshot) => ({ ...snapshot, sourceManifest: snapshot.sourceManifest as Prisma.InputJsonValue }))));
    if (parsed.data.action === "finalize") return NextResponse.json(await finalizeUnit9Run(prisma, access.actor, id));
    const issueData = parsed.data;
    const issue = await prisma.$transaction(async (tx) => {
      const current = await tx.hrPayrollCertificationIssue.findFirst({ where: { id: issueData.issueId, organizationId: access.actor.organizationId, payrollRunId: id, resolvedAt: null } });
      if (!current) throw new Error("Certification issue was not found or is already resolved.");
      const updated = await tx.hrPayrollCertificationIssue.update({ where: { id: current.id }, data: { resolvedAt: new Date(), resolvedById: access.actor.userId, resolutionReason: issueData.reason } });
      await appendHrAudit(tx, { organizationId: access.actor.organizationId, actorUserId: access.actor.userId, actorRole: access.actor.role, entityType: "HrPayrollCertificationIssue", entityId: current.id, action: "unit9.certification_issue.resolved", reason: issueData.reason, correlationId: crypto.randomUUID() });
      return updated;
    });
    return NextResponse.json({ issue });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payroll action failed." }, { status: 422 });
  }
}
