import { PrismaClient } from "@prisma/client";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT5_STAGING_CONCURRENCY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Unit 5 concurrency validation: explicit staging confirmation and zentric_analytics_staging are required.");

const prisma = new PrismaClient();
const run = `unit5-concurrency-${Date.now()}`;
const fixtureOffset = Date.now() % (300 * 86_400_000);
const periodStart = new Date(Date.UTC(2090, 0, 1) + fixtureOffset);
const periodEnd = new Date(periodStart.getTime() + 86_400_000);

function isSerializableConflict(error) {
  return error?.code === "P2034" || (error?.code === "P2010" && error?.meta?.code === "40001");
}

async function postReservation(accountPeriodId, organizationId, policyId, unit, sourceId, amount) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
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
    } catch (error) {
      if (isSerializableConflict(error) && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Serializable reservation retry budget exhausted.");
}

async function postConcurrentDelta({ accountPeriodId, organizationId, policyId, unit, sourceId, kind, amount, field, impactSign = 1 }) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
        const idempotencyKey = `${run}:${kind.toLowerCase()}:${sourceId}`;
        if (await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } })) return { applied: false, reason: "duplicate" };
        await tx.hrLeaveAccountPeriod.update({ where: { id: accountPeriodId }, data: { [field]: { increment: amount * impactSign }, version: { increment: 1 } } });
        await tx.hrLeaveLedgerEntry.create({ data: { organizationId, accountPeriodId, leavePolicyId: policyId, kind, amount, impactSign, unit, effectiveAt: new Date(), sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId, reason: run, correlationId: `${run}:${sourceId}`, idempotencyKey } });
        return { applied: true };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isSerializableConflict(error) && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Serializable delta retry budget exhausted.");
}

