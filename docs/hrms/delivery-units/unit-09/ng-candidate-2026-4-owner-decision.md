# NG-CANDIDATE-2026.4 owner decision

Decision date: 2026-08-24

**UNIT 9 ORDINARY EARNINGS = SALARY + BONUS ONLY**

- `SALARY` is recurring employment earnings from the authoritative effective Unit 8 base-pay handoff.
- `BONUS` is non-periodic additional employment income from an approved, final and effective Unit 8 bonus award.
- `COMPENSATION`, `VARIABLE_COMPENSATION`, `DISCRETIONARY_COMPENSATION`, sick-leave pay and generic substitutes are not active Unit 9 earnings.
- Unit 8 remains the Pay & Rewards bounded context. Its existing internal names, immutable decisions, histories, migrations, budgets and handoffs are preserved.
- Historical Unit 9 `COMPENSATION` values remain readable only for exact replay. New input is rejected; a draft requires an explicit governed reclassification to Salary or Bonus and a new snapshot.
- No Stage 2 certification, official payroll finalization, official payslip, payment or filing is authorized by this decision.

