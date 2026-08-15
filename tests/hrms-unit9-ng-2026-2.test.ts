import { describe, expect, it } from "vitest";
import { annualEmployerReturnDueDate, assertNg2026_2EarningMapped, assertNg2026_2JoinerYtd, assertRtaConfiguration, assertStatutoryApplicability, buildNg2026_2AnnualEmployerReturn, buildNg2026_2CandidatePayslip, buildNg2026_2PayeLiability, calculateNg2026_2AnnualizedPaye, calculateNg2026_2Overtime, calculateNg2026_2Pension, calculateNg2026_2Proration, calculateNg2026_2RentRelief, evaluateNg2026_2MinimumWage, evaluateNg2026_2Relief, NG_2026_2_STATUS, payeRemittanceDueDate, pensionRemittanceDueDate, selectEffectiveNg2026_2Rta, taxRetentionUntil, valueNg2026_2Bik } from "../src/lib/hr/payroll/nigeria-2026-2";
import { calculateFrozenPayroll } from "../src/lib/hr/payroll/unit9-engine";
import fs from "node:fs";
import path from "node:path";

describe("NG-CANDIDATE-2026.2 remediation", () => {
  const fixturePackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ng-candidate-2026-2-expected-values.json"), "utf8")) as { candidateVersion: string; certificationStatus: string; fixtures: Array<{ id: string; evidenceClass: string; input: Record<string, string | number>; expected: Record<string, string> }> };

  it.each([
    ["799999.99", "0.00"], ["800000.00", "0.00"], ["800000.01", "0.00"],
    ["2999999.99", "330000.00"], ["3000000.00", "330000.00"], ["3000000.01", "330000.00"],
    ["11999999.99", "1950000.00"], ["12000000.00", "1950000.00"], ["12000000.01", "1950000.00"],
    ["24999999.99", "4680000.00"], ["25000000.00", "4680000.00"], ["25000000.01", "4680000.00"],
    ["49999999.99", "10430000.00"], ["50000000.00", "10430000.00"], ["50000000.01", "10430000.00"],
  ])("uses independently specified annual band expectations at %s", (income, expected) => {
    const result = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: income, eligibleAnnualDeductions: "0", periodsElapsed: 12, periodsInTaxYear: 12, priorPayeDeducted: "0", priorPayeRepaid: "0" });
    expect(result.annualTax.toFixed(2)).toBe(expected);
    expect(result.certificationStatus).toBe(NG_2026_2_STATUS);
  });

  it("annualizes cumulative target and preserves a negative refund", () => {
    const result = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12, priorPayeDeducted: "200000", priorPayeRepaid: "0" });
    expect(result.cumulativeTarget.toFixed(2)).toBe("165000.00");
    expect(result.currentAdjustment.toFixed(2)).toBe("-35000.00");
    expect(result.currentTreatment).toBe("PAYE_REFUND_CREDIT");
  });

  it.each([["0","0.00"],["1000000","200000.00"],["2500000","500000.00"],["3000000","500000.00"]])("caps evidenced rent relief for %s", (rent, expected) => expect(calculateNg2026_2RentRelief(rent).toFixed(2)).toBe(expected));

  it("blocks unknown remuneration and unsourced exclusions", () => {
    expect(() => assertNg2026_2EarningMapped({ code: "UNKNOWN", employmentRemuneration: true })).toThrow("CERTIFICATION_BLOCKER");
    expect(() => assertNg2026_2EarningMapped({ code: "EXPENSE", employmentRemuneration: true, taxableClassification: "SOURCED_EXCLUSION" })).toThrow("sourced rule");
    expect(assertNg2026_2EarningMapped({ code: "BONUS", employmentRemuneration: true, taxableClassification: "INCLUDED" })).toBe("INCLUDED");
  });

  it("values BIK separately and blocks unsourced treatment", () => {
    expect(valueNg2026_2Bik({ code: "CAR", method: "PERCENT_OF_ASSET_VALUE", assetValue: "1000000", ratePercent: "5", effectiveFrom: new Date("2026-01-01"), sourceRuleId: "NG-BIK-001" }).taxableValue.toFixed(2)).toBe("50000.00");
    expect(() => valueNg2026_2Bik({ code: "CAR", method: "FIXED", fixedValue: "1", effectiveFrom: new Date("2026-01-01") })).toThrow("CERTIFICATION_BLOCKER");
  });

  it("requires evidence and remittance before relief eligibility", () => {
    expect(() => evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "e1", sourceRuleId: "NG-PEN", remittanceStatus: "DEDUCTED" })).toThrow("actual remittance");
    expect(evaluateNg2026_2Relief({ type: "PENSION", amount: "80000", taxYear: 2026, elected: true, evidenceReference: "e1", sourceRuleId: "NG-PEN", remittanceStatus: "ACKNOWLEDGED", ytdUsed: "10000" }).eligibleAmount.toFixed(2)).toBe("70000.00");
    expect(() => evaluateNg2026_2Relief({ type: "NHF", amount: "1", taxYear: 2026, elected: false })).toThrow("RELIEF_EVIDENCE_BLOCKER");
  });

  it("blocks incomplete joiner YTD and accepts evidenced continuity", () => {
    expect(() => assertNg2026_2JoinerYtd({ taxYear: 2026 })).toThrow("PRIOR_YTD_BLOCKER");
    expect(assertNg2026_2JoinerYtd({ taxYear: 2026, priorEmployer: "Prior", gross: "100", eligibleDeductions: "10", taxableIncome: "90", payeDeducted: "5", payeRepaid: "0", evidenceReference: "doc", handling: "EVIDENCED" }).taxableIncome.toFixed(2)).toBe("90.00");
  });

  it("uses BHT minimum pension basis and reviewed 8/10 or employer-all 20 rates", () => {
    const split = calculateNg2026_2Pension({ applicability: "COVERED", basic: "100000", housing: "20000", transport: "10000", contractualBasis: "120000" });
    expect([split.basis.toFixed(2), split.employee.toFixed(2), split.employer.toFixed(2)]).toEqual(["130000.00", "10400.00", "13000.00"]);
    expect(calculateNg2026_2Pension({ applicability: "COVERED", basic: "100000", housing: "20000", transport: "10000", employerPaysAll: true }).employer.toFixed(2)).toBe("26000.00");
    expect(() => calculateNg2026_2Pension({ applicability: "REVIEW_REQUIRED", basic: "1", housing: "0", transport: "0" })).toThrow("PENSION_APPLICABILITY_REVIEW_REQUIRED");
  });

  it("calculates candidate statutory due dates without external submission", () => {
    expect(pensionRemittanceDueDate(new Date("2026-08-14T00:00:00Z")).toISOString().slice(0,10)).toBe("2026-08-25");
    expect(payeRemittanceDueDate(2026, 12).toISOString().slice(0,10)).toBe("2027-01-10");
    expect(annualEmployerReturnDueDate(2026).toISOString().slice(0,10)).toBe("2027-01-31");
  });

  it("blocks unresolved schemes and missing State/FCT RTA routing", () => {
    expect(() => assertStatutoryApplicability({ NHF: "REVIEW_REQUIRED", NHIS: "OUT_OF_SCOPE", NSITF_ECA: "OUT_OF_SCOPE", ITF: "OUT_OF_SCOPE", GROUP_LIFE: "OUT_OF_SCOPE" })).toThrow("APPLICABILITY_REVIEW_REQUIRED");
    expect(() => assertRtaConfiguration({ stateOrFct: "Lagos" })).toThrow("RTA_CONFIGURATION_BLOCKER");
    expect(assertRtaConfiguration({ stateOrFct: "Lagos", rtaId: "LIRS", taxIdentifier: "redacted", adapterVersion: "test-v1", effectiveFrom: new Date("2026-01-01") })).toHaveLength(64);
  });

  it("retains tax evidence for at least six years after assessment and honors longer holds", () => {
    expect(taxRetentionUntil(2026).toISOString().slice(0,10)).toBe("2033-01-01");
    expect(taxRetentionUntil(2026, new Date("2035-06-01")).toISOString().slice(0,10)).toBe("2035-06-01");
  });

  it("uses the annualized candidate path in the frozen engine and represents refunds explicitly", () => {
    const result = calculateFrozenPayroll({
      currency: "NGN", jurisdictionVersion: "NG-CANDIDATE-2026.2", engineVersion: "unit9-ng-2026.2",
      earnings: [{ code: "BASE", sourceType: "UNIT8", sourceId: "handoff-1", fixedAmount: "250000", taxableBaseCode: "EMPLOYMENT", ruleVersionReference: "comp-v1" }],
      paye: {
        priorYtdTaxableIncome: "0", priorYtdPaye: "200000", priorPayeRepaid: "0",
        expectedAnnualEmploymentIncome: "3000000", eligibleAnnualDeductions: "0", periodsElapsed: 6, periodsInTaxYear: 12,
        rules: { version: "legacy-must-not-run", annualizationPeriods: 12, roundingScale: 2, bands: [] },
      },
    }, "snapshot-hash");
    expect("currentTreatment" in result.paye ? result.paye.currentTreatment : null).toBe("PAYE_REFUND_CREDIT");
    expect(result.paye.currentPaye.toFixed(2)).toBe("-35000.00");
    expect(result.manifest.lines.find((line) => line.code === "PAYE_REFUND_CREDIT")?.amount).toBe("-35000.0000");
    expect(result.output.net.toFixed(2)).toBe("285000.00");
  });

  it("fails closed when the frozen 2026.2 annualization evidence is incomplete", () => {
    expect(() => calculateFrozenPayroll({
      currency: "NGN", jurisdictionVersion: "NG-CANDIDATE-2026.2", engineVersion: "unit9-ng-2026.2", earnings: [],
      paye: { priorYtdTaxableIncome: "0", priorYtdPaye: "0", rules: { version: "legacy", annualizationPeriods: 12, roundingScale: 2, bands: [] } },
    }, "snapshot-hash")).toThrow("NG_2026_2_ANNUALIZATION_BLOCKER");
  });

  it("adds normalized versioned persistence with database-enforced idempotency and evidence checks", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260815053000_hrms_unit9_ng_2026_2_evidence/migration.sql"), "utf8");
    for (const table of ["HrPayrollBikEvidenceVersion", "HrPayrollTaxReliefClaimVersion", "HrPayrollPriorEmployerYtdVersion", "HrPayrollEmployeeRtaProfileVersion", "HrPayrollPensionProfileVersion", "HrPayrollStatutoryApplicabilityVersion", "HrPayrollRetentionPolicyVersion"]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain("HrPayrollTaxReliefClaimVersion_logical_key");
    expect(migration).toContain("HrPayrollPriorEmployerYtdVersion_handling_check");
    expect(migration).toContain("APPLICABLE_CONFIGURED");
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("ALTER TABLE");
  });

  it.each([
    ["CALENDAR_DAY", "300000", "15", "30", undefined, "150000.00"],
    ["SCHEDULED_WORKDAY", "220000", "10", "22", undefined, "100000.00"],
    ["HOURLY", undefined, "80", undefined, "2500", "200000.00"],
  ] as const)("uses the governed %s proration denominator", (mode, fullPeriodAmount, eligibleUnits, denominatorUnits, hourlyRate, expected) => {
    expect(calculateNg2026_2Proration({ mode, fullPeriodAmount, eligibleUnits, denominatorUnits, hourlyRate, timezone: "Africa/Lagos", roundingScale: 2 }).amount.toFixed(2)).toBe(expected);
  });

  it("fails closed on unresolved minimum-wage applicability and reports an evidenced shortfall", () => {
    expect(() => evaluateNg2026_2MinimumWage({ applicability: "REVIEW_REQUIRED", comparableMonthlyPay: "100000" })).toThrow("MINIMUM_WAGE_APPLICABILITY_BLOCKER");
    expect(evaluateNg2026_2MinimumWage({ applicability: "APPLICABLE", governedMinimumMonthly: "70000", comparableMonthlyPay: "65000", evidenceReference: "official-source" }).shortfall?.toFixed(2)).toBe("5000.00");
  });

  it("renders PAYE refunds and immutable correction lineage in candidate-only payslips", () => {
    const payslip = buildNg2026_2CandidatePayslip({ employerName: "Synthetic Employer", employeeReference: "EMP-TEST", periodKey: "2026-06", paymentDate: new Date("2026-06-30T00:00:00Z"), currency: "NGN", earnings: [{ code: "BASE", amount: "250000" }], bik: [], eligibleReliefs: [], payeAdjustment: "-35000", employeePension: "20000", employerPension: "25000", otherDeductions: "0", ytdGross: "1500000", ytdTaxable: "1500000", ytdPayeDeducted: "200000", ytdPayeRepaid: "35000", version: 2, supersedesId: "slip-v1", correctionReason: "Corrected cumulative PAYE" });
    expect([payslip.payeDeduction.toFixed(2), payslip.payeRefund.toFixed(2), payslip.net.toFixed(2)]).toEqual(["0.00", "35000.00", "265000.00"]);
    expect(payslip.publicationState).toBe("CANDIDATE_ONLY");
    expect(payslip.hash).toHaveLength(64);
  });

  it("builds a versioned simulated State RTA liability with separate refund semantics", () => {
    const output = buildNg2026_2PayeLiability({ rta: { stateOrFct: "Lagos", rtaId: "LIRS", taxIdentifier: "encrypted", adapterVersion: "candidate-v1", effectiveFrom: new Date("2026-01-01") }, taxYear: 2026, month: 12, grossEmoluments: "250000", bik: "0", eligibleReliefs: "0", taxableIncome: "250000", payeAdjustment: "-35000", resultReference: "result-1", version: 2, supersedesId: "liability-v1" });
    expect(output.dueDate.slice(0, 10)).toBe("2027-01-10");
    expect([output.payeDeducted.toFixed(2), output.payeRepaid.toFixed(2)]).toEqual(["0.00", "35000.00"]);
    expect(output.simulationOnly).toBe(true);
  });

  it("selects exactly one effective RTA and rejects gaps or overlaps", () => {
    const old = { adapterVersion: "v1", effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-07-01") };
    const current = { adapterVersion: "v2", effectiveFrom: new Date("2026-07-01"), effectiveTo: null };
    expect(selectEffectiveNg2026_2Rta([old, current], new Date("2026-08-01")).adapterVersion).toBe("v2");
    expect(() => selectEffectiveNg2026_2Rta([], new Date("2026-08-01"))).toThrow("RTA_CONFIGURATION_BLOCKER");
    expect(() => selectEffectiveNg2026_2Rta([current, { ...current, adapterVersion: "overlap" }], new Date("2026-08-01"))).toThrow("RTA_CONFIGURATION_OVERLAP_BLOCKER");
  });

  it("requires locked approved overtime and an explicit multiplier policy", () => {
    expect(() => calculateNg2026_2Overtime({ lockedTime: false, approved: true, hours: "10", hourlyRate: "1000", multiplier: "1.5", policyReference: "contract-v1", pensionBasisTreatment: "INCLUDED" })).toThrow("OVERTIME_LOCKED_TIME_BLOCKER");
    expect(() => calculateNg2026_2Overtime({ lockedTime: true, approved: false, hours: "10", hourlyRate: "1000", multiplier: "1.5", policyReference: "contract-v1", pensionBasisTreatment: "INCLUDED" })).toThrow("OVERTIME_APPROVAL_BLOCKER");
    const included = calculateNg2026_2Overtime({ lockedTime: true, approved: true, hours: "10", hourlyRate: "1000", multiplier: "1.5", policyReference: "contract-v1", pensionBasisTreatment: "INCLUDED" });
    const excluded = calculateNg2026_2Overtime({ lockedTime: true, approved: true, hours: "10", hourlyRate: "1000", multiplier: "1.5", policyReference: "contract-v1", pensionBasisTreatment: "EXCLUDED" });
    expect([included.amount.toFixed(2), included.taxableEmploymentIncome.toFixed(2), included.pensionableAmount.toFixed(2), excluded.pensionableAmount.toFixed(2)]).toEqual(["15000.00", "15000.00", "15000.00", "0.00"]);
  });

  it("builds a candidate-only annual employer return with the reviewed January 31 due date", () => {
    const result = buildNg2026_2AnnualEmployerReturn({ taxYear: 2026, rta: { stateOrFct: "FCT", rtaId: "FCT-IRS", taxIdentifier: "encrypted", adapterVersion: "fct-candidate-v1", effectiveFrom: new Date("2026-01-01") }, employees: [{ employeeReference: "EMP-TEST", grossEmoluments: "3000000", allowances: "0", bik: "0", eligibleDeductions: "0", taxableIncome: "3000000", payeDeducted: "330000", payeRepaid: "0" }] });
    expect(result.dueDate.slice(0, 10)).toBe("2027-01-31");
    expect(result.simulationOnly).toBe(true);
    expect(result.hash).toHaveLength(64);
  });

  it("adds PostgreSQL exclusion constraints without modifying migration 55", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260815064500_hrms_unit9_ng_2026_2_overlap_guards/migration.sql"), "utf8");
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    expect(migration.match(/EXCLUDE USING GIST/g)).toHaveLength(4);
    expect(migration).toContain("HrPayrollEmployeeRtaProfileVersion_no_overlap");
    expect(migration).toContain("HrPayrollPensionProfileVersion_no_overlap");
    expect(migration).toContain("HrPayrollStatutoryApplicabilityVersion_no_overlap");
  });

  it("makes all candidate evidence/version tables append-only at the database boundary", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "prisma/migrations/20260815073000_hrms_unit9_ng_2026_2_immutability/migration.sql"), "utf8");
    expect(migration).toContain("PAYROLL_EVIDENCE_IMMUTABLE");
    expect(migration.match(/BEFORE UPDATE OR DELETE/g)).toHaveLength(7);
    for (const table of ["BikEvidence", "TaxReliefClaim", "PriorEmployerYtd", "EmployeeRtaProfile", "PensionProfile", "StatutoryApplicability", "RetentionPolicy"]) {
      expect(migration).toContain(`HrPayroll${table}Version_immutable`);
    }
  });

  it("keeps the independent fixture package explicitly NOT_CERTIFIED and evidence-classified", () => {
    expect(fixturePackage.candidateVersion).toBe("NG-CANDIDATE-2026.2");
    expect(fixturePackage.certificationStatus).toBe("NOT_CERTIFIED");
    expect(fixturePackage.fixtures.every((fixture) => ["OFFICIAL_NUMERIC_EXAMPLE", "SOURCE_BACKED_INDEPENDENT_EXPECTED_VALUE"].includes(fixture.evidenceClass))).toBe(true);
  });

  it.each(["PAYE-STABLE-3M", "PAYE-RELIEF-6M", "PAYE-MIDYEAR-COMPENSATION-CHANGE", "PAYE-ONE-TIME-BONUS", "PAYE-BIK-50K", "PAYE-REFUND-35K"])("matches independently stored expected values for %s", (id) => {
    const fixture = fixturePackage.fixtures.find((candidate) => candidate.id === id)!;
    const result = calculateNg2026_2AnnualizedPaye({ expectedAnnualEmploymentIncome: fixture.input.annualIncome, eligibleAnnualDeductions: fixture.input.annualDeductions, periodsElapsed: Number(fixture.input.period), periodsInTaxYear: 12, priorPayeDeducted: fixture.input.priorDeducted, priorPayeRepaid: fixture.input.priorRepaid });
    expect({ annualTaxable: result.annualTaxable.toFixed(2), annualTax: result.annualTax.toFixed(2), cumulativeTarget: result.cumulativeTarget.toFixed(2), currentAdjustment: result.currentAdjustment.toFixed(2) }).toEqual({ annualTaxable: fixture.expected.annualTaxable, annualTax: fixture.expected.annualTax, cumulativeTarget: fixture.expected.cumulativeTarget, currentAdjustment: fixture.expected.currentAdjustment });
  });

  it("matches the official numeric JRB rent illustration without calling the PAYE engine", () => {
    const fixture = fixturePackage.fixtures.find((candidate) => candidate.id === "JRB-RENT-ILLUSTRATION-2026")!;
    const attributable = Number(fixture.input.rentPaid) * Number(fixture.input.monthsAttributable) / Number(fixture.input.monthsCovered);
    expect(attributable.toFixed(2)).toBe(fixture.expected.attributableRent);
    expect(calculateNg2026_2RentRelief(String(attributable)).toFixed(2)).toBe(fixture.expected.rentRelief);
    expect(fixture.evidenceClass).toBe("OFFICIAL_NUMERIC_EXAMPLE");
  });
});
