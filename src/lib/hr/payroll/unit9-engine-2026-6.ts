import { Prisma } from "@prisma/client";
import { roundPayroll, type PayrollLine, type Unit9Money } from "./unit9-domain";
import { calculateDeductions, calculateEarnings, calculateEmployerContributions, calculationManifest, payrollRisk, type FrozenPayrollManifest } from "./unit9-engine";
import { assertNg2026_6Binding, calculateNg2026_6Paye, NG_2026_6_ACTIVE_EARNINGS, NG_2026_6_VERSION, type Ng2026_6AuthoritativeFacts, type Ng2026_6IncomeEvidence } from "./nigeria-2026-6";

export type Candidate2026_6Manifest = Omit<FrozenPayrollManifest, "paye"> & {
  employeeId: string; workRelationshipId: string; payrollPeriodId: string;
  incomeEvidence: Ng2026_6IncomeEvidence; authoritativeIncomeFacts: Ng2026_6AuthoritativeFacts;
  expectedEmploymentIncomeBindingHash?: string; expectedMinimumWageDecisionHash?: string;
  paye: FrozenPayrollManifest["paye"] & { priorBonusPaidTaxYearToDate: Unit9Money; priorEmployerIncome: Unit9Money; priorEmployerPaye: Unit9Money };
};

const sumCode = (manifest: Candidate2026_6Manifest, code: string) => calculateEarnings(manifest.earnings.filter((line) => line.code === code)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

export function deriveFrozenNg2026_6Binding(manifest: Candidate2026_6Manifest) {
  if (manifest.jurisdictionVersion !== NG_2026_6_VERSION) throw new Error("NG_2026_6_CANDIDATE_REQUIRED");
  if (manifest.employeeId !== manifest.incomeEvidence.employeeId || manifest.workRelationshipId !== manifest.incomeEvidence.workRelationshipId || manifest.payrollPeriodId !== manifest.incomeEvidence.payrollPeriodId) throw new Error("EMPLOYMENT_INCOME_BINDING_IDENTITY_MISMATCH");
  for (const earning of manifest.earnings) if (!(NG_2026_6_ACTIVE_EARNINGS as readonly string[]).includes(earning.code)) throw new Error(`UNSUPPORTED_ORDINARY_EARNING:${earning.code}`);
  if (!manifest.earnings.some((line) => line.code === "SALARY")) throw new Error("PAYROLL_INCOME_BINDING_MISMATCH:SALARY_REQUIRED");
  const paye = manifest.paye;
  if (paye.expectedAnnualEmploymentIncome === undefined || paye.eligibleAnnualDeductions === undefined || paye.periodsElapsed === undefined || paye.periodsInTaxYear === undefined || paye.currentNonPeriodicPayments === undefined || paye.priorPayeRepaid === undefined) throw new Error("NG_2026_6_REPRODUCIBILITY_BLOCKER");
  return assertNg2026_6Binding({ evidence: manifest.incomeEvidence, actualSalary: sumCode(manifest, "SALARY"), actualBonus: sumCode(manifest, "BONUS"), payeCurrentBonus: paye.currentNonPeriodicPayments, payeExpectedAnnualSalary: paye.expectedAnnualEmploymentIncome, payePriorBonusPaidTaxYearToDate: paye.priorBonusPaidTaxYearToDate, payeCurrentEmployerPayeDeducted: paye.priorYtdPaye, payeCurrentEmployerPayeRepaid: paye.priorPayeRepaid, payePriorEmployerIncome: paye.priorEmployerIncome, payePriorEmployerPaye: paye.priorEmployerPaye, periodsElapsed: paye.periodsElapsed, periodsInTaxYear: paye.periodsInTaxYear, eligibleAnnualDeductions: paye.eligibleAnnualDeductions, authoritative: manifest.authoritativeIncomeFacts }, manifest.expectedEmploymentIncomeBindingHash, manifest.expectedMinimumWageDecisionHash);
}

export function calculateFrozenPayroll2026_6(manifest: Candidate2026_6Manifest, snapshotHash: string) {
  const binding = deriveFrozenNg2026_6Binding(manifest);
  const earnings = calculateEarnings(manifest.earnings); const deductions = calculateDeductions(manifest.deductions ?? []); const contributions = calculateEmployerContributions(manifest.employerContributions ?? []);
  const adjustments = (manifest.adjustments ?? []).map((line, sequence) => { if (!line.reason.trim() || line.createdById === line.approvedById) throw new Error(`Adjustment ${line.code} requires a reason and independent approval.`); return { ...line, sequence, amount: roundPayroll(line.amount) }; });
  const gross = earnings.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const taxableIncome = earnings.filter((line) => Boolean(line.taxableBaseCode)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const paye = calculateNg2026_6Paye(binding);
  const employeeDeductions = deductions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0)); const employerContributions = contributions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0)); const adjustmentTotal = adjustments.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const lines: PayrollLine[] = [...earnings.map((line) => ({ code: line.code, category: "EARNING" as const, amount: line.amount })), { code: "PAYE_BASE", category: "TAXABLE_BASE", amount: taxableIncome }, { code: paye.currentPaye.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE", category: "PAYE", amount: paye.currentPaye }, ...deductions.map((line) => ({ code: line.code, category: "EMPLOYEE_DEDUCTION" as const, amount: line.amount })), ...contributions.map((line) => ({ code: line.code, category: "EMPLOYER_CONTRIBUTION" as const, amount: line.amount })), ...adjustments.map((line) => ({ code: line.code, category: "ADJUSTMENT" as const, amount: line.amount }))];
  const calculated = calculationManifest({ snapshotHash, jurisdictionVersion: NG_2026_6_VERSION, engineVersion: manifest.engineVersion, sources: { earnings: manifest.earnings.map((line) => line.sourceId), deductions: (manifest.deductions ?? []).map((line) => line.sourceId), contributions: (manifest.employerContributions ?? []).map((line) => line.sourceId), incomeEvidence: binding.evidenceReferences }, ruleVersions: [NG_2026_6_VERSION, binding.inputCertificationVersion, ...manifest.earnings.map((line) => line.ruleVersionReference)], lines });
  const risks = payrollRisk({ gross, net: calculated.output.net, paye: paye.currentPaye, manualAdjustment: adjustmentTotal, ...manifest.riskContext });
  return { ...calculated, gross: roundPayroll(gross), taxableIncome: roundPayroll(taxableIncome), paye: { ...paye, ruleVersion: NG_2026_6_VERSION, trace: [{ employmentIncomeBindingHash: binding.employmentIncomeBindingHash, minimumWageDecisionHash: binding.decision.decisionHash, classification: binding.decision.classification }] }, employeeDeductions: roundPayroll(employeeDeductions), employerContributions: roundPayroll(employerContributions), adjustments: roundPayroll(adjustmentTotal), earnings, deductions, contributions, adjustmentLines: adjustments, risks, employmentIncomeBinding: binding, minimumWageDecision: binding.decision, frozenManifest: { employmentIncomeBinding: binding, payePath: binding.decision.classification } };
}
