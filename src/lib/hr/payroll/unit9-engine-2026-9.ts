import { payrollDigest, type Unit9Money } from "./unit9-domain";
import {
  calculateFrozenPayroll2026_8,
  deriveFrozenNg2026_8Binding,
  type Candidate2026_8Manifest,
} from "./unit9-engine-2026-8";
import {
  classifyNg2026_9Earning,
  classifyNg2026_9MinimumWage,
  deriveNg2026_9Pension,
  deriveNg2026_9Reliefs,
  NG_2026_9_STATUS,
  NG_2026_9_VERSION,
  validateNg2026_9Policies,
  type Ng2026_9AuthorityRecord,
  type Ng2026_9EarningCategory,
  type Ng2026_9MinimumWageInput,
  type Ng2026_9PensionDecision,
  type Ng2026_9PolicyPacket,
  type Ng2026_9ReliefClaim,
  type Ng2026_9Treatment,
} from "./nigeria-2026-9";
import { NG_2026_8_VERSION } from "./nigeria-2026-8";
import { NG_2026_7_VERSION } from "./nigeria-2026-7";

export type Candidate2026_9Manifest = Omit<Candidate2026_8Manifest, "jurisdictionVersion" | "incomeEvidence"> & {
  jurisdictionVersion: typeof NG_2026_9_VERSION;
  incomeEvidence: Omit<Candidate2026_8Manifest["incomeEvidence"], "candidateVersion"> & { candidateVersion: typeof NG_2026_9_VERSION };
  governance: {
    authorities: Ng2026_9AuthorityRecord[];
    earningTreatments: Ng2026_9Treatment[];
    minimumWage: Omit<Ng2026_9MinimumWageInput, "monthlySalary" | "currentOtherEmploymentIncome" | "priorOtherEmploymentIncomeYtd" | "priorEmployerState">;
    reliefClaims: Ng2026_9ReliefClaim[];
    pension: Ng2026_9PensionDecision;
    policies: Ng2026_9PolicyPacket;
    taxYear: number;
    bonusAllocationMethod: { state: "APPROVED" | "APPROVED_WITH_CLARIFICATION" | "CHANGE_REQUIRED" | "INSUFFICIENT_AUTHORITY"; ruleId: string };
  };
};

const currentOtherIncome = (manifest: Candidate2026_9Manifest) => manifest.earnings
  .filter((earning) => !["SALARY", "BONUS"].includes(earning.code))
  .reduce((total, earning) => total + Number(earning.fixedAmount ?? 0), 0);

function complianceAssessment(manifest: Candidate2026_9Manifest) {
  if (manifest.jurisdictionVersion !== NG_2026_9_VERSION || manifest.incomeEvidence.candidateVersion !== NG_2026_9_VERSION) throw new Error("NG_2026_9_CANDIDATE_REQUIRED");
  const holdCodes: string[] = [];
  const earningClassifications = manifest.earnings.map((earning) => {
    const result = classifyNg2026_9Earning(earning.code as Ng2026_9EarningCategory, manifest.governance.earningTreatments);
    if (result.status === "COMPLIANCE_HOLD") holdCodes.push(result.holdCode);
    if (!["SALARY", "BONUS"].includes(earning.code)) holdCodes.push("COMPLIANCE_HOLD_UNCLASSIFIED_EARNING");
    return result;
  });
  const minimumWage = classifyNg2026_9MinimumWage({
    ...manifest.governance.minimumWage,
    monthlySalary: manifest.incomeEvidence.actualFrozenSalary,
    currentOtherEmploymentIncome: currentOtherIncome(manifest),
    priorOtherEmploymentIncomeYtd: manifest.authoritativeSources.ytd.priorBonusYtd,
    priorEmployerState: manifest.authoritativeSources.priorEmployer.state,
  });
  holdCodes.push(...minimumWage.holdCodes);
  const reliefs = deriveNg2026_9Reliefs(manifest.governance.reliefClaims, manifest.governance.authorities, manifest.governance.taxYear);
  holdCodes.push(...reliefs.holds.map((hold) => hold.code));
  const pension = deriveNg2026_9Pension(manifest.governance.pension, manifest.governance.authorities);
  if (pension.status === "COMPLIANCE_HOLD") holdCodes.push(...pension.holdCodes);
  const policies = validateNg2026_9Policies(manifest.governance.policies, manifest.governance.authorities);
  holdCodes.push(...policies.holdCodes);
  if (manifest.earnings.some((earning) => earning.code === "BONUS") && !["APPROVED", "APPROVED_WITH_CLARIFICATION"].includes(manifest.governance.bonusAllocationMethod.state)) holdCodes.push("COMPLIANCE_HOLD_BONUS_ALLOCATION_METHOD_REQUIRED");
  const uniqueHoldCodes = [...new Set(holdCodes)].sort();
  const facts = { candidateVersion: NG_2026_9_VERSION, earningClassifications, minimumWage, reliefs: { amount: reliefs.amount.toFixed(2), aggregateHash: reliefs.aggregateHash, holds: reliefs.holds }, pension: pension.status === "SUPPORTED" ? { state: pension.state, employeeDeduction: pension.employeeDeduction.toFixed(2), employerCost: pension.employerCost.toFixed(2), remittanceLiability: pension.remittanceLiability.toFixed(2), decisionHash: pension.decisionHash } : pension, policies, bonusAllocationMethod: manifest.governance.bonusAllocationMethod };
  return { ...facts, status: uniqueHoldCodes.length ? "COMPLIANCE_HOLD" as const : "SUPPORTED" as const, holdCodes: uniqueHoldCodes, complianceHash: payrollDigest(facts) };
}

