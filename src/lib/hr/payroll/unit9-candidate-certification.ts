import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

export const PAYROLL_CANDIDATE_NOT_CERTIFIED = "PAYROLL_CANDIDATE_NOT_CERTIFIED";
export const PAYROLL_CANDIDATE_VERSION_MISMATCH = "PAYROLL_CANDIDATE_VERSION_MISMATCH";
export const PAYROLL_CANDIDATE_MANIFEST_INVALID = "PAYROLL_CANDIDATE_MANIFEST_INVALID";

export type PayrollCandidateCertification = {
  candidateVersion: string;
  certificationStatus: "CERTIFIED" | "NOT_CERTIFIED";
  certifiedAt: Date | null;
  ruleHash: string;
};

function parseCandidateManifest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  const manifest = value as Record<string, unknown>;
  const candidateVersion = manifest.candidateVersion;
  const certificationStatus = manifest.certification;
  if (typeof candidateVersion !== "string" || !/^NG-CANDIDATE-\d{4}\.\d+$/.test(candidateVersion)) throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  if (certificationStatus !== "CERTIFIED" && certificationStatus !== "NOT_CERTIFIED") throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  return { candidateVersion, certificationStatus } as const;
}

export async function resolvePayrollCandidateCertification(db: Db, organizationId: string, runId: string): Promise<PayrollCandidateCertification> {
  const run = await db.hrPayrollAuthoritativeRun.findFirst({ where: { id: runId, organizationId } });
  if (!run) throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  const jurisdiction = await db.hrPayrollJurisdictionVersion.findFirst({ where: { id: run.jurisdictionVersionId, organizationId } });
  if (!jurisdiction || !jurisdiction.ruleHash || !(run.createdAt instanceof Date) || !(jurisdiction.effectiveFrom instanceof Date)) throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  const parsed = parseCandidateManifest(jurisdiction.ruleManifest);
  const snapshots = await db.hrPayrollInputSnapshot.findMany({ where: { organizationId, payrollRunId: run.id }, select: { sourceManifest: true } });
  if (!snapshots.length) throw new Error(PAYROLL_CANDIDATE_VERSION_MISMATCH);
  const snapshotVersions = new Set(snapshots.map((snapshot) => {
    const manifest = snapshot.sourceManifest;
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error(PAYROLL_CANDIDATE_VERSION_MISMATCH);
    const version = (manifest as Record<string, unknown>).jurisdictionVersion;
    if (typeof version !== "string") throw new Error(PAYROLL_CANDIDATE_VERSION_MISMATCH);
    return version;
  }));
  if (snapshotVersions.size !== 1 || !snapshotVersions.has(parsed.candidateVersion)) throw new Error(PAYROLL_CANDIDATE_VERSION_MISMATCH);
  if (parsed.certificationStatus === "CERTIFIED" && (!jurisdiction.certifiedAt || !["CERTIFIED", "ACTIVE"].includes(jurisdiction.status) || jurisdiction.certifiedAt > run.createdAt || jurisdiction.effectiveFrom > run.createdAt || (jurisdiction.effectiveTo && jurisdiction.effectiveTo < run.createdAt))) throw new Error(PAYROLL_CANDIDATE_MANIFEST_INVALID);
  return { ...parsed, certifiedAt: jurisdiction.certifiedAt, ruleHash: jurisdiction.ruleHash };
}

export async function assertOfficialPayrollCandidateCertified(db: Db, organizationId: string, runId: string) {
  const certification = await resolvePayrollCandidateCertification(db, organizationId, runId);
  if (certification.certificationStatus !== "CERTIFIED") throw new Error(PAYROLL_CANDIDATE_NOT_CERTIFIED);
  return certification;
}
