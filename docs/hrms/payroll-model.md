# Payroll model

Payroll is an independently authorized HRMS module. `PAYROLL_ADMIN` receives payroll permissions; `HR_ADMIN` does not. Employee self-service uses the existing `employee.read_self` authority, and every payslip query additionally verifies exact payroll-item ownership. Full bank schedules require `payroll.read_bank_details`.

## Compensation and policy

- `HrSalaryRecord` preserves effective-dated salary history. New records are pending until an authorized approver approves them; approval closes the prior overlapping record rather than overwriting it.
- `HrPayrollComponent` defines organization-specific earnings, deductions, taxes, and employer benefits.
- `HrEmployeePayrollComponent` assigns fixed or percentage components with effective dates and preserved history.
- Tax and statutory rules are configuration, not hardcoded legal assumptions. Administrators must configure and validate rules for the applicable jurisdiction before production payroll.
- All stored monetary values use PostgreSQL `DECIMAL` through Prisma `Decimal`. Calculation inputs never use formatted currency strings or JavaScript floating-point arithmetic.

## Run lifecycle and corrections

The controlled lifecycle is:

`DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → PAID`

A draft accepts reasoned employee adjustments. Calculation chooses the approved salary and component assignments effective at the period end, requires salary currency and pay frequency to match the period, and creates one frozen `HrPayrollItem` per eligible employee. Database triggers prevent changes to snapshot identity, amounts, source metadata, line components, approvals, adjustments, payslips, and export records.

Draft, calculated, or reviewed runs may be cancelled. Corrections use a new run version; calculated snapshots and approval history are preserved. Approved runs must be locked before payment status can change. The final item payment moves the run to `PAID`.

## Payslips, notifications, and exports

Calculation and review queue reference-only notifications for authorized reviewers and approvers in the same database transactions; approval also notifies the run creator. Payslips are generated as PDFs only after lock, stored through the private HR object-storage abstraction, checksummed, and downloaded with `private, no-store` headers. Generation queues a payslip-ready notification. Email payloads contain no salary, bank, or payslip content.

Authorized server-side CSV exports include a summary and a separately protected bank schedule. Formula-leading cells are neutralized, exports are recorded and audited, and full account numbers appear only in the explicitly authorized bank schedule.

## Operational requirements

Before enabling payroll:

1. configure private S3-compatible storage in production;
2. verify organization currency and payroll periods;
3. configure jurisdiction-reviewed tax, deduction, and benefit components;
4. enter and approve salary history;
5. verify every paid employee has the correct primary bank account;
6. test calculation, review, approval, lock, payslip, and export flows in staging.

The migration is additive: `20260730020000_hrms_payroll`. It preserves all recruitment and prior HRMS data. Rollback is forward-only after payroll data exists; disable routes and ship a corrective migration rather than dropping financial history.