async function expireUnreservedCarryover({ accountPeriodId, organizationId, policyId, unit, sourceId }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "HrLeaveAccountPeriod" WHERE id = ${accountPeriodId} FOR UPDATE`;
    const period = await tx.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: accountPeriodId } });
    const spendable = Math.max(0, Number(period.granted) + Number(period.accrued) + Number(period.carriedOver) + Number(period.adjusted) - Number(period.carriedOut) - Number(period.reserved) - Number(period.consumed) - Number(period.expired));
    if (!spendable) return { applied: false, reason: "protected-or-empty" };
    const idempotencyKey = `${run}:expiry:${sourceId}`;
    if (await tx.hrLeaveLedgerEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } } })) return { applied: false, reason: "duplicate" };
    await tx.hrLeaveAccountPeriod.update({ where: { id: accountPeriodId }, data: { expired: { increment: spendable }, version: { increment: 1 } } });
    await tx.hrLeaveLedgerEntry.create({ data: { organizationId, accountPeriodId, leavePolicyId: policyId, kind: "EXPIRY", amount: spendable, unit, effectiveAt: new Date(), sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId, reason: run, correlationId: `${run}:${sourceId}`, idempotencyKey } });
    return { applied: true, amount: spendable };
  }, { isolationLevel: "Serializable" });
}

try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const employee = await prisma.hrEmployee.findFirstOrThrow({ where: { organizationId: organization.id, employmentStatus: "ACTIVE" }, select: { id: true } });
  const leaveType = await prisma.hrLeaveType.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "UNIT5_CONCURRENCY" } },
    update: { status: "ACTIVE" },
    create: { organizationId: organization.id, code: "UNIT5_CONCURRENCY", name: "Unit 5 Concurrency Fixture", unit: "DAYS" },
  });
  const policy = await prisma.hrLeavePolicy.upsert({
    where: { organizationId_leaveTypeId_version: { organizationId: organization.id, leaveTypeId: leaveType.id, version: 1 } },
    update: { status: "ACTIVE" },
    create: { organizationId: organization.id, leaveTypeId: leaveType.id, name: "Unit 5 Concurrency Fixture", version: 1, entitlement: 10, effectiveFrom: new Date(Date.UTC(2000, 0, 1)), entitlementModel: "ENTITLEMENT" },
    include: { leaveType: true },
  });
  const account = await prisma.hrLeaveAccount.upsert({ where: { organizationId_employeeId_leaveTypeId_unit: { organizationId: organization.id, employeeId: employee.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } }, update: {}, create: { organizationId: organization.id, employeeId: employee.id, leaveTypeId: policy.leaveTypeId, unit: policy.leaveType.unit } });
  const period = await prisma.hrLeaveAccountPeriod.upsert({ where: { accountId_periodStart_periodEnd: { accountId: account.id, periodStart, periodEnd } }, update: {}, create: { accountId: account.id, leavePolicyId: policy.id, periodStart, periodEnd } });
  await prisma.$transaction(async (tx) => {
    await tx.hrLeaveAccountPeriod.update({ where: { id: period.id }, data: { granted: 10, accrued: 0, carriedOver: 0, carriedOut: 0, adjusted: 0, reserved: 0, consumed: 0, expired: 0 } });
    await tx.hrLeaveLedgerEntry.create({ data: { organizationId: organization.id, accountPeriodId: period.id, leavePolicyId: policy.id, kind: "GRANT", amount: 10, unit: policy.leaveType.unit, effectiveAt: periodStart, sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId: run, reason: run, correlationId: run, idempotencyKey: `${run}:grant` } });
  });

  const competing = await Promise.allSettled([postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "approval-a", 7), postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "approval-b", 7)]);
  const winners = competing.filter((item) => item.status === "fulfilled" && item.value.applied).length;
  const losers = competing.length - winners;
  const losingDisposition = competing.find((item) => !(item.status === "fulfilled" && item.value.applied));
  if (winners !== 1 || losers !== 1) throw new Error(`Competing approvals were not deterministic: winners=${winners}, losers=${losers}.`);

  const duplicate = await Promise.allSettled([postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "duplicate", 2), postReservation(period.id, organization.id, policy.id, policy.leaveType.unit, "duplicate", 2)]);
  const duplicateEntries = await prisma.hrLeaveLedgerEntry.count({ where: { organizationId: organization.id, accountPeriodId: period.id, idempotencyKey: `${run}:reservation:duplicate` } });
  const after = await prisma.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: period.id }, include: { entries: { where: { sourceType: "UNIT5_CONCURRENCY_FIXTURE" } } } });
  const ledgerReserved = after.entries.filter(({ kind }) => kind === "RESERVATION").reduce((sum, entry) => sum + Number(entry.amount), 0);
  if (duplicateEntries !== 1 || Number(after.reserved) !== ledgerReserved || Number(after.reserved) !== 9) throw new Error("Duplicate reservation or projection divergence detected.");

  const makePeriod = async (label, offsetDays, values) => prisma.hrLeaveAccountPeriod.create({ data: { accountId: account.id, leavePolicyId: policy.id, periodStart: new Date(periodStart.getTime() + offsetDays * 86_400_000), periodEnd: new Date(periodEnd.getTime() + offsetDays * 86_400_000), ...values } });

  const decisionPeriod = await makePeriod("approval-cancellation", 10, { granted: 2, reserved: 2 });
  const expectedDecisionVersion = decisionPeriod.version;
  const decide = async (decision) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const claimed = await tx.hrLeaveAccountPeriod.updateMany({ where: { id: decisionPeriod.id, version: expectedDecisionVersion }, data: { version: { increment: 1 }, ...(decision === "CANCELLED" ? { reserved: { decrement: 2 } } : {}) } });
          if (claimed.count !== 1) return { applied: false, reason: "stale-version" };
          if (decision === "CANCELLED") await tx.hrLeaveLedgerEntry.create({ data: { organizationId: organization.id, accountPeriodId: decisionPeriod.id, leavePolicyId: policy.id, kind: "RESERVATION_RELEASE", amount: 2, unit: policy.leaveType.unit, effectiveAt: new Date(), sourceType: "UNIT5_CONCURRENCY_FIXTURE", sourceId: `${run}:approval-cancellation`, reason: run, correlationId: `${run}:approval-cancellation`, idempotencyKey: `${run}:approval-cancellation:cancelled` } });
          return { applied: true, decision };
        }, { isolationLevel: "Serializable" });
      } catch (error) {
        if (isSerializableConflict(error) && attempt < 3) continue;
        throw error;
      }
    }
    throw new Error("Approval versus cancellation retry budget exhausted.");
  };
  const approvalCancellation = await Promise.all([decide("APPROVED"), decide("CANCELLED")]);
  if (approvalCancellation.filter(({ applied }) => applied).length !== 1 || approvalCancellation.filter(({ reason }) => reason === "stale-version").length !== 1) throw new Error("Approval versus cancellation did not produce one winner and one stale loser.");

  const adjustmentPeriod = await makePeriod("approval-adjustment", 20, { granted: 10 });
  const approvalAdjustment = await Promise.all([
    postReservation(adjustmentPeriod.id, organization.id, policy.id, policy.leaveType.unit, "approval-adjustment-reservation", 3),
    postConcurrentDelta({ accountPeriodId: adjustmentPeriod.id, organizationId: organization.id, policyId: policy.id, unit: policy.leaveType.unit, sourceId: "approval-adjustment-delta", kind: "ADJUSTMENT", amount: 2, field: "adjusted" }),
  ]);
  const adjustmentAfter = await prisma.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: adjustmentPeriod.id } });
  if (approvalAdjustment.some(({ applied }) => !applied) || Number(adjustmentAfter.reserved) !== 3 || Number(adjustmentAfter.adjusted) !== 2) throw new Error("Approval versus adjustment diverged.");

  const accrualPeriod = await makePeriod("accrual-approval", 30, { granted: 10 });
  const accrualApproval = await Promise.all([
    postReservation(accrualPeriod.id, organization.id, policy.id, policy.leaveType.unit, "accrual-approval-reservation", 4),
    postConcurrentDelta({ accountPeriodId: accrualPeriod.id, organizationId: organization.id, policyId: policy.id, unit: policy.leaveType.unit, sourceId: "accrual-approval-delta", kind: "ACCRUAL", amount: 2, field: "accrued" }),
  ]);
  const accrualAfter = await prisma.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: accrualPeriod.id } });
  if (accrualApproval.some(({ applied }) => !applied) || Number(accrualAfter.reserved) !== 4 || Number(accrualAfter.accrued) !== 2) throw new Error("Accrual versus approval diverged.");

  const expiryPeriod = await makePeriod("expiry-approval", 40, { carriedOver: 5 });
  const expiryApproval = await Promise.allSettled([
    postReservation(expiryPeriod.id, organization.id, policy.id, policy.leaveType.unit, "expiry-approval-reservation", 4),
    expireUnreservedCarryover({ accountPeriodId: expiryPeriod.id, organizationId: organization.id, policyId: policy.id, unit: policy.leaveType.unit, sourceId: "expiry-approval-expiry" }),
  ]);
  const expiryAfter = await prisma.hrLeaveAccountPeriod.findUniqueOrThrow({ where: { id: expiryPeriod.id } });
  if (Number(expiryAfter.reserved) + Number(expiryAfter.expired) > 5 || expiryApproval.every(({ status }) => status === "rejected")) throw new Error("Carryover expiry failed to protect an approved reservation.");

  console.log(JSON.stringify({ run, database: databaseUrl.pathname.slice(1), organizationId: organization.id, accountPeriodId: period.id, policyId: policy.id, competing: { winners, losers, losingDisposition: losingDisposition?.status === "rejected" ? (losingDisposition.reason?.code ?? "REJECTED") : losingDisposition?.value.reason }, duplicate: { attempts: duplicate.length, entries: duplicateEntries }, projection: { reserved: Number(after.reserved), ledgerReserved, version: after.version }, matrix: { approvalCancellation, approvalAdjustment: { reserved: Number(adjustmentAfter.reserved), adjusted: Number(adjustmentAfter.adjusted) }, accrualApproval: { reserved: Number(accrualAfter.reserved), accrued: Number(accrualAfter.accrued) }, expiryApproval: { reserved: Number(expiryAfter.reserved), expired: Number(expiryAfter.expired) } }, result: "PASS" }, null, 2));
} finally {
  await prisma.$disconnect();
}
