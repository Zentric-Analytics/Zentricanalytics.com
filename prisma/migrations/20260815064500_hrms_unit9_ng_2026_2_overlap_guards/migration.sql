-- Additive PostgreSQL interval guards for NG-CANDIDATE-2026.2 evidence.
-- btree_gist is required to combine tenant/text equality with time-range overlap.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE "HrPayrollEmployeeRtaProfileVersion"
  ADD CONSTRAINT "HrPayrollEmployeeRtaProfileVersion_no_overlap"
  EXCLUDE USING GIST (
    "organizationId" WITH =,
    "employeeId" WITH =,
    "taxYear" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  );

ALTER TABLE "HrPayrollPensionProfileVersion"
  ADD CONSTRAINT "HrPayrollPensionProfileVersion_no_overlap"
  EXCLUDE USING GIST (
    "organizationId" WITH =,
    "employeeId" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  );

ALTER TABLE "HrPayrollStatutoryApplicabilityVersion"
  ADD CONSTRAINT "HrPayrollStatutoryApplicabilityVersion_no_overlap"
  EXCLUDE USING GIST (
    "organizationId" WITH =,
    "legalEntityId" WITH =,
    "schemeCode" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  );

ALTER TABLE "HrPayrollBikEvidenceVersion"
  ADD CONSTRAINT "HrPayrollBikEvidenceVersion_no_overlap"
  EXCLUDE USING GIST (
    "organizationId" WITH =,
    "employeeId" WITH =,
    "code" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp), '[)') WITH &&
  );
