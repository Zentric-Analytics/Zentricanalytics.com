import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { appendHrAudit } from "../src/lib/hr/audit";

describe("HR audit persistence boundary", () => {
  it("drops extra command fields while preserving audit context and sanitizing values", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit" });
    const client = { hrAuditEvent: { create } } as unknown as Prisma.TransactionClient;
    const context = { organizationId: "org", actorUserId: "actor", applicationId: "app", password: "must-not-persist" };
    await appendHrAudit(client, { ...context, entityType: "HrEmployee", entityId: "employee",
      action: "hr.recruitment.employment_reconciled", correlationId: "correlation",
      newValues: { applicationId: "app", password: "must-be-redacted" },
    });
    const data = create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("applicationId");
    expect(data).not.toHaveProperty("password");
    expect(data).toMatchObject({ organizationId: "org", actorUserId: "actor", entityId: "employee",
      correlationId: "correlation", newValues: { applicationId: "app", password: "[REDACTED]" } });
  });
  it("propagates persistence failures so the enclosing transaction cannot silently succeed", async () => {
    const create = vi.fn().mockRejectedValue(new Error("audit unavailable"));
    await expect(appendHrAudit({ hrAuditEvent: { create } } as unknown as Prisma.TransactionClient,
      { organizationId: "org", entityType: "HrEmployee", action: "repair" })).rejects.toThrow("audit unavailable");
  });
});