function as2026_8(manifest: Candidate2026_9Manifest): Candidate2026_8Manifest {
  return {
    ...manifest,
    jurisdictionVersion: NG_2026_8_VERSION,
    incomeEvidence: { ...manifest.incomeEvidence, candidateVersion: NG_2026_8_VERSION },
    governance: undefined,
  } as Candidate2026_8Manifest;
}

export function deriveFrozenNg2026_9Binding(manifest: Candidate2026_9Manifest) {
  const assessment = complianceAssessment(manifest);
  const predecessor = deriveFrozenNg2026_8Binding(as2026_8(manifest));
  const facts = { candidateVersion: NG_2026_9_VERSION, predecessorCandidateVersion: NG_2026_7_VERSION, predecessorBindingHash: predecessor.employmentIncomeBindingHash, assessmentHash: assessment.complianceHash, identity: predecessor.identity };
  return { ...facts, assessment, employmentIncomeBindingHash: payrollDigest(facts), minimumWageDecisionHash: assessment.minimumWage.decisionHash };
}

export function calculateFrozenPayroll2026_9(manifest: Candidate2026_9Manifest, snapshotHash: string) {
  const binding = deriveFrozenNg2026_9Binding(manifest);
  if (binding.assessment.status !== "SUPPORTED") throw new Error(`NG_2026_9_COMPLIANCE_HOLD:${binding.assessment.holdCodes.join(",")}`);
  const predecessorManifest = as2026_8(manifest);
  const predecessorBinding = deriveFrozenNg2026_8Binding(predecessorManifest);
  predecessorManifest.expectedEmploymentIncomeBindingHash = predecessorBinding.employmentIncomeBindingHash;
  predecessorManifest.expectedMinimumWageDecisionHash = predecessorBinding.decision.decisionHash;
  const predecessor = calculateFrozenPayroll2026_8(predecessorManifest, snapshotHash);
  const facts = { priorHash: predecessor.hash, candidateVersion: NG_2026_9_VERSION, complianceHash: binding.assessment.complianceHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash };
  return { ...predecessor, candidateVersion: NG_2026_9_VERSION, certificationStatus: NG_2026_9_STATUS, employmentIncomeBinding: binding, minimumWageDecision: binding.assessment.minimumWage, governance: binding.assessment, hash: payrollDigest(facts) };
}

export function classifyNg2026_9Refund(currentDeduction: Unit9Money, procedureRuleState: "APPROVED" | "APPROVED_WITH_CLARIFICATION" | "CHANGE_REQUIRED" | "INSUFFICIENT_AUTHORITY") {
  const amount = Number(currentDeduction);
  if (amount >= 0) return { treatment: "NOT_APPLICABLE" as const, refundCandidate: "0.00" };
  if (!["APPROVED", "APPROVED_WITH_CLARIFICATION"].includes(procedureRuleState)) return { treatment: "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED" as const, refundCandidate: Math.abs(amount).toFixed(2) };
  return { treatment: "REFUND_OR_CREDIT_CANDIDATE_REQUIRES_DOWNSTREAM_APPROVAL" as const, refundCandidate: Math.abs(amount).toFixed(2) };
}
