# Unit 9 — Nigeria Payroll, Payments, Tax, Statutory Processing & Global Payroll Foundation

Status: **BLUEPRINT READY — implementation not authorized**.

This directory defines the additive Nigeria-first, globally extensible architecture for turning governed workforce, leave, time, and compensation truth into reproducible payroll results, employee outputs, payment instructions, accounting outputs, and statutory outputs. Nigeria is the approved first jurisdiction, using a hybrid delivery model. This blueprint does not claim that the Nigeria package, filing process, bank integration, or payment provider is already certified or implemented.

## Authority boundary

- Unit 4 owns Person, work relationship, assignment, legal entity, job/location, and effective workforce state.
- Unit 5 owns finalized paid/unpaid leave and reversals.
- Unit 6 owns approved and locked payroll-authoritative time and overtime candidates.
- Unit 8 owns effective compensation decisions, bonuses, corrections, and the versioned payroll handoff.
- Unit 9 owns input certification, frozen payroll snapshots, deterministic gross-to-net orchestration, reconciliation, risk, finalization, payslips, payment orchestration, settlement, accounting and statutory outputs.

Unit 9 never silently rewrites the upstream authorities and never treats a draft upstream record as payroll-authoritative.

## Documents

1. [Repository audit](unit-09-audit.md)
2. [Architecture blueprint](unit-09-architecture-blueprint.md)
3. [Domain model](unit-09-domain-model.md)
4. [State machines](unit-09-state-machines.md)
5. [Security and privacy](unit-09-security-privacy-model.md)
6. [Calculation reproducibility](unit-09-calculation-reproducibility.md)
7. [Retroactivity](unit-09-retroactivity-model.md)
8. [Payments, accounting and statutory outputs](unit-09-payments-accounting-statutory.md)
9. [Concurrency and idempotency](unit-09-concurrency-idempotency.md)
10. [Validation plan](unit-09-validation-plan.md)
11. [Owner decisions](unit-09-owner-decisions.md)
12. [Nigeria PAYE, deductions and regulatory governance](unit-09-nigeria-tax-regulatory.md)
13. [Payslips and employee payroll experience](unit-09-payslips.md)

## Implementation decomposition after owner approval

- 9A — Payroll Foundation & Nigeria Jurisdiction Framework
- 9B — Payroll Inputs, Certification, Cutoff & Frozen Snapshots
- 9C — Earnings, Nigeria PAYE, Deductions & Employer Contributions
- 9D — Deterministic Gross-to-Net & Calculation Manifests
- 9E — Reconciliation, Risk, Approval & Immutable Finalization
- 9F — Retroactivity, Corrections, YTD & Off-Cycle Payroll
- 9G — Payslips, Employee Payroll Experience & Secure Issuance
- 9H — Payments, Settlement & Financial Reconciliation
- 9I — Accounting, Tax/Statutory Liabilities & Remittance
- 9J — Regulatory Watch, Provider Adapters, Global Localization & Enterprise Validation

## Locked owner decisions

- First jurisdiction: Nigeria.
- Delivery: hybrid; Zentric retains canonical payroll truth and orchestration.
- Initial population: salaried and hourly employees; contractors remain outside employee payroll.
- Regulatory updates: approved official-source monitoring, human interpretation, tested independent approval and certified effective-date activation; never automatic rule activation.
- Privileged role grant/revocation: Super Admin/Owner only. This authority does not imply payroll operational access.

No runtime schema, route, worker, permission, or deployment change is part of this blueprint phase.
