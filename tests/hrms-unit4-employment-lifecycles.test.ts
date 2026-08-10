import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertContractActivation, assertContractVersionDecision, assertProbationDecision, assertRehire, assertSeparationExecution, assertSeparationTransition } from "../src/lib/hr/workforce/employment-lifecycles";

describe("Unit 4 probation, contract, separation, and rehire invariants", () => {
  it("requires an independent completed probation review", () => {
    const base = { actorUserId: "hr", employeeUserId: "employee", finalReviewSubmitted: true, finalReviewSubmittedById: "manager", recommendation: "CONFIRM" as const, outcome: "CONFIRM" as const, currentEndAt: new Date("2026-09-01"), extensionCount: 0 };
    expect(() => assertProbationDecision(base)).not.toThrow();
    expect(() => assertProbationDecision({ ...base, actorUserId: "employee" })).toThrow(/cannot decide/);
    expect(() => assertProbationDecision({ ...base, actorUserId: "manager" })).toThrow(/independent decision/);
    expect(() => assertProbationDecision({ ...base, finalReviewSubmitted: false })).toThrow(/final probation review/);
  });

  it("prevents silent or repeated probation extensions", () => {
    const base = { actorUserId: "hr", employeeUserId: "employee", finalReviewSubmitted: true, finalReviewSubmittedById: "manager", recommendation: "EXTEND" as const, outcome: "EXTEND" as const, currentEndAt: new Date("2026-09-01"), extensionCount: 0 };
    expect(() => assertProbationDecision({ ...base, extensionEndAt: new Date("2026-10-01") })).not.toThrow();
    expect(() => assertProbationDecision({ ...base, extensionEndAt: new Date("2026-08-01") })).toThrow(/later end date/);
    expect(() => assertProbationDecision({ ...base, extensionEndAt: new Date("2026-10-01"), extensionCount: 1 })).toThrow(/limit/);
  });

  it("protects exact contract versions and effective dates", () => {
    expect(() => assertContractVersionDecision({ expectedVersion: 2, actualVersion: 3, createdById: "a", approverId: "b", documentVersionId: "dv" })).toThrow(/latest version/);
    expect(() => assertContractVersionDecision({ expectedVersion: 2, actualVersion: 2, createdById: "a", approverId: "a", documentVersionId: "dv" })).toThrow(/independent/);
    expect(() => assertContractActivation({ effectiveFrom: new Date("2026-09-01"), now: new Date("2026-08-01"), approved: true, signed: true })).toThrow(/cannot activate early/);
  });

  it("keeps notice-period access until effective separation", () => {
    expect(() => assertSeparationTransition("DRAFT", "SUBMITTED")).not.toThrow();
    expect(() => assertSeparationTransition("APPLIED", "DRAFT")).toThrow(/Invalid separation transition/);
    expect(() => assertSeparationExecution({ finalWorkingDate: new Date("2026-09-01"), now: new Date("2026-08-31"), requiredTasksOpen: 0, status: "SCHEDULED" })).toThrow(/before the final working date/);
    expect(() => assertSeparationExecution({ finalWorkingDate: new Date("2026-09-01"), now: new Date("2026-09-01"), requiredTasksOpen: 1, status: "SCHEDULED" })).toThrow(/tasks remain/);
  });

  it("rehire reuses Person and links the ended relationship", () => {
    expect(() => assertRehire({ personId: "person-1", priorRelationshipStatus: "ENDED", activeRelationshipCount: 0, rehireOfId: "old-wr" })).not.toThrow();
    expect(() => assertRehire({ personId: null, priorRelationshipStatus: "ENDED", activeRelationshipCount: 0, rehireOfId: "old-wr" })).toThrow(/existing Person/);
    expect(() => assertRehire({ personId: "person-1", priorRelationshipStatus: "ENDED", activeRelationshipCount: 1, rehireOfId: "old-wr" })).toThrow(/already has an active/);
  });

  it("uses an additive lifecycle migration", () => {
    const sql = readFileSync("prisma/migrations/20260809103000_hrms_unit4_employment_lifecycles/migration.sql", "utf8");
    expect(sql).toContain('CREATE TABLE "HrProbationCase"');
    expect(sql).toContain('CREATE TABLE "HrEmploymentContract"');
    expect(sql).toContain('CREATE TABLE "HrSeparationCase"');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/);
  });

  it("routes separation through independent, versioned, fail-closed execution", () => {
    const commands = readFileSync("src/lib/hr/workforce/lifecycle-commands.ts", "utf8");
    const actions = readFileSync("src/app/hr/admin/employees/actions.ts", "utf8");
    expect(commands).toContain("A separation case requires independent review");
    expect(commands).toContain("version: input.expectedVersion");
    expect(commands).toContain("requiredTasksOpen");
    expect(commands).toContain('? "SCHEDULED" : input.decision');
    expect(actions).toContain("createSeparationCase");
    expect(actions).not.toContain("terminateEmployeeAction");
  });

  it("implements probation, exact-version contracts, and identity-preserving rehire", () => {
    const commands = readFileSync("src/lib/hr/workforce/lifecycle-commands.ts", "utf8");
    expect(commands).toContain("createProbationCase");
    expect(commands).toContain("submitProbationReview");
    expect(commands).toContain("decideProbationCase");
    expect(commands).toContain("assertContractVersionDecision");
    expect(commands).toContain("documentVersionId");
    expect(commands).toContain("assertContractActivation");
    expect(commands).toContain("assertRehire");
    expect(commands).toContain("personId: prior.personId");
    expect(commands).toContain("rehireOfId: prior.id");
    expect(commands).toContain('template: "hr-rehire-started"');
    expect(commands).toContain("rehire-started:${relationship.id}");
  });

  it("exposes lifecycle actions without bypassing domain commands", () => {
    const actions = readFileSync("src/app/hr/admin/employment-lifecycle/actions.ts", "utf8");
    expect(actions).toContain("createProbationCase");
    expect(actions).toContain("submitProbationReview");
    expect(actions).toContain("decideProbationCase");
    expect(actions).toContain("createContractVersion");
    expect(actions).toContain("approveContractVersion");
    expect(actions).toContain("reviewSeparationCase");
    expect(actions).toContain("rehireEmployee");
    expect(actions.match(/isolationLevel: "Serializable"/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it("accepts preserved legacy work-relationship identifiers during rehire", () => {
    const actions = readFileSync("src/app/hr/admin/employment-lifecycle/actions.ts", "utf8");
    expect(actions).toContain("priorRelationshipId: z.string().trim().min(1).max(191)");
    expect(actions).not.toContain("priorRelationshipId: z.string().cuid()");
  });
});
