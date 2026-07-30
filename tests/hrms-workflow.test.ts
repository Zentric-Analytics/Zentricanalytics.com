import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeWorkflowContext, conditionMatches, dueAt, requiredApprovals, workflowDefinitionInput } from "../src/lib/hr/workflow/engine";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("generic HR workflow engine", () => {
  it("evaluates only declarative routing conditions", () => {
    const context = { amount: 500, request: { urgent: true }, region: "NG" };
    expect(conditionMatches({ field: "request.urgent", operator: "EQUALS", value: true }, context)).toBe(true);
    expect(conditionMatches({ field: "region", operator: "IN", value: ["NG", "GH"] }, context)).toBe(true);
    expect(conditionMatches({ field: "missing", operator: "EXISTS" }, context)).toBe(false);
    expect(conditionMatches({ field: "amount", operator: "NOT_EQUALS", value: 100 }, context)).toBe(true);
  });
  it("rejects sensitive or excessively nested context", () => {
    expect(() => assertSafeWorkflowContext({ request: { salary: 5000 } })).toThrow("Sensitive");
    expect(() => assertSafeWorkflowContext({ authToken: "secret" })).toThrow("Sensitive");
    let nested: unknown = "leaf";
    for (let index = 0; index < 10; index += 1) nested = { child: nested };
    expect(() => assertSafeWorkflowContext(nested)).toThrow("nesting");
  });
  it("computes ANY, ALL and QUORUM thresholds exactly", () => {
    expect(requiredApprovals("ANY", 4)).toBe(1);
    expect(requiredApprovals("ALL", 4)).toBe(4);
    expect(requiredApprovals("QUORUM", 4, 3)).toBe(3);
    expect(() => requiredApprovals("QUORUM", 2, 3)).toThrow("exceeds");
    expect(() => requiredApprovals("ANY", 0)).toThrow("at least one");
  });
  it("validates assignment strategies and bounded deadlines", () => {
    const base = { key: "expense", name: "Expense", module: "Expenses", subjectType: "ExpenseClaim" };
    expect(() => workflowDefinitionInput.parse({ ...base, stages: [{ key: "hr", name: "HR", assigneeType: "PERMISSION", assigneeUserIds: [], approvalMode: "ANY" }] })).toThrow("permission");
    expect(() => workflowDefinitionInput.parse({ ...base, stages: [{ key: "team", name: "Team", assigneeType: "USERS", assigneeUserIds: [], approvalMode: "ANY" }] })).toThrow("assignee");
    expect(dueAt(new Date("2026-08-01T00:00:00.000Z"), 48)?.toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
  it("persists immutable definitions, decisions, and non-destructive history", () => {
    const migration = read("prisma/migrations/20260730050000_hrms_workflow_engine/migration.sql");
    expect(migration).toContain("HrWorkflowDefinition_immutable");
    expect(migration).toContain("HrWorkflowApproval_immutable");
    expect(migration).toContain("HrWorkflowInstance_no_delete");
    expect(migration).toContain("one_active_definition_subject");
  });
  it("uses tenant-scoped serializable transitions and exact resolved approvers", () => {
    const actions = read("src/app/hr/admin/workflows/actions.ts");
    expect(actions).toContain("organizationId: auth.user.organizationId");
    expect(actions).toContain("approverUserIds.includes(auth.user.id)");
    expect(actions).toContain('isolationLevel: "Serializable"');
    expect(actions).toContain("hrSupervisorAssignment.findFirst");
    expect(actions).toContain("assigneePermissionKey");
  });
  it("audits and notifies without embedding protected workflow context", () => {
    const actions = read("src/app/hr/admin/workflows/actions.ts");
    expect(actions).toContain("appendHrAudit");
    expect(actions).toContain("enqueueHrEmail");
    expect(actions).toContain("payload: { workflowInstanceId:");
    expect(actions).not.toContain("payload: { context");
  });
});
