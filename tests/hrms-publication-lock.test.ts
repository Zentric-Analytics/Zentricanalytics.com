import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { lockPublicationEligibility } from "../src/lib/hr/recruitment/publication-lock";

describe("publication eligibility row locks", () => {
  it("locks the scoped vacancy before teams, members, users, roles and grants", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ createdById: "creator", vacancyOwnerId: "creator", responsibleHrUserId: "hr", hiringTeamId: "team", responsibleHrTeamId: "team" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: "member" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ roleId: "role" }])
      .mockResolvedValue([]);
    await lockPublicationEligibility({ $queryRaw: query } as unknown as Prisma.TransactionClient, "org", "vacancy");
    expect(query).toHaveBeenCalledTimes(7);
    const sql = query.mock.calls.map(([strings]) => Array.from(strings).join("?"));
    expect(sql[0]).toContain('"organizationId" = ? FOR UPDATE');
    expect(query.mock.calls[0].slice(1)).toEqual(["vacancy", "org"]);
    expect(sql[1]).toContain('"HrHiringTeam"');
    expect(sql[2]).toContain('"HrHiringTeamMember"');
    expect(sql[3]).toContain('"HrUser"');
    expect(sql[4]).toContain('"HrUserRole"');
    expect(sql[5]).toContain('"HrRole"');
    expect(sql[6]).toContain('"HrRolePermission"');
    for (const statement of sql.slice(1)) {
      expect(statement).toContain("FOR SHARE");
      expect(statement).not.toContain("KEY SHARE");
    }
  });
  it("stops for a missing scoped vacancy", async () => {
    const query = vi.fn().mockResolvedValue([]);
    await expect(lockPublicationEligibility({ $queryRaw: query } as unknown as Prisma.TransactionClient, "org", "missing")).rejects.toThrow("Scoped vacancy not found");
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("propagates a lock failure without continuing eligibility reads", async () => {
    const query = vi.fn().mockRejectedValue(new Error("serialization failure"));
    await expect(lockPublicationEligibility({ $queryRaw: query } as unknown as Prisma.TransactionClient, "org", "vacancy")).rejects.toThrow("serialization failure");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
