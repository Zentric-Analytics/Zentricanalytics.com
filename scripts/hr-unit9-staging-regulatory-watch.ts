import { PrismaClient } from "@prisma/client";
import { pollRegulatorySource } from "../src/lib/hr/payroll/unit9-regulatory-watch";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/missing");
if (process.env.HR_UNIT9_STAGING_REGULATORY_CONFIRM !== "staging-only" || databaseUrl.pathname.slice(1) !== "zentric_analytics_staging") throw new Error("Refusing Regulatory Watch validation outside the explicitly confirmed staging database.");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const prisma = new PrismaClient();
const marker = `unit9-regulatory-${Date.now()}`;
try {
  const organization = await prisma.hrOrganization.findFirstOrThrow({ select: { id: true } });
  const actor = await prisma.hrUser.findFirstOrThrow({ where: { organizationId: organization.id, status: "ACTIVE" }, select: { id: true } });
  const source = await prisma.hrPayrollRegulatorySource.create({ data: { organizationId: organization.id, jurisdictionCode: "NG", authorityName: "Nigeria Federal Inland Revenue Service — staging monitor fixture", sourceType: "OFFICIAL_WEB", url: `https://www.firs.gov.ng/${marker}`, approvedHost: "www.firs.gov.ng" } });
  const context = { organizationId: organization.id, userId: actor.id, role: "PAYROLL_COMPLIANCE" };
  const response = (body: string, status = 200) => Promise.resolve(new Response(body, { status, headers: { "content-type": "text/plain", "content-length": String(Buffer.byteLength(body)) } }));
  const first = await pollRegulatorySource(prisma, context, source.id, () => response("official-staging-fixture-v1"));
  assert(!first.changed && !first.candidateId, "Initial source fingerprint must not create a change candidate.");
  const unchanged = await pollRegulatorySource(prisma, context, source.id, () => response("official-staging-fixture-v1"));
  assert(!unchanged.changed && unchanged.hash === first.hash, "Unchanged source polling must be idempotent.");
  const changed = await pollRegulatorySource(prisma, context, source.id, () => response("official-staging-fixture-v2"));
  assert(changed.changed && changed.candidateId, "A changed official-source fingerprint must create one review candidate.");
  const replay = await pollRegulatorySource(prisma, context, source.id, () => response("official-staging-fixture-v2"));
  assert(!replay.changed, "The accepted fingerprint must be idempotent on replay.");
  assert(await prisma.hrPayrollRegulatoryChange.count({ where: { organizationId: organization.id, regulatorySourceId: source.id } }) === 1, "Regulatory change replay created a duplicate candidate.");
  const candidate = await prisma.hrPayrollRegulatoryChange.findUniqueOrThrow({ where: { id: changed.candidateId }, select: { status: true, proposedJurisdictionVersionId: true, correlationId: true } });
  assert(candidate.status === "REVIEW_REQUIRED" && !candidate.proposedJurisdictionVersionId, "Detected changes must remain review-only and cannot activate payroll rules.");
  let failureRecorded = false;
  try { await pollRegulatorySource(prisma, context, source.id, () => response("temporary upstream failure", 503)); } catch { failureRecorded = true; }
  assert(failureRecorded, "Upstream failures must fail closed.");
  const degraded = await prisma.hrPayrollRegulatorySource.findUniqueOrThrow({ where: { id: source.id }, select: { monitoringHealth: true } });
  assert(degraded.monitoringHealth === "DEGRADED", "Upstream failure must mark monitoring health degraded.");
  console.log(JSON.stringify({ result: "PASS", marker, sourceId: source.id, candidateId: changed.candidateId, correlationId: candidate.correlationId, unchangedReplay: true, changeCandidates: 1, autoActivation: false, degradedFailure: true }));
} finally {
  await prisma.$disconnect();
}
