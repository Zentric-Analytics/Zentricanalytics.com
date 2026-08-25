import { Prisma } from "@prisma/client";
import { payrollMoney, roundPayroll, type PayrollLine, type Unit9Money } from "./unit9-domain";
import { calculateDeductions, calculateEarnings, calculateEmployerContributions, calculationManifest, payrollRisk, type FrozenPayrollManifest } from "./unit9-engine";
import { assertNg2026_7AuthoritativeBinding, calculateNg2026_7Paye, deriveNg2026_7Binding, NG_2026_7_ACTIVE_EARNINGS, NG_2026_7_VERSION, type Ng2026_7AuthoritativeSources, type Ng2026_7Evidence } from "./nigeria-2026-7";

export type Candidate2026_7Manifest = Omit<FrozenPayrollManifest, "paye"> & {
  employeeId: string; workRelationshipId: string; assignmentId: string; payrollPeriodId: string;
  incomeEvidence: Ng2026_7Evidence; authoritativeSources: Ng2026_7AuthoritativeSources;
  expectedEmploymentIncomeBindingHash?: string; expectedMinimumWageDecisionHash?: string;
  auditExpectedAnnualSalary?: Unit9Money; auditPriorBonusYtd?: Unit9Money; auditPayeDeductedYtd?: Unit9Money; auditPayeRepaidYtd?: Unit9Money;
  paye: FrozenPayrollManifest["paye"] & { priorBonusPaidTaxYearToDate: Unit9Money; priorEmployerIncome: Unit9Money; priorEmployerPaye: Unit9Money };
};

const sumCode = (manifest: Candidate2026_7Manifest, code: string) => calculateEarnings(manifest.earnings.filter((line) => line.code === code)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));

export function bindingInput2026_7(manifest: Candidate2026_7Manifest) {
  if (manifest.jurisdictionVersion !== NG_2026_7_VERSION) throw new Error("NG_2026_7_CANDIDATE_REQUIRED");
  if (manifest.employeeId !== manifest.incomeEvidence.employeeId || manifest.workRelationshipId !== manifest.incomeEvidence.workRelationshipId || manifest.assignmentId !== manifest.incomeEvidence.assignmentId || manifest.payrollPeriodId !== manifest.incomeEvidence.payrollPeriodId) throw new Error("EMPLOYMENT_INCOME_BINDING_IDENTITY_MISMATCH");
  for (const earning of manifest.earnings) if (!(NG_2026_7_ACTIVE_EARNINGS as readonly string[]).includes(earning.code)) throw new Error(`UNSUPPORTED_ORDINARY_EARNING:${earning.code}`);
  if (!manifest.earnings.some((line) => line.code === "SALARY")) throw new Error("PAYROLL_INCOME_BINDING_MISMATCH:SALARY_REQUIRED");
  if (manifest.earnings.some((line) => { if (line.fixedAmount === undefined) return false; const amount = payrollMoney(line.fixedAmount); return !amount.isFinite() || amount.isNegative(); })) throw new Error("INVALID_PAYROLL_MONEY_INPUT");
  const actualSalary = sumCode(manifest, "SALARY"); const actualBonus = sumCode(manifest, "BONUS");
  if (!actualSalary.eq(manifest.incomeEvidence.actualFrozenSalary)) throw new Error("PAYROLL_INCOME_BINDING_MISMATCH");
  if (!actualBonus.eq(manifest.incomeEvidence.currentBonus) || !actualBonus.eq(manifest.paye.currentNonPeriodicPayments ?? 0)) throw new Error("BONUS_INPUT_BINDING_MISMATCH");
  return { evidence: manifest.incomeEvidence, sources: manifest.authoritativeSources, auditExpectedAnnualSalary: manifest.auditExpectedAnnualSalary, payeExpectedAnnualSalary: manifest.paye.expectedAnnualEmploymentIncome, auditPriorBonusYtd: manifest.auditPriorBonusYtd ?? manifest.paye.priorBonusPaidTaxYearToDate, auditPayeDeductedYtd: manifest.auditPayeDeductedYtd ?? manifest.paye.priorYtdPaye, auditPayeRepaidYtd: manifest.auditPayeRepaidYtd ?? manifest.paye.priorPayeRepaid, periodsElapsed: manifest.paye.periodsElapsed!, periodsInTaxYear: manifest.paye.periodsInTaxYear! };
}

