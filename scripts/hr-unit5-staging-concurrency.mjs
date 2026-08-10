import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT5_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Unit 5 concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");

const prisma = new PrismaClient();
const run = `unit5-concurrency-${Date.now()}`;
const year = 2090 + new Date().getUTCFullYear() % 5;
const periodStart = new Date(Date.UTC(year, 0, 1));
const periodEnd = new Date(Date.UTC(year + 1, 0, 1));

async function postReservation(accountPeriodId, organizationId, policyId, unit, sourceId, amount) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
    const existing = await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: `${run}:reservation:${sourceId}` } } });
    if (existing) return { applied: false, reason: "duplicate" };
    const period = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: accountPeriodId } });
    const available = Number(period.granted) + Number(period.accrued) + Number(period.carriedOver) + Number(period.adjusted) - Number(period.carriedOut) - Number(period.reserved) - Number(period.consumed) - Number(period.expired);
    if (available < amount) throw new Error("insufficient-authoritative-balance");
    await tx.hrLeaveAccountPeriod.update({ where: { id: accountPeriodId }, data: { reserved: { increment: amount }, version: { increment: 1 } } });
    await tx.hrLeaveLedgerEntry.create({ data: { organizationId, accountPeriodId, leavePolicyId: policyId, kind: "RESERVATION", amount, unit, effectiveAt: new Date(), sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId, reason: run, correlationId: `${run}:${sourceId}`, idempotencyKey: `${run}:reservation:${sourceId}` } });
    return { applied: true };
  }, { isolationLevel: "Serializable" });
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { organizationId: organization.id, employmentStatus: "ACTIVE" }, select: { id: true } });
  const policy = await prisma.hrLeavePolicy.findFirstOrThrow({ where: { organizationId: organization.id, status: "ACTIVE", entitlementModel: "ENTITLEMENT" }, include: { leaveType: true }, orderBy: { version: "desc" } });
  const account = await prisma.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: organization.id, employeeId: employee.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } }, update: {}, create: { organizationId: organization.id, employeeId: employee.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } });
  const period = await prisma.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: policy.id, periodStart, periodEnd } });
  await prisma.$transaction(async (tx) => {
    await tx.hrLeaveLedgerEntry.deleteMany({ where: { organizationId: organization.id, accountPeriodId: period.id, sourceType: "UNIT5_CONCURRENCY_FIXTURE" } });
    await tx.hrLeaveAccountPeriod.update({ where: { id: period.id }, data: { granted: 10, accrued: 0, carriedOver: 0, carriedOut: 0, adjusted: 0, reserved: 0, consumed: 0, expired: 0 } });
    await tx.hrLeaveLedgerEntry.create({ data: { organizationId: organization.id, accountPeriodId: period.id, leavePolicyId: policy.id, kind: "GRANT", amount: 10, unit: policy.leaveType.unit, effectiveAt: periodStart, sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId: run, reason: run, correlationId: run, idempotencyKey: `${run}:grant` } });
  });

  const competing = await Promise.allSettled([postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "approval-a", 7), postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "approval-b", 7)]);
  const winners = competing.filter((item) => item.status === "fulfilled" && item.value.applied).length;
  const losers = competing.filter((item) => item.status === "rejected" && String(item.reason).includes("insufficient-authoritative-balance")).length;
  if (winners !== 1 || losers !== 1) throw new Error(`Competing approvals were not deterministic: winners=${winners}, losers=${losers}.`);

  const duplicate = await Promise.allSettled([postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "duplicate", 2), postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "duplicate", 2)]);
  const duplicateEntries = await prisma.hrLeaveLedgerEntry.count({ where: { organizationId: organization.id, accountPeriodId: period.id, idempotencyKey: `${run}:reservation:duplicate` } });
  const after = await prisma.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: period.id }, include: { entries: { where: { sourceType: "UNIT5_CONCURRENCY_FIXTURE" } } } });
  const ledgerReserved = after.entries.filter(({ kind }) => kind === "RESERVATION").reduce((sum, entry) => sum + Number(entry.amount), 0);
  if (duplicateEntries !== 1 || Number(after.reserved) !== ledgerReserved || Number(after.reserved) !== 9) throw new Error("Duplicate reservation or projection divergence detected.");

  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), organizationId: organization.id, accountPeriodId: period.id, policyId: policy.id, competing: { winners, losers }, duplicate: { attempts: duplicate.length, entries: duplicateEntries }, projection: { reserved: Number(after.reserved), ledgerReserved, version: after.version }, result: "PASS" }, null, 2));
} finally {
  await prisma.$disconnect();
}
