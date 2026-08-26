import { payrollDigest } from "./unit9-domain";
import {
  assertUsableNg2026_7ReliefVersions,
  calculateNg2026_7Paye,
  deriveNg2026_7Binding,
  deriveNg2026_7ReliefAggregate,
  NG_2026_7_ACTIVE_EARNINGS,
  NG_2026_7_MONTHLY_RULE,
  NG_2026_7_VERSION,
  requireSingleNg2026_7SalarySource,
  selectLatestNg2026_7ReliefVersions,
  selectNg2026_7PriorYtdEntries,
  type Ng2026_7BindingInput,
  type Ng2026_7Evidence,
} from "./nigeria-2026-7";

export const NG_2026_8_VERSION = "NG-CANDIDATE-2026.8" as const;
export const NG_2026_8_STATUS = "NOT_CERTIFIED" as const;
export const NG_2026_8_ACTIVE_EARNINGS = NG_2026_7_ACTIVE_EARNINGS;
export const NG_2026_8_MONTHLY_RULE = NG_2026_7_MONTHLY_RULE;
export type Ng2026_8Evidence = Omit<Ng2026_7Evidence, "candidateVersion"> & { candidateVersion: typeof NG_2026_8_VERSION };
export type Ng2026_8BindingInput = Omit<Ng2026_7BindingInput, "evidence"> & { evidence: Ng2026_8Evidence };
export { assertUsableNg2026_7ReliefVersions as assertUsableNg2026_8ReliefVersions, deriveNg2026_7ReliefAggregate as deriveNg2026_8ReliefAggregate, requireSingleNg2026_7SalarySource as requireSingleNg2026_8SalarySource, selectLatestNg2026_7ReliefVersions as selectLatestNg2026_8ReliefVersions, selectNg2026_7PriorYtdEntries as selectNg2026_8PriorYtdEntries };

export function deriveNg2026_8Binding(input: Ng2026_8BindingInput) {
  if (input.evidence.candidateVersion !== NG_2026_8_VERSION) throw new Error("NG_2026_8_EVIDENCE_VERSION_REQUIRED");
  const inherited = deriveNg2026_7Binding({ ...input, evidence: { ...input.evidence, candidateVersion: NG_2026_7_VERSION } } as Ng2026_7BindingInput);
  const { decision: _decision, employmentIncomeBindingHash: _hash, ...inheritedFacts } = inherited;
  const facts = { ...inheritedFacts, candidateVersion: NG_2026_8_VERSION };
  const employmentIncomeBindingHash = payrollDigest(facts);
  const decisionBase = { ...inherited.decision, candidateVersion: NG_2026_8_VERSION, employmentIncomeBindingHash };
  const { decisionHash: _decisionHash, ...decisionFacts } = decisionBase;
  return { ...facts, employmentIncomeBindingHash, decision: { ...decisionFacts, decisionHash: payrollDigest(decisionFacts) } };
}

export function assertNg2026_8AuthoritativeBinding(input: Ng2026_8BindingInput, expectedBindingHash?: string, expectedDecisionHash?: string) {
  if (!expectedBindingHash) throw new Error("EMPLOYMENT_INCOME_BINDING_HASH_REQUIRED");
  if (!expectedDecisionHash) throw new Error("MINIMUM_WAGE_DECISION_HASH_REQUIRED");
  const binding = deriveNg2026_8Binding(input);
  if (binding.employmentIncomeBindingHash !== expectedBindingHash || binding.decision.decisionHash !== expectedDecisionHash) throw new Error("STALE_EMPLOYMENT_INCOME_BINDING");
  if (binding.decision.status !== "SUPPORTED") throw new Error(`EMPLOYMENT_INCOME_COMPLIANCE_HOLD:${binding.decision.blockerCodes.join(",")}`);
  return binding;
}

export function calculateNg2026_8Paye(binding: ReturnType<typeof assertNg2026_8AuthoritativeBinding>) {
  const inherited = calculateNg2026_7Paye({ ...binding, candidateVersion: NG_2026_7_VERSION, decision: { ...binding.decision, candidateVersion: NG_2026_7_VERSION } } as never);
  const base = { ...inherited, candidateVersion: NG_2026_8_VERSION, certificationStatus: NG_2026_8_STATUS };
  return { ...base, hash: payrollDigest({ priorHash: inherited.hash, candidateVersion: NG_2026_8_VERSION, decisionHash: binding.decision.decisionHash, employmentIncomeBindingHash: binding.employmentIncomeBindingHash }) };
}

export function assertNg2026_8AuthoritativeUseAllowed(): never { throw new Error("NG-CANDIDATE-2026.8_NOT_CERTIFIED"); }