export function deriveFrozenNg2026_7Binding(manifest: Candidate2026_7Manifest) { return deriveNg2026_7Binding(bindingInput2026_7(manifest)); }

export function calculateFrozenPayroll2026_7(manifest: Candidate2026_7Manifest, snapshotHash: string) {
  const binding = assertNg2026_7AuthoritativeBinding(bindingInput2026_7(manifest), manifest.expectedEmploymentIncomeBindingHash, manifest.expectedMinimumWageDecisionHash);
  const earnings = calculateEarnings(manifest.earnings); const deductions = calculateDeductions(manifest.deductions ?? []); const contributions = calculateEmployerContributions(manifest.employerContributions ?? []);
  const adjustments = (manifest.adjustments ?? []).map((line, sequence) => { if (!line.reason.trim() || line.createdById === line.approvedById) throw new Error(`Adjustment ${line.code} requires a reason and independent approval.`); return { ...line, sequence, amount: roundPayroll(line.amount) }; });
  const gross = earnings.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const taxableIncome = earnings.filter((line) => Boolean(line.taxableBaseCode)).reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const paye = calculateNg2026_7Paye(binding);
  const employeeDeductions = deductions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0)); const employerContributions = contributions.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0)); const adjustmentTotal = adjustments.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const lines: PayrollLine[] = [...earnings.map((line) => ({ code: line.code, category: "EARNING" as const, amount: line.amount })), { code: "PAYE_BASE", category: "TAXABLE_BASE", amount: taxableIncome }, { code: paye.currentPaye.isNegative() ? "PAYE_REFUND_CREDIT" : "PAYE", category: "PAYE", amount: paye.currentPaye }, ...deductions.map((line) => ({ code: line.code, category: "EMPLOYEE_DEDUCTION" as const, amount: line.amount })), ...contributions.map((line) => ({ code: line.code, category: "EMPLOYER_CONTRIBUTION" as const, amount: line.amount })), ...adjustments.map((line) => ({ code: line.code, category: "ADJUSTMENT" as const, amount: line.amount }))];
  const calculated = calculationManifest({ snapshotHash, jurisdictionVersion: NG_2026_7_VERSION, engineVersion: manifest.engineVersion, sources: { earnings: manifest.earnings.map((line) => line.sourceId), deductions: (manifest.deductions ?? []).map((line) => line.sourceId), contributions: (manifest.employerContributions ?? []).map((line) => line.sourceId), binding: [binding.employmentIncomeBindingHash] }, ruleVersions: [NG_2026_7_VERSION, `${binding.annualization.ruleId}:v${binding.annualization.ruleVersion}`, ...manifest.earnings.map((line) => line.ruleVersionReference)], lines });
  const risks = payrollRisk({ gross, net: calculated.output.net, paye: paye.currentPaye, manualAdjustment: adjustmentTotal, ...manifest.riskContext });
  return { ...calculated, gross: roundPayroll(gross), taxableIncome: roundPayroll(taxableIncome), paye: { ...paye, ruleVersion: NG_2026_7_VERSION, trace: [{ employmentIncomeBindingHash: binding.employmentIncomeBindingHash, minimumWageDecisionHash: binding.decision.decisionHash, classification: binding.decision.classification }] }, employeeDeductions: roundPayroll(employeeDeductions), employerContributions: roundPayroll(employerContributions), adjustments: roundPayroll(adjustmentTotal), earnings, deductions, contributions, adjustmentLines: adjustments, risks, employmentIncomeBinding: binding, minimumWageDecision: binding.decision, frozenManifest: { employmentIncomeBinding: binding, payePath: binding.decision.classification } };
}
