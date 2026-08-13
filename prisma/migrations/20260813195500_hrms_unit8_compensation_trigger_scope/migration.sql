-- Scope the generic immutability trigger's DRAFT comparison to text so tables
-- with a different status enum can safely execute their permitted transitions.
CREATE OR REPLACE FUNCTION hr_comp_protect_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('HrCompBudgetEntry','HrCompCalibrationDecision','HrCompDecision','HrCompRetroactiveSignal','HrCompensationRecord') THEN
    RAISE EXCEPTION 'Authoritative compensation evidence cannot be deleted';
  END IF;
  IF TG_TABLE_NAME IN ('HrCompMarketVersion','HrCompBandVersion','HrCompPolicyVersion','HrBonusProgramVersion')
     AND OLD."status"::text <> 'DRAFT' THEN
    RAISE EXCEPTION 'Published compensation versions are immutable';
  END IF;
  IF TG_TABLE_NAME IN ('HrCompBudgetEntry','HrCompCalibrationDecision','HrCompRetroactiveSignal') THEN
    RAISE EXCEPTION 'Approved compensation evidence is immutable';
  END IF;
  IF TG_TABLE_NAME = 'HrCompDecision' AND TG_OP = 'UPDATE' AND (
    NEW."organizationId" <> OLD."organizationId" OR NEW."recommendationId" IS DISTINCT FROM OLD."recommendationId" OR
    NEW."recommendationVersion" IS DISTINCT FROM OLD."recommendationVersion" OR NEW."exceptionId" IS DISTINCT FROM OLD."exceptionId" OR
    NEW."eventType" <> OLD."eventType" OR NEW."oldAmount" IS DISTINCT FROM OLD."oldAmount" OR NEW."newAmount" <> OLD."newAmount" OR
    NEW."currency" <> OLD."currency" OR NEW."payBasis" IS DISTINCT FROM OLD."payBasis" OR
    NEW."marketVersionId" IS DISTINCT FROM OLD."marketVersionId" OR NEW."bandVersionId" IS DISTINCT FROM OLD."bandVersionId" OR
    NEW."policyVersionId" <> OLD."policyVersionId" OR NEW."effectiveAt" <> OLD."effectiveAt" OR
    NEW."approverUserIds" <> OLD."approverUserIds" OR NEW."rationale" <> OLD."rationale" OR
    NEW."idempotencyKey" <> OLD."idempotencyKey" OR NEW."correlationId" <> OLD."correlationId"
  ) THEN RAISE EXCEPTION 'Approved compensation decision content is immutable'; END IF;
  IF TG_TABLE_NAME = 'HrCompensationRecord' AND (
    NEW."organizationId" <> OLD."organizationId" OR NEW."employeeId" <> OLD."employeeId" OR
    NEW."workRelationshipId" <> OLD."workRelationshipId" OR NEW."assignmentId" <> OLD."assignmentId" OR
    NEW."decisionId" <> OLD."decisionId" OR NEW."eventType" <> OLD."eventType" OR
    NEW."amount" <> OLD."amount" OR NEW."currency" <> OLD."currency" OR NEW."payBasis" <> OLD."payBasis" OR
    NEW."marketVersionId" <> OLD."marketVersionId" OR NEW."bandVersionId" <> OLD."bandVersionId" OR
    NEW."policyVersionId" <> OLD."policyVersionId" OR NEW."effectiveFrom" <> OLD."effectiveFrom" OR
    NEW."contentHash" <> OLD."contentHash" OR NEW."correlationId" <> OLD."correlationId"
  ) THEN RAISE EXCEPTION 'Authoritative compensation content is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
