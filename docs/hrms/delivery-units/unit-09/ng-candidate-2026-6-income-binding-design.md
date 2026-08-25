# NG-CANDIDATE-2026.6 income-binding design

One deterministic canonical binding is constructed only after frozen earning lines, authoritative Salary, frozen YTD, and versioned prior-employer evidence are available. It contains identity, actual Salary and Bonus, expected annual recurring Salary, prior Bonus YTD, PAYE deducted/repaid, prior-employer evidence state and amounts, periods, deductions, evidence versions, ambiguity states, and candidate version.

All money is normalized using `Prisma.Decimal` fixed precision. Duplicate audit fields must equal the derived values exactly after normalization. The binding hash covers every calculation-driving operand. The minimum-wage decision cryptographically includes that hash; the partition and result persist it. There is no caller-selected precedence or tolerance.
