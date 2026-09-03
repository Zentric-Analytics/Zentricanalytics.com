import { describe, expect, it } from "vitest";
import {
  classifyNg2026_9Earning,
  classifyNg2026_9MinimumWage,
  deriveNg2026_9Pension,
  deriveNg2026_9Reliefs,
  NG_2026_9_STATUS,
  NG_2026_9_VERSION,
  validateNg2026_9Authority,
  validateNg2026_9Policies,
  validateNg2026_9Rule,
  type Ng2026_9AuthorityRecord,
  type Ng2026_9RuleBinding,
  type Ng2026_9Treatment,
} from "../src/lib/hr/payroll/nigeria-2026-9";
import { classifyNg2026_9Refund } from "../src/lib/hr/payroll/unit9-engine-2026-9";
import { assertOfficialPayrollCandidateCertified, PAYROLL_CANDIDATE_NOT_CERTIFIED } from "../src/lib/hr/payroll/unit9-candidate-certification";
import fs from "node:fs";
import path from "node:path";

const authority = (overrides: Partial<Ng2026_9AuthorityRecord> = {}): Ng2026_9AuthorityRecord => ({
  id: "authority-1",
  issuingBody: "Qualified authority",
  title: "Nigeria Tax Act 2025",
  publicationIdentifier: "Nigeria Tax Act 2025",
  pinpoint: "Professionally confirmed section",
  publicationDate: "2025-06-26",
  effectiveFrom: "2026-01-01",
  jurisdiction: "FEDERAL",
  officialUrl: "https://www.nigerialii.org/akn/ng/act/2025/1/eng@2025-06-26",
  accessedAt: "2026-09-03",
  sha256: "a".repeat(64),
  authorityClass: "PRIMARY_LAW",
  supersessionStatus: "CURRENT",
  reviewerDecision: "APPROVED",
  ...overrides,
});

const rule = (overrides: Partial<Ng2026_9RuleBinding> = {}): Ng2026_9RuleBinding => ({
  id: "rule-1",
  version: 1,
  state: "APPROVED",
  authorityIds: ["authority-1"],
  effectiveFrom: "2026-01-01",
  professionalReviewerId: "professional-reviewer-1",
  ...overrides,
});

const treatment = (category: Ng2026_9Treatment["category"], overrides: Partial<Ng2026_9Treatment> = {}): Ng2026_9Treatment => ({
  category,
  grossIncomeMembership: "INCLUDED",
  taxableBaseMembership: "INCLUDED",
  recognitionTiming: "CURRENT_PERIOD",
  valuationMethod: "AUTHORITATIVE_SOURCE_AMOUNT",
  evidenceRequirements: ["authoritative-source"],
  jurisdiction: "NIGERIA",
  effectiveFrom: "2026-01-01",
  ruleId: `earning-${category.toLowerCase()}`,
  reviewState: "APPROVED",
  ...overrides,
});

