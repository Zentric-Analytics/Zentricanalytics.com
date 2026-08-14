# Unit 9 owner decisions

These business/product decisions are required before Unit 9A runtime implementation. Technical implementation details not listed here remain engineering decisions.

## Decision 1 — first jurisdiction and delivery model

Select the first actual payroll jurisdiction and one model: Zentric-native, external provider, or hybrid.

Trade-off:

- Native offers control and reproducibility but requires jurisdiction-specific tax/statutory expertise, certification evidence, continuous rule maintenance and larger test burden.
- Provider-backed reduces native legal-rule scope but creates provider dependency, contract/cost, data-transfer, callback, reconciliation and availability obligations.
- Hybrid keeps Zentric certification/snapshot/reconciliation/payment control while delegating calculations or filing; it is flexible but operationally most complex.

No tax logic will be implemented before this decision. The platform will not claim global or jurisdiction certification merely because the global core exists.

## Decision 2 — initial worker population

Choose salaried employees, hourly employees, or both. Decide separately whether contractor payment orchestration is included. Recommendation: start with employees only; include hourly only if the first jurisdiction/time policies and overtime rules are ready. Never classify contractors as employees for convenience.

## Decision 3 — frequencies and calendars

Approve initial frequencies and business timing: period boundaries, cutoff/freeze, approval deadline, intended payment date, accounting date, timezone and off-cycle policy. These cannot be inferred safely from the current generic monthly setting.

## Decision 4 — payment execution scope

Choose simulation/provider-neutral, governed bank-file export, or API provider submission. Recommendation: implement provider-neutral simulation and immutable payment batches first; add one real rail only after provider selection and security/compliance review. Simulation is not real payment.

## Decision 5 — statutory scope

Choose calculate/export only, external provider submission, or direct filing for the first jurisdiction. Recommendation: provider/export first unless the business commits to direct-filing certification and ongoing maintenance.

## Decision 6 — deductions and benefits boundary

Approve initial supported deductions (for example statutory only, plus selected voluntary deductions) and identify the authoritative source for elections. Recommendation: Unit 9 owns payroll application of versioned elections; a future benefits unit owns enrollment. Do not build a hidden benefits system in payroll.

## Decision 7 — approval matrix and monetary/risk thresholds

Approve who may process, approve payroll, operate payments, approve payments, resolve HIGH findings, waive eligible blockers and authorize emergency/off-cycle payroll, including legal-entity scope and monetary thresholds. One actor must not control calculation through settlement.

## Decision 8 — retro and emergency policy

Approve when corrections go to next regular payroll versus off-cycle, treatment of negative net/arrears, prior-tax-year corrections, terminated workers and failed payments. Jurisdiction/provider rules may further restrict choices.

## Decision 9 — accounting/statutory destinations

Identify the initial GL/accounting consumer, chart/dimension ownership and statutory/provider destination. If none is selected, Unit 9 will produce versioned canonical outputs only and must not claim external posting/filing.

## Decision 10 — jurisdiction-specific business policy

After Decision 1, approve only genuinely variable policies not dictated by law/provider contract: proration convention where choices exist, payroll currency/payment currency, rounding elections where allowed, overtime/pay policy, pay destination verification, retention schedule and employee payslip delivery timing.

## Recommended decision package

For a startup-safe first release: one jurisdiction, salaried employees, one frequency, provider-neutral calculation orchestration with either a vetted external payroll provider or export-only statutory boundary, simulated payments followed by a governed bank-file/provider pilot, statutory deductions only, strict four-eyes payroll/payment approval, and contractors deferred. This is a recommendation, not adopted policy.

Implementation must stop until the owner records these decisions. Changing them later is supported by versioned configuration, but the first jurisdiction package and validation plan depend on them.
