import type { Prisma, PrismaClient } from "@prisma/client";

type SupervisorClient = PrismaClient | Prisma.TransactionClient;

function activeAt(now: Date) {
  return { status: "ACTIVE" as const, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
}

export async function supervisedEmployeeIds(client: SupervisorClient, input: { organizationId: string; supervisorEmployeeId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const assignments = await client.hrSupervisorAssignment.findMany({
    where: { organizationId: input.organizationId, supervisorEmployeeId: input.supervisorEmployeeId, ...activeAt(now) },
    select: { assignedEmployeeId: true, departmentScopeId: true, teamScopeId: true },
  });
  const direct = assignments.flatMap(({ assignedEmployeeId }) => assignedEmployeeId ? [assignedEmployeeId] : []);
  const departmentIds = assignments.flatMap(({ departmentScopeId }) => departmentScopeId ? [departmentScopeId] : []);
  const teamIds = assignments.flatMap(({ teamScopeId }) => teamScopeId ? [teamScopeId] : []);
  const scoped = departmentIds.length || teamIds.length ? await client.hrEmployeeAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      ...activeAt(now),
      OR: [
        ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
        ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
      ],
    },
    select: { employeeId: true },
  }) : [];
  return [...new Set([...direct, ...scoped.map(({ employeeId }) => employeeId)])];
}

export async function activeSupervisorForEmployee(client: SupervisorClient, input: { organizationId: string; employeeId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const current = await client.hrEmployeeAssignment.findFirst({
    where: { organizationId: input.organizationId, employeeId: input.employeeId, ...activeAt(now) },
    select: { departmentId: true, teamId: true },
    orderBy: { effectiveFrom: "desc" },
  });
  const candidates = await client.hrSupervisorAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      ...activeAt(now),
      OR: [
        { assignedEmployeeId: input.employeeId },
        ...(current?.teamId ? [{ teamScopeId: current.teamId }] : []),
        ...(current?.departmentId ? [{ departmentScopeId: current.departmentId }] : []),
      ],
    },
    include: { supervisorEmployee: { include: { user: true } } },
    orderBy: { effectiveFrom: "desc" },
  });
  return candidates.find(({ assignedEmployeeId }) => assignedEmployeeId === input.employeeId)
    ?? candidates.find(({ teamScopeId }) => teamScopeId === current?.teamId)
    ?? candidates.find(({ departmentScopeId }) => departmentScopeId === current?.departmentId)
    ?? null;
}