describe("NG-CANDIDATE-2026.9 governed compliance model", () => {
  it("remains explicitly NOT_CERTIFIED", () => expect([NG_2026_9_VERSION, NG_2026_9_STATUS]).toEqual(["NG-CANDIDATE-2026.9", "NOT_CERTIFIED"]));

  it("requires complete fingerprinted authority records", () => {
    expect(validateNg2026_9Authority(authority())).toMatchObject({ id: "authority-1", fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(() => validateNg2026_9Authority(authority({ sha256: "bad" }))).toThrow("NG_2026_9_AUTHORITY_RECORD_INCOMPLETE");
  });

  it("does not represent guidance as primary legislation", () => {
    expect(() => validateNg2026_9Authority(authority({ title: "Administrative payroll guidance", publicationIdentifier: "Circular 1" }))).toThrow("NG_2026_9_GUIDANCE_MISCLASSIFIED_AS_PRIMARY_LAW");
  });

  it.each(["CHANGE_REQUIRED", "INSUFFICIENT_AUTHORITY"] as const)("fails closed for %s rules", (state) => {
    expect(() => validateNg2026_9Rule(rule({ state }), [authority()])).toThrow(`NG_2026_9_RULE_NOT_APPROVED:rule-1:${state}`);
  });

  it("rejects a rule with a missing authority", () => expect(() => validateNg2026_9Rule(rule({ authorityIds: ["missing"] }), [authority()])).toThrow("NG_2026_9_AUTHORITY_MISSING:missing"));

  it("classifies supported earnings only through approved treatments", () => {
    expect(classifyNg2026_9Earning("SALARY", [treatment("SALARY")])).toMatchObject({ status: "SUPPORTED" });
    expect(classifyNg2026_9Earning("CRYPTO_STIPEND", [])).toEqual({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_UNCLASSIFIED_EARNING", category: "CRYPTO_STIPEND" });
    expect(classifyNg2026_9Earning("BONUS", [treatment("BONUS", { reviewState: "INSUFFICIENT_AUTHORITY" })])).toMatchObject({ status: "COMPLIANCE_HOLD", holdCode: "COMPLIANCE_HOLD_EARNING_RULE_NOT_APPROVED" });
  });

  const minimumWage = (overrides: Partial<Parameters<typeof classifyNg2026_9MinimumWage>[0]> = {}) => classifyNg2026_9MinimumWage({
    monthlySalary: "70000",
    currentOtherEmploymentIncome: "0",
    priorOtherEmploymentIncomeYtd: "0",
    priorEmployerState: "NONE",
    employmentSpan: "FULL_YEAR",
    jurisdiction: "LAGOS",
    minimumWageRule: rule(),
    authorityRecords: [authority()],
    ...overrides,
  });

  it.each([
    ["0", "MINIMUM_WAGE_EXEMPT"],
    ["69999.99", "MINIMUM_WAGE_EXEMPT"],
    ["70000", "MINIMUM_WAGE_EXEMPT"],
    ["70000.01", "NORMAL_PAYE_REQUIRED"],
  ])("classifies governed full-year monthly salary %s", (monthlySalary, expected) => expect(minimumWage({ monthlySalary })).toMatchObject({ status: "SUPPORTED", classification: expected }));

  it.each(["JOINER", "LEAVER", "OTHER_PARTIAL_YEAR"] as const)("holds ambiguous %s treatment", (employmentSpan) => expect(minimumWage({ employmentSpan })).toMatchObject({ status: "COMPLIANCE_HOLD", holdCodes: expect.arrayContaining(["COMPLIANCE_HOLD_PARTIAL_YEAR_TREATMENT_REQUIRED"]) }));

  it("holds unknown prior employer and other employment income", () => expect(minimumWage({ priorEmployerState: "UNKNOWN", currentOtherEmploymentIncome: "1" })).toMatchObject({ status: "COMPLIANCE_HOLD", holdCodes: ["COMPLIANCE_HOLD_OTHER_EMPLOYMENT_INCOME", "COMPLIANCE_HOLD_PRIOR_EMPLOYER_UNKNOWN"] }));

  it("holds threshold salary plus bonus, overtime, allowance, or commission", () => expect(minimumWage({ currentOtherEmploymentIncome: "1000" })).toMatchObject({ status: "COMPLIANCE_HOLD", classification: null, holdCodes: ["COMPLIANCE_HOLD_OTHER_EMPLOYMENT_INCOME"] }));

  it("does not exempt above-threshold partial-year receipts", () => expect(minimumWage({ monthlySalary: "100000", employmentSpan: "JOINER" })).toMatchObject({ status: "COMPLIANCE_HOLD", classification: null }));

  it("the newest relief version controls and an unusable latest version cannot fall back", () => {
    const common = { type: "PENSION" as const, amount: "100000", actuallyPaid: true, remittanceVerified: true, evidenceReference: "evidence", evidenceHash: "b".repeat(64), effectiveYear: 2026, rule: rule() };
    const result = deriveNg2026_9Reliefs([{ ...common, id: "v1", version: 1, status: "ELIGIBLE_FOR_PAYE_RELIEF" }, { ...common, id: "v2", version: 2, status: "PENDING" }], [authority()], 2026);
    expect(result).toMatchObject({ status: "COMPLIANCE_HOLD", authoritativeClaims: [{ id: "v2" }], amount: expect.objectContaining({}) });
    expect(result.amount.toFixed(2)).toBe("0.00");
  });

  it("combines only evidenced latest relief versions", () => {
    const claim = (type: "PENSION" | "RENT", amount: string) => ({ id: type, type, version: 1, amount, status: "ELIGIBLE_FOR_PAYE_RELIEF" as const, actuallyPaid: true, remittanceVerified: true, evidenceReference: `${type}-evidence`, evidenceHash: "c".repeat(64), effectiveYear: 2026, rule: rule() });
    const result = deriveNg2026_9Reliefs([claim("PENSION", "100"), claim("RENT", "50")], [authority()], 2026);
    expect([result.status, result.amount.toFixed(2)]).toEqual(["SUPPORTED", "150.00"]);
  });

  it.each(["EXEMPT", "VOLUNTARY"] as const)("models pension %s without inventing deductions", (state) => expect(deriveNg2026_9Pension({ state, evidenceReferences: ["decision"], rule: rule() }, [authority()])).toMatchObject({ status: "SUPPORTED", employeeDeduction: expect.objectContaining({}), employerCost: expect.objectContaining({}) }));

  it("distinguishes employee pension deduction, employer cost and liability", () => {
    const result = deriveNg2026_9Pension({ state: "COVERED", coveredMonthlyEmoluments: "100000", employeeRatePercent: "8", employerRatePercent: "10", evidenceReferences: ["coverage"], rule: rule() }, [authority()]);
    expect(result.status).toBe("SUPPORTED");
    if (result.status === "SUPPORTED") expect([result.employeeDeduction.toFixed(2), result.employerCost.toFixed(2), result.remittanceLiability.toFixed(2)]).toEqual(["8000.00", "10000.00", "18000.00"]);
  });

  it("does not infer pension exemption from missing configuration", () => expect(deriveNg2026_9Pension({ state: "UNRESOLVED_COMPLIANCE_HOLD", evidenceReferences: [], rule: rule() }, [authority()])).toMatchObject({ status: "COMPLIANCE_HOLD", holdCodes: ["COMPLIANCE_HOLD_PENSION_DECISION_REQUIRED"] }));

  it("requires approved proration, overtime, and rounding policies", () => {
    const result = validateNg2026_9Policies({ proration: { method: "WORKDAY", effectiveDateInclusive: true, rule: rule() }, overtime: { eligible: true, multiplier: "1.5", lockedTimeRequired: true, rule: rule() }, rounding: { scale: 2, mode: "HALF_UP", stages: ["FINAL_COMPONENT", "FINAL_TAX", "FINAL_NET"], rule: rule() } }, [authority()]);
    expect(result).toMatchObject({ status: "SUPPORTED", holdCodes: [] });
  });

  it("holds refund execution until an approved jurisdiction procedure exists", () => {
    expect(classifyNg2026_9Refund("-125.55", "INSUFFICIENT_AUTHORITY")).toEqual({ treatment: "COMPLIANCE_HOLD_REFUND_PROCEDURE_REQUIRED", refundCandidate: "125.55" });
    expect(classifyNg2026_9Refund("50", "APPROVED")).toEqual({ treatment: "NOT_APPLICABLE", refundCandidate: "0.00" });
  });

  it("rejects the 2026.9 candidate before official-state mutation", async () => {
    const mutations = { result: { updateMany: () => { throw new Error("MUTATION_MUST_NOT_RUN"); } }, ledger: { upsert: () => { throw new Error("MUTATION_MUST_NOT_RUN"); } } };
    const db = {
      hrPayrollAuthoritativeRun: { findFirst: async () => ({ id: "run-1", organizationId: "org-1", jurisdictionVersionId: "jurisdiction-1", createdAt: new Date("2026-09-01T00:00:00Z") }) },
      hrPayrollJurisdictionVersion: { findFirst: async () => ({ id: "jurisdiction-1", ruleHash: "rule-hash", ruleManifest: { candidateVersion: NG_2026_9_VERSION, certification: "NOT_CERTIFIED" }, status: "TESTING", certifiedAt: null, effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null }) },
      hrPayrollInputSnapshot: { findMany: async () => [{ sourceManifest: { jurisdictionVersion: NG_2026_9_VERSION } }] },
      ...mutations,
    };
    await expect(assertOfficialPayrollCandidateCertified(db as never, "org-1", "run-1")).rejects.toThrow(PAYROLL_CANDIDATE_NOT_CERTIFIED);
  });

  it("retains the shared certification guard at all nine official downstream boundaries", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/hr/payroll/unit9-financial-service.ts"), "utf8");
    for (const name of ["generateUnit9Payslips", "publishUnit9Payslip", "createCorrectedUnit9Payslip", "createUnit9PaymentBatch", "transitionUnit9PaymentBatch", "generateUnit9FinancialOutputs", "createUnit9RemittanceBatch"]) {
      expect(source.slice(source.indexOf(`export async function ${name}`))).toContain("assertOfficialPayrollCandidateCertified");
    }
    for (const name of ["acknowledgeUnit9RemittanceSimulation", "createUnit9RemittanceAmendmentSimulation"]) {
      expect(source.slice(source.indexOf(`export async function ${name}`))).toContain("assertRemittanceCandidateCertified");
    }
  });
});
