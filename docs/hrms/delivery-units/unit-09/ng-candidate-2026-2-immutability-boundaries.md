# NG-CANDIDATE-2026.2 immutability boundaries

Status: engineering control classification. The candidate remains **NOT_CERTIFIED**.

| Record | Enforcement | Boundary and evidence |
| --- | --- | --- |
| BIK, relief, prior-YTD, RTA, pension, statutory applicability, retention versions | DATABASE ENFORCED + SERVICE ENFORCED | Migration `20260815073000_hrms_unit9_ng_2026_2_immutability` rejects UPDATE/DELETE; corrections append versions. Real PostgreSQL returned `PAYROLL_EVIDENCE_IMMUTABLE`. |
| Frozen input snapshot and calculation manifest | SERVICE ENFORCED | The calculation service reads frozen snapshots and creates immutable attempts. No mutation endpoint exists. Operational status fields remain outside the frozen manifest. Database-level row triggers are intentionally not added because snapshot creation and run-state transitions share the table boundary. |
| Calculation attempts and authoritative results | SERVICE ENFORCED + DATABASE SELECTION INVARIANT | Every recalculation creates another attempt/result. The partial unique index permits at most one selected authoritative result per run/employee. Finalization is guarded by certified jurisdiction, reconciliation, risk, and independent approval. Existing rows are retained; selection changes before finalization are explicit service operations. |
| Result lines | SERVICE ENFORCED | Created from an exact calculation attempt and never exposed through mutation routes. Uniqueness on result/code/sequence prevents duplicate line truth. |
| YTD ledger entries | SERVICE ENFORCED + DATABASE IDEMPOTENCY | Entries are appended. The compound unique key rejects replay of the same result/category truth; correlation is unique per tenant. No update/delete service exists. A blanket trigger is not added because remediation must first cover historical operational tooling and retention procedures. |
| Retro triggers and impacts | DATABASE IDEMPOTENCY + SERVICE ENFORCED | Source identity/version and trigger/result uniqueness preserve exactly-one lineage. Corrections append rather than rewrite the original payroll result. |
| Payslip versions | SERVICE ENFORCED + DATABASE VERSION UNIQUENESS | Official generation requires finalized authoritative results. Corrected payslips append a version with `supersedesId`; publication does not rewrite content. Database uniqueness prevents duplicate result/version rows. |
| Journal batches/lines and statutory liabilities | SERVICE ENFORCED + DATABASE UNIQUENESS | Generated only from finalized results, once per run/version and result/category. No mutation endpoint exists. Operational liability status changes remain governed transitions, so blanket triggers would be inappropriate. |
| Simulated remittance acknowledgement | SERVICE ENFORCED | Atomic DRAFT claim permits one `TEST:` reference. Identical replay is idempotent; conflicting replay is rejected. The status transition itself requires UPDATE, so an all-update trigger would be incorrect. |
| Statutory amendment | DATABASE ENFORCED + SERVICE ENFORCED | Migration `20260815081500_hrms_unit9_ng_2026_2_statutory_amendments` supplies tenant/idempotency and batch/version uniqueness plus UPDATE/DELETE rejection. Later amendments append with `supersedesAmendmentId`. |

This classification deliberately does not claim database-level immutability for legacy rows where the present architecture relies on governed service boundaries. Expanding triggers onto those tables requires a separate compatibility review of operational transitions, retention, and recovery tooling.
