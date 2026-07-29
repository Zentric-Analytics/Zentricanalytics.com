import { z } from "zod";

export const lifecycleType = z.enum(["ONBOARDING", "OFFBOARDING"]);
export const startLifecycleInput = z.object({
  employeeId: z.string().cuid(),
  templateId: z.string().cuid(),
  effectiveDate: z.coerce.date(),
  knowledgeTransferToId: z.string().cuid().optional().or(z.literal("")).transform((value) => value || undefined),
});
export const completeLifecycleTaskInput = z.object({
  taskId: z.string().cuid(),
  completionNotes: z.string().trim().min(3).max(2000),
  evidenceReference: z.string().trim().max(500).optional().or(z.literal("")).transform((value) => value || undefined),
});

export type StandardLifecycleTask = {
  key: string; title: string; ownerType: "HR" | "IT" | "SUPERVISOR" | "EMPLOYEE" | "PAYROLL";
  dueOffsetDays: number; required: boolean; predecessorKeys?: string[]; instructions?: string;
};

export const STANDARD_LIFECYCLE_TASKS: Record<z.infer<typeof lifecycleType>, StandardLifecycleTask[]> = {
  ONBOARDING: [
    { key: "hr-record", title: "Verify employee record and right-to-work documents", ownerType: "HR", dueOffsetDays: -5, required: true },
    { key: "account", title: "Provision company account and access", ownerType: "IT", dueOffsetDays: -3, required: true, predecessorKeys: ["hr-record"] },
    { key: "equipment", title: "Prepare and assign required equipment", ownerType: "IT", dueOffsetDays: -1, required: true, predecessorKeys: ["hr-record"] },
    { key: "payroll", title: "Confirm payroll, tax and bank setup", ownerType: "PAYROLL", dueOffsetDays: 2, required: true, predecessorKeys: ["hr-record"] },
    { key: "manager-plan", title: "Prepare first-week plan and introductions", ownerType: "SUPERVISOR", dueOffsetDays: 0, required: true },
    { key: "policies", title: "Read and acknowledge company policies", ownerType: "EMPLOYEE", dueOffsetDays: 5, required: true, predecessorKeys: ["account"] },
    { key: "orientation", title: "Complete orientation", ownerType: "EMPLOYEE", dueOffsetDays: 5, required: true, predecessorKeys: ["account", "manager-plan"] },
  ],
  OFFBOARDING: [
    { key: "exit-plan", title: "Confirm exit plan and final date", ownerType: "HR", dueOffsetDays: -10, required: true },
    { key: "knowledge-transfer", title: "Complete knowledge transfer", ownerType: "SUPERVISOR", dueOffsetDays: -2, required: true, predecessorKeys: ["exit-plan"] },
    { key: "asset-return", title: "Return all assigned assets", ownerType: "EMPLOYEE", dueOffsetDays: 0, required: true, predecessorKeys: ["exit-plan"] },
    { key: "final-payroll", title: "Review final payroll and deductions", ownerType: "PAYROLL", dueOffsetDays: 2, required: true, predecessorKeys: ["exit-plan"] },
    { key: "account-close", title: "Revoke accounts, sessions and system access", ownerType: "IT", dueOffsetDays: 0, required: true, predecessorKeys: ["knowledge-transfer"] },
    { key: "exit-interview", title: "Record exit interview", ownerType: "HR", dueOffsetDays: 3, required: false, predecessorKeys: ["exit-plan"] },
    { key: "exit-documents", title: "Issue and archive exit documents", ownerType: "HR", dueOffsetDays: 5, required: true, predecessorKeys: ["final-payroll"] },
  ],
};

export function dueDate(effectiveDate: Date, offsetDays: number) {
  const value = new Date(effectiveDate);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

export function taskIsUnblocked(predecessorKeys: string[], completedKeys: Set<string>) {
  return predecessorKeys.every((key) => completedKeys.has(key));
}
