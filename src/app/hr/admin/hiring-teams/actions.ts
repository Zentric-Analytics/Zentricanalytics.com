"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { HIRING_TEAM_MEMBER_PERMISSIONS, hiringTeamInput } from "@/lib/hr/recruitment/hiring-teams";
import { prisma } from "@/lib/prisma";

const cuid = z.string().cuid();

export async function createHiringTeamAction(formData: FormData) {
  const auth = await requirePermission("hiring_team.create");
  const input = hiringTeamInput.parse(Object.fromEntries(formData));
  if (input.departmentId) {
    await prisma.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  }
  if (input.defaultResponsibleHrTeamId) {
    await prisma.hrHiringTeam.findFirstOrThrow({ where: { id: input.defaultResponsibleHrTeamId, organizationId: auth.user.organizationId, status: "ACTIVE" } });
  }
  await prisma.$transaction(async (tx) => {
    const team = await tx.hrHiringTeam.create({ data: { ...input, organizationId: auth.user.organizationId, createdById: auth.user.id } });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
      entityType: "HrHiringTeam", entityId: team.id, action: "hr.recruitment.hiring_team.created",
      newValues: input, reason: "Hiring Team created",
    });
  });
  revalidatePath("/hr/admin/hiring-teams");
}

const memberInput = z.object({
  hiringTeamId: cuid,
  userId: cuid,
  permissions: z.string().transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean)),
});

export async function addHiringTeamMemberAction(formData: FormData) {
  const auth = await requirePermission("hiring_team.manage_members");
  const input = memberInput.parse(Object.fromEntries(formData));
  const invalid = input.permissions.find((permission) => !HIRING_TEAM_MEMBER_PERMISSIONS.includes(permission as never));
  if (invalid || !input.permissions.length) throw new Error("Select valid Hiring Team permissions.");
  const [team, user] = await Promise.all([
    prisma.hrHiringTeam.findFirstOrThrow({ where: { id: input.hiringTeamId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
    prisma.hrUser.findFirstOrThrow({ where: { id: input.userId, organizationId: auth.user.organizationId, status: "ACTIVE" } }),
  ]);
  await prisma.$transaction(async (tx) => {
    const member = await tx.hrHiringTeamMember.upsert({
      where: { hiringTeamId_userId: { hiringTeamId: team.id, userId: user.id } },
      create: { hiringTeamId: team.id, userId: user.id, addedById: auth.user.id },
      update: { status: "ACTIVE", effectiveTo: null, version: { increment: 1 } },
    });
    for (const permission of input.permissions) {
      await tx.hrHiringTeamMemberPermission.upsert({
        where: { memberId_permission: { memberId: member.id, permission } },
        create: { memberId: member.id, permission, grantedById: auth.user.id },
        update: { revokedAt: null, grantedById: auth.user.id, grantedAt: new Date() },
      });
    }
    await tx.hrHiringTeamMemberPermission.updateMany({
      where: { memberId: member.id, permission: { notIn: input.permissions }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
      entityType: "HrHiringTeamMember", entityId: member.id, action: "hr.recruitment.hiring_team.member_configured",
      newValues: { hiringTeamId: team.id, userId: user.id, permissions: input.permissions }, reason: "Hiring Team membership configured",
    });
  });
  revalidatePath("/hr/admin/hiring-teams");
}

export async function endHiringTeamMemberAction(formData: FormData) {
  const auth = await requirePermission("hiring_team.manage_members");
  const memberId = cuid.parse(formData.get("memberId"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const member = await prisma.hrHiringTeamMember.findFirstOrThrow({
    where: { id: memberId, hiringTeam: { organizationId: auth.user.organizationId } },
    include: { hiringTeam: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.hrHiringTeamMember.update({ where: { id: member.id }, data: { status: "ENDED", effectiveTo: new Date(), version: { increment: 1 } } });
    await tx.hrHiringTeamMemberPermission.updateMany({ where: { memberId: member.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await appendHrAudit(tx, {
      organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
      entityType: "HrHiringTeamMember", entityId: member.id, action: "hr.recruitment.hiring_team.member_ended",
      previousValues: { status: member.status }, newValues: { status: "ENDED" }, reason,
    });
  });
  revalidatePath("/hr/admin/hiring-teams");
}

export async function deactivateHiringTeamAction(formData: FormData) {
  const auth = await requirePermission("hiring_team.deactivate");
  const teamId = cuid.parse(formData.get("teamId"));
  const expectedVersion = z.coerce.number().int().positive().parse(formData.get("expectedVersion"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("reason"));
  const result = await prisma.hrHiringTeam.updateMany({
    where: { id: teamId, organizationId: auth.user.organizationId, status: "ACTIVE", version: expectedVersion },
    data: { status: "INACTIVE", deactivatedAt: new Date(), version: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("This Hiring Team changed or is already inactive. Reload and try again.");
  await appendHrAudit(prisma, {
    organizationId: auth.user.organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0],
    entityType: "HrHiringTeam", entityId: teamId, action: "hr.recruitment.hiring_team.deactivated",
    previousValues: { status: "ACTIVE" }, newValues: { status: "INACTIVE" }, reason,
  });
  revalidatePath("/hr/admin/hiring-teams");
}
