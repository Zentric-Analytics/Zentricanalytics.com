import { Prisma } from "@prisma/client";
import { roundPayroll, type PayrollLine, type Unit9Money } from "./unit9-domain";
import { calculateDeductions, calculateEarnings, calculateEmployerContributions, calculationManifest, payrollRisk, type FrozenPayrollManifest } from "./unit9-engine";
import { assertNg2026_5Decision, calculateNg2026_5Paye, classifyNg2026_5Earning, NG_2026_5_VERSION, type Ng2026_5MinimumWageEvidence } from "./nigeria-2026-5";

export type Candidate2026_5Manifest = Omit<FrozenPayrollManifest, "paye"> & {
  employeeId: string;
  workRelationshipId: string;
  payrollPeriodId: string;
  minimumWageEvidence: Ng2026_5MinimumWageEvidence;
  expectedMinimumWageDecisionHash: string;
  paye: FrozenPayrollManifest["paye"] & { bonusPaidTaxYearToDate?: Unit9Money; priorEmployerIncome?: Unit9Money; priorEmployerPaye?: Unit9Money; priorEmployerEvidenceVerified?: boolean };
};

export function evaluateFrozenNg2026_5Eligibility(manifest: Candidate2026_5Manifest) {
  const decision = assertNg2026_5Decision(manifest.minimumWageEvidence, manifest.expectedMinimumWageDecisionHash);
  if (manifest.employeeId !== manifest.minimumWageEvidence.employeeId || manifest.workRelationshipId !== manifest.minimumWageEvidence.workRelationshipId || manifest.payrollPeriodId !== manifest.minimumWageEvidence.payrollPeriodId) throw new Error("MINIMUM_WAGE_EVIDENCE_IDENTITY_MISMATCH");
  return decision;
}

export function calculateFrozenPayroll2026_5(manifest: Candidate2026_5Manifest, snapshotHash: string) {
  if (manifest.jurisdictionVersion !== NG_2026_5_VERSION) throw new Error("NG_2026_5_CANDIDATE_REQUIRED");
  const minimumWageDecision = evaluateFrozenNg2026_5Eligibility(manifest);
  for (const earning of manifest.earnings) classifyNg2026_5Earning(earning.code);
  if (manifest.paye.expectedAnnualEmploymentIncome === undefined || manifest.paye.eligibleAnnualDeductions === undefined || manifest.paye.periodsElapsed === undefined || manifest.paye.periodsInTaxYear === undefined || manifest.paye.currentNonPeriodicPayments === undefined) throw new Error("NG_2026_5_REPRODUCIBILITY_BLOCKER");
  const earnings = calculateEarnings(manifest.earnings);
  const deductions = calculateDeductions(manifest.deductions ?? []);
  const contributions = calculateEmployerContributions(manifest.employerContributions ?? []);
  const adjustments = (manifest.adjustments ?? []).map((line, sequence) => {
    if (!line.reason.trim() || line.createdById === line.approvedById) throw new Error(`Adjustment ${line.code} requires a reason and independent approval.`);
    return { ...line, sequence, amount: roundPayroll(line.amount) };
  });
  const gross = earnings.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const taxableIncome = earnings.filter((line) => Boolean(line.taxableBaseCode)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const paye = calculateNg2026_5Paye({ expectedAnnualSalary: manifest.paye.expectedAnnualEmploymentIncome, bonusPaidTaxYearToDate: manifest.paye.bonusPaidTaxYearToDate ?? "0", currentBonus: manifest.paye.currentNonPeriodicPayments, eligibleAnnualDeductions: manifest.paye.eligibleAnnualDeductions, periodsElapsed: manifest.paye.periodsElapsed, periodsInTaxYear: manifest.paye.periodsInTaxYear, currentEmployerPayeDeducted: manifest.paye.priorYtdPaye, currentEmployerPayeRepaid: manifest.paye.priorPayeRepaid ?? "0", priorEmployerIncome: manifest.paye.priorEmployerIncome, priorEmployerPaye: manifest.paye.priorEmployerPaye, priorEmployerEvidenceVerified: manifest.paye.priorEmployerEvidenceVerified }, minimumWageDecision);
  const employeeDeductions = deductions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const employerContributions = contributions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const adjustmentTotal = adjustments.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const lines: PayrollLine[] = [...earnings.map((line) => ({ code: line.code, category: "EARNING" as const, amount: line.amount })), { code: "PAYE_BASE", category: "TAXABLE_BASE", amount: taxableIncome }, { code: paye.currentPaye.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE", category: "PAYE", amount: paye.currentPaye }, ...deductions.map((line) => ({ code: line.code, category: "EMPLOYEE_DEDUCTION" as const, amount: line.amount })), ...contributions.map((line) => ({ code: line.code, category: "EMPLOYER_CONTRIBUTION" as const, amount: line.amount })), ...adjustments.map((line) => ({ code: line.code, category: "ADJUSTMENT" as const, amount: line.amount }))];
  const calculated = calculationManifest({ snapshotHash, jurisdictionVersion: NG_2026_5_VERSION, engineVersion: manifest.engineVersion, sources: { earnings: manifest.earnings.map((line) => line.sourceId), deductions: (manifest.deductions ?? []).map((line) => line.sourceId), contributions: (manifest.employerContributions ?? []).map((line) => line.sourceId), minimumWageEvidence: minimumWageDecision.evidenceReferences }, ruleVersions: [NG_2026_5_VERSION, minimumWageDecision.grossEmploymentIncomeFacts.inputCertificationVersion, ...manifest.earnings.map((line) => line.ruleVersionReference)], lines });
  const risks = payrollRisk({ gross, net: calculated.output.net, paye: paye.currentPaye, manualAdjustment: adjustmentTotal, ...manifest.riskContext });
  return { ...calculated, gross: roundPayroll(gross), taxableIncome: roundPayroll(taxableIncome), paye: { ...paye, ruleVersion: NG_2026_5_VERSION, trace: [{ minimumWageDecisionHash: minimumWageDecision.decisionHash, classification: minimumWageDecision.classification }] }, employeeDeductions: roundPayroll(employeeDeductions), employerContributions: roundPayroll(employerContributions), adjustments: roundPayroll(adjustmentTotal), earnings, deductions, contributions, adjustmentLines: adjustments, risks, minimumWageDecision, frozenManifest: { minimumWageEvidence: manifest.minimumWageEvidence, minimumWageDecision, payePath: minimumWageDecision.classification } };
}
