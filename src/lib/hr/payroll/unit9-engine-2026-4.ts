import { Prisma } from "@prisma/client";
import { roundPayroll, type PayrollLine, type Unit9Money } from "./unit9-domain";
import {
  calculateDeductions,
  calculateEarnings,
  calculateEmployerContributions,
  calculationManifest,
  payrollRisk,
  type FrozenPayrollManifest,
} from "./unit9-engine";
import { calculateNg2026_4Paye, classifyNg2026_4Earning, NG_2026_4_VERSION } from "./nigeria-2026-4";

type Candidate2026_4Manifest = Omit<FrozenPayrollManifest, "paye"> & {
  paye: FrozenPayrollManifest["paye"] & {
    bonusPaidTaxYearToDate?: Unit9Money;
    priorEmployerIncome?: Unit9Money;
    priorEmployerPaye?: Unit9Money;
    priorEmployerEvidenceVerified?: boolean;
  };
};

export function calculateFrozenPayroll2026_4(manifest: Candidate2026_4Manifest, snapshotHash: string) {
  if (manifest.jurisdictionVersion !== NG_2026_4_VERSION) throw new Error("NG_2026_4_CANDIDATE_REQUIRED");
  for (const earning of manifest.earnings) classifyNg2026_4Earning(earning.code);
  if (manifest.paye.expectedAnnualEmploymentIncome === undefined || manifest.paye.eligibleAnnualDeductions === undefined || manifest.paye.periodsElapsed === undefined || manifest.paye.periodsInTaxYear === undefined || manifest.paye.currentNonPeriodicPayments === undefined) {
    throw new Error("NG_2026_4_REPRODUCIBILITY_BLOCKER: complete frozen Salary, Bonus and cumulative PAYE facts are required.");
  }

  const earnings = calculateEarnings(manifest.earnings);
  const deductions = calculateDeductions(manifest.deductions ?? []);
  const contributions = calculateEmployerContributions(manifest.employerContributions ?? []);
  const adjustments = (manifest.adjustments ?? []).map((line, sequence) => {
    if (!line.reason.trim() || line.createdById === line.approvedById) throw new Error(`Adjustment ${line.code} requires a reason and independent approval.`);
    return { ...line, sequence, amount: roundPayroll(line.amount) };
  });
  const gross = earnings.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const taxableIncome = earnings.filter((line) => Boolean(line.taxableBaseCode)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const paye = calculateNg2026_4Paye({
    expectedAnnualSalary: manifest.paye.expectedAnnualEmploymentIncome,
    bonusPaidTaxYearToDate: manifest.paye.bonusPaidTaxYearToDate ?? "0",
    currentBonus: manifest.paye.currentNonPeriodicPayments,
    eligibleAnnualDeductions: manifest.paye.eligibleAnnualDeductions,
    periodsElapsed: manifest.paye.periodsElapsed,
    periodsInTaxYear: manifest.paye.periodsInTaxYear,
    currentEmployerPayeDeducted: manifest.paye.priorYtdPaye,
    currentEmployerPayeRepaid: manifest.paye.priorPayeRepaid ?? "0",
    priorEmployerIncome: manifest.paye.priorEmployerIncome,
    priorEmployerPaye: manifest.paye.priorEmployerPaye,
    priorEmployerEvidenceVerified: manifest.paye.priorEmployerEvidenceVerified,
  });
  const lines: PayrollLine[] = [
    ...earnings.map((line) => ({ code: line.code, category: "EARNING" as const, amount: line.amount })),
    { code: "PAYE_BASE", category: "TAXABLE_BASE", amount: taxableIncome },
    { code: paye.currentPaye.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE", category: "PAYE", amount: paye.currentPaye },
    ...deductions.map((line) => ({ code: line.code, category: "EMPLOYEE_DEDUCTION" as const, amount: line.amount })),
    ...contributions.map((line) => ({ code: line.code, category: "EMPLOYER_CONTRIBUTION" as const, amount: line.amount })),
    ...adjustments.map((line) => ({ code: line.code, category: "ADJUSTMENT" as const, amount: line.amount })),
  ];
  const calculated = calculationManifest({
    snapshotHash,
    jurisdictionVersion: NG_2026_4_VERSION,
    engineVersion: manifest.engineVersion,
    sources: { earnings: manifest.earnings.map((line) => line.sourceId), deductions: (manifest.deductions ?? []).map((line) => line.sourceId), contributions: (manifest.employerContributions ?? []).map((line) => line.sourceId) },
    ruleVersions: [NG_2026_4_VERSION, ...manifest.earnings.map((line) => line.ruleVersionReference), ...(manifest.deductions ?? []).map((line) => line.definitionVersion), ...(manifest.employerContributions ?? []).map((line) => line.definitionVersion)],
    lines,
  });
  const employeeDeductions = deductions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const employerContributions = contributions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const adjustmentTotal = adjustments.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const risks = payrollRisk({ gross, net: calculated.output.net, paye: paye.currentPaye, manualAdjustment: adjustmentTotal, ...manifest.riskContext });
  return { ...calculated, gross: roundPayroll(gross), taxableIncome: roundPayroll(taxableIncome), paye, employeeDeductions: roundPayroll(employeeDeductions), employerContributions: roundPayroll(employerContributions), adjustments: roundPayroll(adjustmentTotal), earnings, deductions, contributions, adjustmentLines: adjustments, risks };
}
