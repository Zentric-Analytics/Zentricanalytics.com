# NG-CANDIDATE-2026.8 candidate-certification boundary

Authority is `HrPayrollJurisdictionVersion.ruleManifest`, `ruleHash`, status, and `certifiedAt`, resolved tenant-scoped through the payroll run. The canonical manifest requires a well-formed `candidateVersion` and `certification` of exactly `CERTIFIED` or `NOT_CERTIFIED`. Missing or malformed authority fails closed.

Every frozen snapshot must identify the same candidate version as the jurisdiction manifest. Finalization checks this boundary before mutation. Official payslip generation/publication/correction, payment batch creation and outgoing transitions, financial/statutory generation, and remittance acknowledgement/amendment use the same guard. `REJECTED` and `RETURNED` payment transitions remain available to neutralize a batch without releasing money.

The actual 2026.8 candidate remains `NOT_CERTIFIED`; positive certification tests use isolated fixtures only.
