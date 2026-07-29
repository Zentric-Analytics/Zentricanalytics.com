"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendHrAudit } from "@/lib/hr/audit";
import { requirePermission } from "@/lib/hr/permissions/authorize";

const settingsInput = z.object({
  companyName: z.string().trim().min(2).max(180),
  registrationNumber: z.string().trim().max(80).optional().transform((value) => value || undefined),
  taxIdentificationNumber: z.string().trim().max(80).optional().transform((value) => value || undefined),
  defaultCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3).max(80),
  workingDays: z.array(z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])).min(1),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().min(5).max(40),
  address: z.string().trim().min(3).max(500),
});

export async function updateOrganizationSettingsAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const input = settingsInput.parse({ ...Object.fromEntries(formData), workingDays: formData.getAll("workingDays") });
  const organization = await prisma.hrOrganization.findUniqueOrThrow({ where: { id: auth.user.organizationId } });
  const currentSettings = await prisma.hrOrganizationSetting.findMany({ where: { organizationId: organization.id, key: { in: ["timezone", "workingDays", "contactEmail", "contactPhone", "address"] } } });
  const previous = Object.fromEntries(currentSettings.map(({ key, value }) => [key, value]));
  await prisma.$transaction(async (tx) => {
    await tx.hrOrganization.update({ where: { id: organization.id }, data: { name: input.companyName, registrationNumber: input.registrationNumber, taxIdentificationNumber: input.taxIdentificationNumber, defaultCurrency: input.defaultCurrency } });
    for (const key of ["timezone", "workingDays", "contactEmail", "contactPhone", "address"] as const) {
      await tx.hrOrganizationSetting.upsert({ where: { organizationId_key: { organizationId: organization.id, key } }, update: { value: input[key] }, create: { organizationId: organization.id, key, value: input[key] } });
    }
    await appendHrAudit(tx, { organizationId: organization.id, actorUserId: auth.user.id, actorRole: auth.roles[0], entityType: "HrOrganization", entityId: organization.id, action: "hr.organization.settings.updated", previousValues: { name: organization.name, registrationNumber: organization.registrationNumber, taxIdentificationNumber: organization.taxIdentificationNumber, defaultCurrency: organization.defaultCurrency, ...previous }, newValues: input });
  });
  revalidatePath("/hr/admin/settings");
}
