import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT7_POSITIVE_FIXTURE_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") {
  throw new Error("Refusing Unit 7 fixture creation: explicit staging confirmation and zentric_analytics_staging are required.");
}

const prisma = new PrismaClient();
const fixtureVariant = process.env.HR_UNIT7_FIXTURE_VARIANT === "immediate" ? "immediate" : "positive";
const fixtureKey = fixtureVariant === "immediate" ? "unit7-immediate-promotion-v1" : "unit7-positive-promotion-v1";
const employeeNumber = fixtureVariant === "immediate" ? "U7-IMMEDIATE-001" : "U7-POSITIVE-001";
const relationshipRef = fixtureVariant === "immediate" ? "WR-U7-IMMEDIATE-001" : "WR-U7-POSITIVE-001";
const employeeIdentity = fixtureVariant === "immediate"
  ? { legalFirstName: "UnitSeven", lastName: "Immediate Promotion", preferredName: "Unit Seven Immediate", preferredNotificationEmail: "sweetcathytelano+unit7immediate@gmail.com" }
  : { legalFirstName: "UnitSeven", lastName: "Positive Promotion", preferredName: "Unit Seven Positive", preferredNotificationEmail: "workingemail20266@gmail.com" };
const identityKeyHash = crypto.createHash("sha256").update(fixtureKey).digest("hex");
const effectiveFrom = new Date("2025-01-01T00:00:00.000Z");

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const managerUser = await prisma.hrUser.findFirstOrThrow({
    where: { organizationId: organization.id, email: "workingemail2026@icloud.com", status: "ACTIVE" },
    include: { employee: true },
  });
  if (!managerUser.employee) throw new Error("The governed staging manager needs an employee profile.");
  const position = await prisma.hrPosition.findFirstOrThrow({
    where: { organizationId: organization.id, status: "ACTIVE", jobProfileId: { not: null } },
    orderBy: [{ lifecycleStatus: "asc" }, { createdAt: "asc" }],
  });

  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.hrPerson.upsert({
      where: { organizationId_identityKeyHash: { organizationId: organization.id, identityKeyHash } },
      update: {}, create: { organizationId: organization.id, identityKeyHash },
    });
    let employee = await tx.hrEmployee.findFirst({ where: { organizationId: organization.id, personId: person.id } });
    if (!employee) employee = await tx.hrEmployee.create({ data: {
      organizationId: organization.id, personId: person.id, employeeNumber,
      ...employeeIdentity, employmentStatus: "ACTIVE",
      hireDate: effectiveFrom, startDate: effectiveFrom, workMode: "HYBRID",
    } });
    const relationship = await tx.hrWorkRelationship.upsert({
      where: { organizationId_relationshipRef: { organizationId: organization.id, relationshipRef } },
      update: {}, create: { organizationId: organization.id, personId: person.id, employeeId: employee.id, relationshipRef, status: "ACTIVE", startedAt: effectiveFrom },
    });
    let assignment = await tx.hrEmployeeAssignment.findFirst({ where: { organizationId: organization.id, employeeId: employee.id, status: "ACTIVE", isPrimary: true } });
    if (!assignment) assignment = await tx.hrEmployeeAssignment.create({ data: {
      organizationId: organization.id, employeeId: employee.id, departmentId: position.departmentId,
      teamId: position.teamId, positionId: position.id, employmentType: "FULL_TIME", effectiveFrom,
      status: "ACTIVE", reason: "Unit 7 clearly labeled staging validation fixture", createdById: managerUser.id,
      legalEntityId: position.legalEntityId, businessUnitId: position.businessUnitId, divisionId: position.divisionId,
      locationId: position.locationId, costCenterId: position.costCenterId, isPrimary: true,
      placementSnapshot: { fixture: fixtureKey, governedValidation: true },
    } });
    let supervisor = await tx.hrSupervisorAssignment.findFirst({ where: { organizationId: organization.id, assignedEmployeeId: employee.id, supervisorEmployeeId: managerUser.employee.id, status: "ACTIVE" } });
    if (!supervisor) supervisor = await tx.hrSupervisorAssignment.create({ data: {
      organizationId: organization.id, assignedEmployeeId: employee.id, supervisorEmployeeId: managerUser.employee.id,
      assignmentType: "DIRECT_REPORT", status: "ACTIVE", effectiveFrom,
      capabilities: { performance: true, stagingFixture: fixtureKey }, assignedByUserId: managerUser.id,
      reason: "Unit 7 clearly labeled staging validation fixture",
    } });
    return { person, employee, relationship, assignment, supervisor };
  }, { isolationLevel: "Serializable" });

  console.log(JSON.stringify({ database: databaseUrl.pathname.slice(1), fixtureKey, employeeId: result.employee.id, personId: result.person.id, workRelationshipId: result.relationship.id, assignmentId: result.assignment.id, supervisorAssignmentId: result.supervisor.id, result: "READY" }, null, 2));
} finally {
  await prisma.$disconnect();
}
