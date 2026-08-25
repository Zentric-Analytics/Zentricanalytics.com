import { Prisma } from "@prisma/client";
import { payrollDigest, payrollMoney, roundPayroll, type Unit9Money } from "./unit9-domain";
import { calculateNg2026_4Paye, classifyNg2026_4Earning } from "./nigeria-2026-4";

export const NG_2026_5_VERSION = "NG-CANDIDATE-2026.5" as const;
export const NG_2026_5_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_5_MINIMUM_WAGE_MONTHLY = "70000.00" as const;
export const NG_2026_5_ACTIVE_EARNINGS = ["SALARY", "BONUS"] as const;

export type Ng2026_5TriState = "YES" | "NO" | "UNKNOWN";
export type Ng2026_5OtherIncomeState = "VERIFIED_NONE" | "PRESENT" | "UNKNOWN";
export type Ng2026_5MinimumWageEvidence = {
  employeeId: string;
  workRelationshipId: string;
  payrollPeriodId: string;
  rta: "LAGOS" | "OYO" | "FCT";
  candidateVersion: typeof NG_2026_5_VERSION;
  monthlySalary: Unit9Money;
  currentPeriodBonus: Unit9Money;
  materiallyVariableMonthlyWage: Ng2026_5TriState;
  ambiguousMultiEmployer: Ng2026_5TriState;
  unusualPartialYearArrangement: Ng2026_5TriState;
  otherTaxableEmploymentIncome: Ng2026_5OtherIncomeState;
  evidenceCompletenessCertified: boolean;
  evidenceReferences: string[];
  inputCertificationId: string;
  inputCertificationVersion: string;
};

export type Ng2026_5MinimumWageBlocker =
  | "EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE"
  | "OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED"
  | "PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED";

const normalizedEvidence = (input: Ng2026_5MinimumWageEvidence) => ({
  ...input,
  monthlySalary: roundPayroll(input.monthlySalary).toFixed(2),
  currentPeriodBonus: roundPayroll(input.currentPeriodBonus).toFixed(2),
  evidenceReferences: [...input.evidenceReferences].sort(),
});

export function decideNg2026_5MinimumWage(input: Ng2026_5MinimumWageEvidence) {
  if (input.candidateVersion !== NG_2026_5_VERSION) throw new Error("NG_2026_5_EVIDENCE_VERSION_REQUIRED");
  if (!input.employeeId || !input.workRelationshipId || !input.payrollPeriodId || !input.inputCertificationId || !input.inputCertificationVersion) throw new Error("MINIMUM_WAGE_EVIDENCE_IDENTITY_INCOMPLETE");
  const blockers: Ng2026_5MinimumWageBlocker[] = [];
  if (!input.evidenceCompletenessCertified || input.otherTaxableEmploymentIncome === "UNKNOWN" || !input.evidenceReferences.length) blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if (input.otherTaxableEmploymentIncome === "PRESENT") blockers.push("OTHER_TAXABLE_EMPLOYMENT_INCOME_UNSUPPORTED");
  if ([input.materiallyVariableMonthlyWage, input.ambiguousMultiEmployer, input.unusualPartialYearArrangement].includes("UNKNOWN")) blockers.push("EMPLOYMENT_GROSS_INCOME_EVIDENCE_INCOMPLETE");
  if ([input.materiallyVariableMonthlyWage, input.ambiguousMultiEmployer, input.unusualPartialYearArrangement].includes("YES")) blockers.push("PAYE_MINIMUM_WAGE_RTA_RULE_REQUIRED");
  const facts = normalizedEvidence(input);
  const salary = payrollMoney(input.monthlySalary);
  const bonus = payrollMoney(input.currentPeriodBonus);
  const classification = blockers.length ? null : salary.lessThanOrEqualTo(NG_2026_5_MINIMUM_WAGE_MONTHLY) && bonus.isZero() ? "MINIMUM_WAGE_EXEMPT" as const : "NORMAL_PAYE_REQUIRED" as const;
  const decision = {
    status: blockers.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const,
    classification,
    blockerCodes: [...new Set(blockers)].sort(),
    threshold: NG_2026_5_MINIMUM_WAGE_MONTHLY,
    grossEmploymentIncomeFacts: facts,
    evidenceReferences: facts.evidenceReferences,
    candidateVersion: NG_2026_5_VERSION,
  };
  return { ...decision, decisionHash: payrollDigest(decision) };
}

export function assertNg2026_5Decision(input: Ng2026_5MinimumWageEvidence, expectedDecisionHash?: string) {
  const decision = decideNg2026_5MinimumWage(input);
  if (expectedDecisionHash && decision.decisionHash !== expectedDecisionHash) throw new Error("STALE_MINIMUM_WAGE_DECISION");
  if (decision.status === "COMPLIANCE_HOLD") throw new Error(`MINIMUM_WAGE_COMPLIANCE_HOLD:${decision.blockerCodes.join(",")}`);
  return decision;
}

export function calculateNg2026_5Paye(input: Parameters<typeof calculateNg2026_4Paye>[0], decision: ReturnType<typeof assertNg2026_5Decision>) {
  if (decision.classification === "MINIMUM_WAGE_EXEMPT") {
    const zero = new Prisma.Decimal(0);
    const result = { candidateVersion: NG_2026_5_VERSION, certificationStatus: NG_2026_5_STATUS, taxableIncome: zero, cumulativeTarget: zero, validPriorPaye: zero, currentPaye: zero, treatment: "MINIMUM_WAGE_EXEMPT" as const, refundCandidate: zero, refundExecution: "NOT_APPLICABLE" as const, unverifiedPriorEmployerPayeIgnored: false, decisionHash: decision.decisionHash };
    return { ...result, hash: payrollDigest({ ...result, currentPaye: "0.00", decisionHash: decision.decisionHash }) };
  }
  const ordinary = calculateNg2026_4Paye(input);
  return { ...ordinary, candidateVersion: NG_2026_5_VERSION, certificationStatus: NG_2026_5_STATUS, decisionHash: decision.decisionHash, hash: payrollDigest({ priorHash: ordinary.hash, candidateVersion: NG_2026_5_VERSION, decisionHash: decision.decisionHash }) };
}

export const classifyNg2026_5Earning = classifyNg2026_4Earning;
export function assertNg2026_5AuthoritativeUseAllowed(): never { throw new Error("NG-CANDIDATE-2026.5_NOT_CERTIFIED"); }
