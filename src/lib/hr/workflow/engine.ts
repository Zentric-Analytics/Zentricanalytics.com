import { z } from "zod";

const jsonPrimitive = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
export const workflowCondition = z.object({
  field: z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,99}$/),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "IN", "EXISTS"]),
  value: z.union([jsonPrimitive, z.array(jsonPrimitive).max(50)]).optional(),
}).superRefine((value, ctx) => {
  if (value.operator !== "EXISTS" && value.value === undefined) ctx.addIssue({ code: "custom", message: "Condition value is required." });
  if (value.operator === "IN" && !Array.isArray(value.value)) ctx.addIssue({ code: "custom", message: "IN requires an array." });
});

export const workflowStageDefinition = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  assigneeType: z.enum(["USERS", "SUPERVISOR", "PERMISSION"]),
  assigneeUserIds: z.array(z.string().cuid()).max(100).default([]),
  assigneePermissionKey: z.string().trim().max(100).optional(),
  approvalMode: z.enum(["ANY", "ALL", "QUORUM"]).default("ANY"),
  quorum: z.number().int().positive().max(100).optional(),
  routingCondition: workflowCondition.optional(),
  dueOffsetHours: z.number().int().min(1).max(8760).optional(),
}).superRefine((stage, ctx) => {
  if (stage.assigneeType === "USERS" && stage.assigneeUserIds.length === 0) ctx.addIssue({ code: "custom", message: "USERS requires at least one assignee." });
  if (stage.assigneeType !== "USERS" && stage.assigneeUserIds.length) ctx.addIssue({ code: "custom", message: "Only USERS may specify user IDs." });
  if (stage.assigneeType === "PERMISSION" && !stage.assigneePermissionKey) ctx.addIssue({ code: "custom", message: "PERMISSION requires a permission key." });
  if (stage.assigneeType !== "PERMISSION" && stage.assigneePermissionKey) ctx.addIssue({ code: "custom", message: "Only PERMISSION may specify a permission key." });
  if (stage.approvalMode === "QUORUM" && !stage.quorum) ctx.addIssue({ code: "custom", message: "QUORUM requires a positive quorum." });
  if (stage.approvalMode !== "QUORUM" && stage.quorum) ctx.addIssue({ code: "custom", message: "Quorum is only valid for QUORUM mode." });
});

export const workflowDefinitionInput = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  module: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{1,49}$/),
  subjectType: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{1,99}$/),
  stages: z.array(workflowStageDefinition).min(1).max(25),
}).superRefine(({ stages }, ctx) => {
  if (new Set(stages.map(({ key }) => key)).size !== stages.length) ctx.addIssue({ code: "custom", message: "Stage keys must be unique." });
});

const forbiddenContextKey = /password|token|secret|salary|bank|account|identity|passport|nationalid|taxid|documentcontent/i;
export function assertSafeWorkflowContext(value: unknown, depth = 0): void {
  if (depth > 8) throw new Error("Workflow context nesting is too deep.");
  if (Array.isArray(value)) {
    if (value.length > 100) throw new Error("Workflow context array is too large.");
    value.forEach((child) => assertSafeWorkflowContext(child, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 100) throw new Error("Workflow context object is too large.");
    for (const [key, child] of entries) {
      if (forbiddenContextKey.test(key)) throw new Error(`Sensitive workflow context key is not allowed: ${key}`);
      assertSafeWorkflowContext(child, depth + 1);
    }
  }
}

function contextValue(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>)[key] : undefined, context);
}

export function conditionMatches(condition: z.infer<typeof workflowCondition> | null | undefined, context: Record<string, unknown>) {
  if (!condition) return true;
  const actual = contextValue(context, condition.field);
  if (condition.operator === "EXISTS") return actual !== undefined && actual !== null;
  if (condition.operator === "EQUALS") return actual === condition.value;
  if (condition.operator === "NOT_EQUALS") return actual !== condition.value;
  return Array.isArray(condition.value) && condition.value.includes(actual as never);
}

export function requiredApprovals(mode: "ANY" | "ALL" | "QUORUM", approverCount: number, quorum?: number | null) {
  if (approverCount < 1) throw new Error("A workflow stage must resolve at least one approver.");
  if (mode === "ANY") return 1;
  if (mode === "ALL") return approverCount;
  if (!quorum || quorum > approverCount) throw new Error("Workflow quorum exceeds the resolved approver count.");
  return quorum;
}

export function dueAt(startedAt: Date, hours?: number | null) {
  return hours ? new Date(startedAt.getTime() + hours * 3_600_000) : null;
}
