# NG-CANDIDATE-2026.4 earning taxonomy

| Active code | Meaning | Source of truth | PAYE treatment |
| --- | --- | --- | --- |
| `SALARY` | Recurring normal base salary | Approved effective Unit 8 base-pay record/handoff | Normal cumulative PAYE path |
| `BONUS` | Non-periodic additional employment income | Approved final effective Unit 8 bonus award/handoff | Recognized in payment period; cumulative annual PAYE target recalculated |

There is no third ordinary earning bucket. Sick leave remains a Unit 5 absence fact and produces no Unit 9 earning. Absence/proration may still govern the Salary amount without turning leave into pay.

`COMPENSATION` is retained as a storage-compatible deprecated historical code only where prior candidate replay requires it. It is prohibited for new input. Draft legacy input is blocked by `LEGACY_COMPENSATION_CLASSIFICATION_REQUIRED` until an authorized user explicitly chooses Salary or Bonus with a reason; the old snapshot hash remains linked to the new snapshot hash.

