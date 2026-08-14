# Unit 9 — Global Payroll, Payments & Statutory Processing

Status: **BLUEPRINT READY — implementation not authorized**.

This directory defines the additive long-term architecture for turning governed workforce, leave, time, and compensation truth into reproducible payroll results, employee outputs, payment instructions, accounting outputs, and statutory outputs. It makes no claim that any jurisdiction, tax engine, filing process, bank integration, or payment provider is certified.

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

## Implementation decomposition after owner approval

- 9A — payroll foundation, jurisdiction registry, pay groups and calendars
- 9B — authoritative inputs, population and certification/freeze
- 9C — deterministic calculation engine, definitions and manifests
- 9D — reconciliation, anomaly/risk review, approvals and finalization
- 9E — retroactivity, corrections, accumulators and payslips
- 9F — payments, independent approval and settlement
- 9G — accounting and statutory output contracts
- 9H — provider adapters and jurisdiction-package lifecycle

No runtime schema, route, worker, permission, or deployment change is part of this blueprint phase.
