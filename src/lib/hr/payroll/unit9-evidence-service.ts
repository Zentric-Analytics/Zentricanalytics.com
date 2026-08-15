import type { PrismaClient } from "@prisma/client";

export const unit9EvidenceKinds = ["bik", "relief", "prior-ytd", "rta", "pension", "statutory-applicability", "retention"] as const;
export type Unit9EvidenceKind = (typeof unit9EvidenceKinds)[number];

type EvidenceDb = Pick<PrismaClient,
  | "hrPayrollBikEvidenceVersion"
  | "hrPayrollTaxReliefClaimVersion"
  | "hrPayrollPriorEmployerYtdVersion"
  | "hrPayrollEmployeeRtaProfileVersion"
  | "hrPayrollPensionProfileVersion"
  | "hrPayrollStatutoryApplicabilityVersion"
  | "hrPayrollRetentionPolicyVersion"
>;

const common = { id: true, organizationId: true, version: true, correlationId: true, createdAt: true } as const;

export async function readUnit9Evidence(db: EvidenceDb, organizationId: string, kind: Unit9EvidenceKind, id: string) {
  switch (kind) {
    case "bik": return db.hrPayrollBikEvidenceVersion.findFirst({ where: { id, organizationId }, select: { ...common, employeeId: true, code: true, valuationMethod: true, taxableTreatment: true, taxableValue: true, sourceRuleId: true, evidenceReference: true, effectiveFrom: true, effectiveTo: true, supersedesId: true } });
    case "relief": return db.hrPayrollTaxReliefClaimVersion.findFirst({ where: { id, organizationId }, select: { ...common, employeeId: true, taxYear: true, claimType: true, claimedAmount: true, eligibleAmount: true, ytdUtilized: true, electionRecorded: true, evidenceReference: true, remittanceStatus: true, sourceRuleId: true, status: true, effectiveFrom: true, supersedesId: true } });
    case "prior-ytd": return db.hrPayrollPriorEmployerYtdVersion.findFirst({ where: { id, organizationId }, select: { ...common, employeeId: true, taxYear: true, priorEmployerReference: true, gross: true, eligibleDeductions: true, taxableIncome: true, payeDeducted: true, payeRepaid: true, handling: true, evidenceReference: true, rtaApprovalReference: true, supersedesId: true } });
    case "rta": return db.hrPayrollEmployeeRtaProfileVersion.findFirst({ where: { id, organizationId }, select: { ...common, employeeId: true, taxYear: true, residenceStateOrFct: true, rtaCode: true, adapterVersion: true, priorYtdRequirement: true, effectiveFrom: true, effectiveTo: true, supersedesId: true } });
    case "pension": return db.hrPayrollPensionProfileVersion.findFirst({ where: { id, organizationId }, select: { ...common, employeeId: true, applicability: true, coverageReason: true, exemptionReason: true, pfaCode: true, contributionRuleVersion: true, effectiveFrom: true, effectiveTo: true, supersedesId: true } });
    case "statutory-applicability": return db.hrPayrollStatutoryApplicabilityVersion.findFirst({ where: { id, organizationId }, select: { ...common, legalEntityId: true, schemeCode: true, state: true, reason: true, evidenceReference: true, effectiveFrom: true, effectiveTo: true, supersedesId: true } });
    case "retention": return db.hrPayrollRetentionPolicyVersion.findFirst({ where: { id, organizationId }, select: { ...common, recordCategory: true, minimumYears: true, holdType: true, holdUntil: true, reason: true, effectiveFrom: true, supersedesId: true } });
  }
}
