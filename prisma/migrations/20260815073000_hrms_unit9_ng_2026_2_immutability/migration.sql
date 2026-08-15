-- Evidence versions are append-only. Corrections must create a new version.
CREATE OR REPLACE FUNCTION "hr_payroll_reject_evidence_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PAYROLL_EVIDENCE_IMMUTABLE: corrections require a new version'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "HrPayrollBikEvidenceVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollBikEvidenceVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollTaxReliefClaimVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollTaxReliefClaimVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollPriorEmployerYtdVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollPriorEmployerYtdVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollEmployeeRtaProfileVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollEmployeeRtaProfileVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollPensionProfileVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollPensionProfileVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollStatutoryApplicabilityVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollStatutoryApplicabilityVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();

CREATE TRIGGER "HrPayrollRetentionPolicyVersion_immutable"
  BEFORE UPDATE OR DELETE ON "HrPayrollRetentionPolicyVersion"
  FOR EACH ROW EXECUTE FUNCTION "hr_payroll_reject_evidence_mutation"();
