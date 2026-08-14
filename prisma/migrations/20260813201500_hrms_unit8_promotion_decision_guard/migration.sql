-- Unit 8 consumes an exact Unit 7 promotion decision as an immutable input.
-- Protect that cross-unit boundary against an approval/update race.
CREATE OR REPLACE FUNCTION hr_promotion_decision_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Promotion decisions are immutable';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER hr_promotion_decision_immutable
BEFORE UPDATE OR DELETE ON "HrPromotionDecision"
FOR EACH ROW EXECUTE FUNCTION hr_promotion_decision_immutable();
