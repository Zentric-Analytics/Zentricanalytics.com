# Reports and analytics

Milestone 8 adds a permission-aware administration dashboard, live analytics and audited CSV exports. All HR queries include the authenticated organization ID. Each protected module remains independently authorized: HR, leave, payroll, assets, workflows and audit data are displayed or exported only when the actor holds that module's read permission.

## Metrics

- current headcount and department distribution;
- year-to-date hires, terminations and average-headcount turnover rate;
- organization-linked hiring pipeline;
- leave requests and amounts by status;
- payroll employee counts, gross earnings, deductions and net pay by run;
- asset portfolio by lifecycle status;
- workflow outcomes and overdue lifecycle tasks;
- dashboard queues for leave, payroll, expiring documents, asset returns and approvals.

Payroll totals use Prisma Decimal arithmetic and are never converted through JavaScript floating-point numbers.

## Exports

`/api/hr/reports/[report]` supports the employee directory, department roster, supervisor assignments, headcount, turnover, recruitment pipeline, leave balances and history, payroll summary and bank schedule, payslip register, asset register, offboarding register, and audit report. Exports:

- require both `report.export` and the relevant module permission;
- are limited to 10,000 detail rows (500 payroll runs);
- use UTF-8 CSV with formula-injection neutralization;
- return private, no-store and nosniff headers;
- contain no credential, identity-document content or raw audit JSON; the dedicated bank schedule is the sole exception for account numbers and requires `payroll.read_bank_details`;
- append an audit event with report name, period and row count.

Recruitment applications now carry an optional organization foreign key. The migration safely backfills existing Zentric applications when the organization already exists, and new applications link during submission. Unlinked applications never appear in HR reports.

## Interpretation

Turnover uses terminations divided by average opening/closing headcount. Opening headcount is reconstructed as closing headcount minus hires plus terminations for the selected year. Reports currently use the UTC calendar year; date-range presets can be added without changing storage.
