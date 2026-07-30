"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { wouldCreateHierarchyCycle } from "@/lib/hr/organization/validation";

const base = z.object({
  kind: z.enum(["legal-entity", "business-unit", "division", "location", "cost-center", "job-family", "job", "grade"]),
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  effectiveFrom: z.coerce.date().default(() => new Date()),
  parentId: z.string().cuid().optional().or(z.literal("")).transform(value => value || undefined),
  legalEntityId: z.string().cuid().optional().or(z.literal("")).transform(value => value || undefined),
  businessUnitId: z.string().cuid().optional().or(z.literal("")).transform(value => value || undefined),
  jobFamilyId: z.string().cuid().optional().or(z.literal("")).transform(value => value || undefined),
  countryCode: z.string().trim().length(2).optional().or(z.literal("")).transform(value => value?.toUpperCase() || undefined),
  currency: z.string().trim().length(3).optional().or(z.literal("")).transform(value => value?.toUpperCase() || undefined),
  timezone: z.string().trim().max(80).optional().or(z.literal("")).transform(value => value || undefined),
  level: z.coerce.number().int().positive().optional().or(z.literal("")).transform(value => value === "" ? undefined : value),
  locationType: z.enum(["HEAD_OFFICE", "REGIONAL_OFFICE", "BRANCH", "CLIENT_SITE", "REMOTE", "VIRTUAL"]).optional(),
  minimumSalary: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(value => value === "" ? undefined : value),
  midpointSalary: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(value => value === "" ? undefined : value),
  maximumSalary: z.coerce.number().nonnegative().optional().or(z.literal("")).transform(value => value === "" ? undefined : value),
});

export async function createOrganizationRecordAction(formData: FormData) {
  const auth = await requirePermission("organization.structure.manage");
  const input = base.parse(Object.fromEntries(formData));
  const organizationId = auth.user.organizationId;
  await prisma.$transaction(async tx => {
    let record: { id: string };
    if (input.kind === "legal-entity") record = await tx.hrLegalEntity.create({ data: { organizationId, code: input.code, name: input.name, countryCode: input.countryCode ?? "NG", defaultCurrency: input.currency ?? "NGN", timezone: input.timezone ?? "Africa/Lagos", effectiveFrom: input.effectiveFrom } });
    else if (input.kind === "business-unit") {
      const legalEntityId = z.string().cuid().parse(input.legalEntityId);
      await tx.hrLegalEntity.findFirstOrThrow({ where: { id: legalEntityId, organizationId, status: "ACTIVE" } });
      record = await tx.hrBusinessUnit.create({ data: { organizationId, legalEntityId, parentBusinessUnitId: input.parentId, code: input.code, name: input.name, effectiveFrom: input.effectiveFrom } });
    } else if (input.kind === "division") {
      const businessUnitId = z.string().cuid().parse(input.businessUnitId);
      await tx.hrBusinessUnit.findFirstOrThrow({ where: { id: businessUnitId, organizationId, status: "ACTIVE" } });
      record = await tx.hrDivision.create({ data: { organizationId, businessUnitId, parentDivisionId: input.parentId, code: input.code, name: input.name, effectiveFrom: input.effectiveFrom } });
    } else if (input.kind === "location") {
      const legalEntityId = z.string().cuid().parse(input.legalEntityId);
      await tx.hrLegalEntity.findFirstOrThrow({ where: { id: legalEntityId, organizationId, status: "ACTIVE" } });
      record = await tx.hrLocation.create({ data: { organizationId, legalEntityId, parentLocationId: input.parentId, code: input.code, name: input.name, locationType: input.locationType ?? "HEAD_OFFICE", countryCode: input.countryCode ?? "NG", timezone: input.timezone ?? "Africa/Lagos", effectiveFrom: input.effectiveFrom } });
    } else if (input.kind === "cost-center") {
      const legalEntityId = z.string().cuid().parse(input.legalEntityId);
      await tx.hrLegalEntity.findFirstOrThrow({ where: { id: legalEntityId, organizationId, status: "ACTIVE" } });
      record = await tx.hrCostCenter.create({ data: { organizationId, legalEntityId, parentCostCenterId: input.parentId, code: input.code, name: input.name, currency: input.currency ?? "NGN", effectiveFrom: input.effectiveFrom } });
    } else if (input.kind === "job-family") record = await tx.hrJobFamily.create({ data: { organizationId, code: input.code, name: input.name } });
    else if (input.kind === "job") {
      const jobFamilyId = z.string().cuid().parse(input.jobFamilyId);
      await tx.hrJobFamily.findFirstOrThrow({ where: { id: jobFamilyId, organizationId, status: "ACTIVE" } });
      record = await tx.hrJobProfile.create({ data: { organizationId, jobFamilyId, code: input.code, title: input.name } });
    } else {
      const values = [input.minimumSalary, input.midpointSalary, input.maximumSalary].filter((value): value is number => value !== undefined);
      if (values.some((value, index) => index > 0 && value < values[index - 1])) throw new Error("Grade salary range must increase from minimum to maximum.");
      record = await tx.hrGrade.create({ data: { organizationId, code: input.code, name: input.name, level: input.level ?? 1, currency: input.currency ?? "NGN", minimumSalary: input.minimumSalary, midpointSalary: input.midpointSalary, maximumSalary: input.maximumSalary } });
    }
    await appendHrAudit(tx, { organizationId, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: input.kind, entityId: record.id, action: "hr.organization.structure.created", newValues: { kind: input.kind, code: input.code, name: input.name }, reason: "Created through organization administration" });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/hr/admin/organization");
  revalidatePath(`/hr/admin/${input.kind === "job" ? "jobs" : `${input.kind}s`}`);
}

export async function validateParentChangeAction(formData: FormData) {
  const auth = await requirePermission("organization.structure.manage");
  const kind = z.enum(["business-unit", "division", "location", "cost-center"]).parse(formData.get("kind"));
  const id = z.string().cuid().parse(formData.get("id"));
  const parentId = z.string().cuid().nullable().parse(formData.get("parentId") || null);
  const organizationId = auth.user.organizationId;
  const records = kind === "business-unit"
    ? await prisma.hrBusinessUnit.findMany({ where: { organizationId }, select: { id: true, parentBusinessUnitId: true } }).then(rows => rows.map(row => ({ id: row.id, parentId: row.parentBusinessUnitId })))
    : kind === "division"
      ? await prisma.hrDivision.findMany({ where: { organizationId }, select: { id: true, parentDivisionId: true } }).then(rows => rows.map(row => ({ id: row.id, parentId: row.parentDivisionId })))
      : kind === "location"
        ? await prisma.hrLocation.findMany({ where: { organizationId }, select: { id: true, parentLocationId: true } }).then(rows => rows.map(row => ({ id: row.id, parentId: row.parentLocationId })))
        : await prisma.hrCostCenter.findMany({ where: { organizationId }, select: { id: true, parentCostCenterId: true } }).then(rows => rows.map(row => ({ id: row.id, parentId: row.parentCostCenterId })));
  if (wouldCreateHierarchyCycle(records, id, parentId)) throw new Error("This parent change would create a circular hierarchy.");
}
