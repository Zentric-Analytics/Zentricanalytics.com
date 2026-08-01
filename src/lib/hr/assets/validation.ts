import { Prisma } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
export const assetInput = z.object({
  assetTag: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._/-]+$/).transform((value) => value.toUpperCase()),
  type: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  manufacturer: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(160),
  purchaseDate: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  purchaseValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal("")).transform((value) => value || undefined).refine((value) => value === undefined || new Prisma.Decimal(value).greaterThanOrEqualTo(0), "Purchase value cannot be negative."),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  condition: z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]),
  notes: optionalText(1000),
});

export const assetAssignmentInput = z.object({
  assetId: z.string().cuid(),
  employeeId: z.string().cuid(),
  assignedAt: z.coerce.date(),
  expectedReturnAt: z.coerce.date().optional().or(z.literal("")).transform((value) => value === "" ? undefined : value),
  issueCondition: z.enum(["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]),
  issueNotes: optionalText(1000),
}).refine(({ assignedAt, expectedReturnAt }) => !expectedReturnAt || expectedReturnAt >= assignedAt, { message: "Expected return must not precede assignment.", path: ["expectedReturnAt"] });

export function assertAssetStatusTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    AVAILABLE: ["UNDER_REPAIR", "LOST", "RETIRED", "DISPOSED"],
    UNDER_REPAIR: ["AVAILABLE", "RETIRED", "DISPOSED"],
    LOST: ["AVAILABLE", "RETIRED"],
    RETIRED: ["DISPOSED"],
  };
  if (from === to) return;
  if (!allowed[from]?.includes(to)) throw new Error(`Asset cannot transition from ${from} to ${to}.`);
}
