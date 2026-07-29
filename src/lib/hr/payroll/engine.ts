import { Prisma } from "@prisma/client";
import { z } from "zod";

const money = z.union([z.string().regex(/^\d+(\.\d{1,4})?$/), z.number().positive()]).transform(String).refine((value) => new Prisma.Decimal(value).greaterThan(0), "Amount must be greater than zero.");
export const salaryInput = z.object({
  employeeId: z.string().cuid(),
  amount: money,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  payFrequency: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]),
  effectiveFrom: z.coerce.date(),
  reason: z.string().trim().min(3).max(500),
});

export const payrollComponentInput = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["EARNING", "DEDUCTION", "TAX", "BENEFIT"]),
  calculationType: z.enum(["FIXED", "PERCENTAGE_OF_BASE", "PERCENTAGE_OF_GROSS"]),
  taxable: z.boolean(),
  pensionable: z.boolean(),
}).refine(({ type, calculationType }) => type !== "EARNING" || calculationType !== "PERCENTAGE_OF_GROSS", { message: "Earnings cannot be calculated as a percentage of their own gross total.", path: ["calculationType"] });

export const payrollPeriodInput = z.object({
  name: z.string().trim().min(2).max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  payDate: z.coerce.date(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  payFrequency: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]),
}).refine(({ startsAt, endsAt }) => endsAt >= startsAt, { message: "Payroll period end must not precede its start.", path: ["endsAt"] });

export type PayrollComponentSource = {
  componentId?: string;
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "TAX" | "BENEFIT";
  calculationType: "FIXED" | "PERCENTAGE_OF_BASE" | "PERCENTAGE_OF_GROSS";
  amount: Prisma.Decimal.Value;
};

function rounded(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function calculatedAmount(component: PayrollComponentSource, base: Prisma.Decimal, grossBefore: Prisma.Decimal) {
  const source = new Prisma.Decimal(component.amount);
  if (component.calculationType === "FIXED") return rounded(source);
  const basis = component.calculationType === "PERCENTAGE_OF_BASE" ? base : grossBefore;
  return rounded(basis.mul(source).div(100));
}

export function calculatePayrollSnapshot(baseSalary: Prisma.Decimal.Value, components: PayrollComponentSource[]) {
  const base = rounded(baseSalary);
  const earnings = components.filter((component) => component.type === "EARNING");
  const preGross = earnings.reduce((total, component) => total.add(calculatedAmount(component, base, base)), base);
  const lines = components.map((component) => ({
    ...component,
    amount: calculatedAmount(component, base, preGross),
    sourceAmount: new Prisma.Decimal(component.amount),
  }));
  const grossEarnings = lines.filter((line) => line.type === "EARNING").reduce((total, line) => total.add(line.amount), base);
  const totalDeductions = lines.filter((line) => line.type === "DEDUCTION" || line.type === "TAX").reduce((total, line) => total.add(line.amount), new Prisma.Decimal(0));
  const employerBenefits = lines.filter((line) => line.type === "BENEFIT").reduce((total, line) => total.add(line.amount), new Prisma.Decimal(0));
  const netPay = rounded(grossEarnings.sub(totalDeductions));
  if (netPay.isNegative()) throw new Error("Payroll deductions cannot produce a negative net pay.");
  return { baseSalary: base, grossEarnings: rounded(grossEarnings), totalDeductions: rounded(totalDeductions), employerBenefits: rounded(employerBenefits), netPay, lines };
}

export function assertPayrollTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    DRAFT: ["CALCULATED", "CANCELLED"],
    CALCULATED: ["REVIEWED", "DRAFT", "CANCELLED"],
    REVIEWED: ["APPROVED", "DRAFT", "CANCELLED"],
    APPROVED: ["LOCKED"],
    LOCKED: ["PAID"],
  };
  if (!allowed[from]?.includes(to)) throw new Error(`Payroll run cannot transition from ${from} to ${to}.`);
}

export function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
