# Payslips and employee payroll experience

The authenticated HRMS is the authoritative delivery channel. Official payslips derive only from an immutable FINALIZED payroll result—never a simulation, draft, preview, failed attempt or merely approved run.

## Domain model

- `HrPayrollPayslip`: stable identity for employee/finalized result and document family.
- `HrPayrollPayslipVersion`: immutable rendered version with finalization/result/manifest reference, private document version, checksum/content hash, generated/published timestamps, YTD snapshot/hash, predecessor/supersedes/corrected-by lineage and status.
- `HrPayrollPayslipIssuance`: append-only publication/access/notification event with channel, recipient reference, outcome and correlation. Notification failure cannot remove or invalidate portal availability.

One official current version may be published for a finalized result, but every prior/corrected version remains auditable. A retro/off-cycle correction creates a linked adjustment/replacement payslip; it does not overwrite the original.

## Nigeria-first content contract

The versioned Nigeria template can support, subject to authoritative regulatory confirmation:

- employee/payroll identifier, employee name, legal employer, pay group, payroll period and payment date;
- basic/hourly/overtime/holiday/paid-leave earnings, allowances, bonus, supported commission, retro/correction and governed earning lines;
- gross and appropriately displayed taxable earnings;
- PAYE, employee pension/statutory contributions, voluntary deductions, arrears/corrections and total employee deductions;
- net pay;
- employer pension/contributions shown clearly as employer-paid information, never employee deductions;
- YTD gross, taxable earnings, PAYE, pension/statutory deductions and other required accumulators;
- payroll run, finalized result, payslip identity and version references.

Implementation must verify legally required Nigerian fields from approved official sources. The blueprint invents no statutory display requirement.

## Secure issuance

`finalization → generation → immutable private document version → secure publication → notification → authenticated employee access`

The route follows existing employee UX, such as My HR → Payroll → Payslips. Object storage remains private, encrypted, versioned and exact-version authorized; downloads are private/no-store and audited. Email contains no payslip values or attachment by default—only a secure availability message and HTTPS portal CTA.

The accepted GoDaddy-to-Outlook Inbox risk remains independent. If notification is quarantined, delayed or fails, payroll finalization, payslip publication and payment state remain correct and visible in the authenticated portal. No mail security control is weakened.

## “How was my pay calculated?”

Employees may view a safe trace:

`gross earnings - PAYE - employee pension - other employee deductions ± adjustments = net pay`

Expandable lines show their own source category, basis/rate description, amount and applicable public rule reference. Exclude anomaly/fraud findings, investigations, approver comments, internal compliance deliberation, provider secrets and other employees’ data.

## Access and lifecycle tests

Prove employee ownership, tenant/direct-ID denial, no draft exposure, exact result/document version, no-store response, audit, notification idempotency, corrected lineage, original preservation and independent portal availability when email delivery fails.
