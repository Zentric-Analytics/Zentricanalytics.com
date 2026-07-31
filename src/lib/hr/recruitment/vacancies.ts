import crypto from "node:crypto";
import type { HrVacancyStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { appendHrAudit } from "../audit";
import { enqueueHrEmail } from "../notifications/outbox";
import { assertVacancyTransition, canPublishVacancy } from "./states";

const listInput = z.string().trim().transform((value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean));

export const vacancyInput = z.object({
  title: z.string().trim().min(2).max(160),
  departmentId: z.string().cuid(),
  hiringTeamId: z.string().cuid(),
  responsibleHrTeamId: z.string().cuid(),
  vacancyOwnerId: z.string().cuid(),
  hiringManagerId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"]),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]),
  numberOfOpenings: z.coerce.number().int().min(1).max(1000),
  description: z.string().trim().min(50).max(20_000),
  responsibilities: listInput,
  minimumQualifications: listInput,
  preferredQualifications: listInput,
  requiredDocuments: listInput,
  screeningQuestions: listInput,
  locationLabel: z.string().trim().max(160).optional().transform((value) => value || undefined),
  opensAt: z.coerce.date().optional(),
  applicationDeadline: z.coerce.date().optional(),
  scheduledPublishAt: z.coerce.date().optional(),
  salaryMinimum: z.coerce.number().nonnegative().optional(),
  salaryMaximum: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("NGN"),
  publicSalary: z.coerce.boolean().default(false),
}).superRefine((input, context) => {
  if (input.applicationDeadline && input.opensAt && input.applicationDeadline <= input.opensAt) {
    context.addIssue({ code: "custom", path: ["applicationDeadline"], message: "Application deadline must be after the opening date." });
  }
  if (input.salaryMinimum !== undefined && input.salaryMaximum !== undefined && input.salaryMaximum < input.salaryMinimum) {
    context.addIssue({ code: "custom", path: ["salaryMaximum"], message: "Maximum salary must not be below minimum salary." });
  }
});

type VacancyClient = Prisma.TransactionClient;

export async function createVacancy(
  tx: VacancyClient,
  input: z.infer<typeof vacancyInput> & { organizationId: string; actorUserId: string; actorRole?: string },
) {
  const [department, hiringTeam, responsibleHrTeam, owner] = await Promise.all([
    tx.hrDepartment.findFirstOrThrow({ where: { id: input.departmentId, organizationId: input.organizationId, status: "ACTIVE" } }),
    tx.hrHiringTeam.findFirstOrThrow({ where: { id: input.hiringTeamId, organizationId: input.organizationId, status: "ACTIVE" } }),
    tx.hrHiringTeam.findFirstOrThrow({ where: { id: input.responsibleHrTeamId, organizationId: input.organizationId, status: "ACTIVE" } }),
    tx.hrUser.findFirstOrThrow({ where: { id: input.vacancyOwnerId, organizationId: input.organizationId, status: "ACTIVE" } }),
  ]);
  if (hiringTeam.departmentId && hiringTeam.departmentId !== department.id) throw new Error("Hiring Team does not support the selected department.");
  if (input.hiringManagerId) {
    await tx.hrUser.findFirstOrThrow({ where: { id: input.hiringManagerId, organizationId: input.organizationId, status: "ACTIVE" } });
  }
  const year = new Date().getUTCFullYear();
  const sequence = await tx.hrVacancyNumberSequence.upsert({
    where: { organizationId_year: { organizationId: input.organizationId, year } },
    create: { organizationId: input.organizationId, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  const vacancyNumber = `VAC-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
  const publicSlug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${vacancyNumber.toLowerCase()}`;
  const vacancy = await tx.hrVacancy.create({ data: {
    organizationId: input.organizationId, vacancyNumber, publicSlug, title: input.title,
    departmentId: department.id, hiringTeamId: hiringTeam.id, responsibleHrTeamId: responsibleHrTeam.id,
    vacancyOwnerId: owner.id, hiringManagerId: input.hiringManagerId, employmentType: input.employmentType,
    workMode: input.workMode, numberOfOpenings: input.numberOfOpenings, description: input.description,
    responsibilities: input.responsibilities, minimumQualifications: input.minimumQualifications,
    preferredQualifications: input.preferredQualifications, requiredDocuments: input.requiredDocuments,
    screeningQuestions: input.screeningQuestions, locationLabel: input.locationLabel, opensAt: input.opensAt,
    applicationDeadline: input.applicationDeadline, scheduledPublishAt: input.scheduledPublishAt,
    salaryMinimum: input.salaryMinimum, salaryMaximum: input.salaryMaximum, currency: input.currency,
    publicSalary: input.publicSalary, createdById: input.actorUserId, updatedById: input.actorUserId,
  } });
  const correlationId = crypto.randomUUID();
  await tx.hrVacancyHistory.create({ data: { vacancyId: vacancy.id, newState: "DRAFT", actorId: input.actorUserId, reason: "Vacancy created", source: "USER", correlationId } });
  await appendHrAudit(tx, {
    organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole,
    entityType: "HrVacancy", entityId: vacancy.id, action: "hr.recruitment.vacancy.created",
    newValues: { vacancyNumber, title: input.title, status: "DRAFT" }, reason: "Vacancy created", correlationId,
  });
  return vacancy;
}

export async function transitionVacancy(
  tx: VacancyClient,
  input: { vacancyId: string; organizationId: string; actorUserId: string; actorRole?: string; expectedVersion: number; to: HrVacancyStatus; reason: string },
) {
  const vacancy = await tx.hrVacancy.findFirstOrThrow({
    where: { id: input.vacancyId, organizationId: input.organizationId },
    include: {
      hiringTeam: true, responsibleHrTeam: true, vacancyOwner: true,
      approvals: { where: { decision: "APPROVED" } },
    },
  });
  if (vacancy.version !== input.expectedVersion) throw new Error("Vacancy changed since this page loaded. Reload and try again.");
  assertVacancyTransition(vacancy.status, input.to);
  if (input.to === "APPROVED" && vacancy.createdById === input.actorUserId) throw new Error("Vacancy creators cannot approve their own vacancy.");
  if (["OPEN", "SCHEDULED"].includes(input.to)) {
    const gate = canPublishVacancy({
      status: vacancy.status, activeHiringTeam: vacancy.hiringTeam.status === "ACTIVE",
      vacancyOwnerId: vacancy.vacancyOwner.status === "ACTIVE" ? vacancy.vacancyOwnerId : null,
      responsibleHrTeamId: vacancy.responsibleHrTeam.status === "ACTIVE" ? vacancy.responsibleHrTeamId : null,
      requiredApprovalsComplete: vacancy.approvals.some((approval) => approval.vacancyVersion === vacancy.version),
    });
    if (!gate.publishable) throw new Error(`Vacancy cannot be published: ${gate.blockers.join(", ")}.`);
  }
  const correlationId = crypto.randomUUID();
  if (input.to === "APPROVED") {
    await tx.hrVacancyApproval.create({ data: { vacancyId: vacancy.id, vacancyVersion: vacancy.version + 1, step: 1, decision: "APPROVED", comments: input.reason, approverId: input.actorUserId } });
  }
  const result = await tx.hrVacancy.updateMany({
    where: { id: vacancy.id, organizationId: input.organizationId, version: input.expectedVersion },
    data: {
      status: input.to, version: { increment: 1 }, updatedById: input.actorUserId,
      approvedVersion: input.to === "APPROVED" ? vacancy.version + 1 : vacancy.approvedVersion,
      careersVisible: input.to === "OPEN",
      publishedAt: input.to === "OPEN" ? new Date() : vacancy.publishedAt,
      closedAt: ["CLOSED", "FILLED", "CANCELLED"].includes(input.to) ? new Date() : vacancy.closedAt,
    },
  });
  if (result.count !== 1) throw new Error("Vacancy changed concurrently. Reload and try again.");
  await tx.hrVacancyHistory.create({ data: { vacancyId: vacancy.id, previousState: vacancy.status, newState: input.to, actorId: input.actorUserId, reason: input.reason, source: "USER", correlationId } });
  await appendHrAudit(tx, {
    organizationId: input.organizationId, actorUserId: input.actorUserId, actorRole: input.actorRole,
    entityType: "HrVacancy", entityId: vacancy.id, action: `hr.recruitment.vacancy.${input.to.toLowerCase()}`,
    previousValues: { status: vacancy.status, version: vacancy.version }, newValues: { status: input.to, version: vacancy.version + 1 },
    reason: input.reason, correlationId,
  });
  await enqueueHrEmail(tx, {
    organizationId: input.organizationId, recipient: vacancy.vacancyOwner.email,
    template: `hr-vacancy-${input.to.toLowerCase()}`, subject: `${vacancy.vacancyNumber}: ${input.to.replaceAll("_", " ").toLowerCase()}`,
    payload: { vacancyId: vacancy.id, href: `/hr/admin/vacancies/${vacancy.id}` },
    idempotencyKey: `hr-vacancy-transition:${vacancy.id}:${vacancy.version}:${input.to}`,
  });
  return { ...vacancy, status: input.to, version: vacancy.version + 1 };
}
