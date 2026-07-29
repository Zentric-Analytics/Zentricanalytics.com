# Payroll model

Payroll is Milestone 5 and is intentionally not implemented before secure identity and authorization. It will use Prisma `Decimal` values plus explicit ISO currency (`NGN` initially), effective-dated salary records, immutable payroll snapshots, approvals, locks, adjustments, and employee-owned payslips.

No formatted currency strings or JavaScript floating-point values will be calculation sources. Payroll and bank access require explicit permissions; HR_ADMIN does not inherit them. Emails contain no salary or bank data.
