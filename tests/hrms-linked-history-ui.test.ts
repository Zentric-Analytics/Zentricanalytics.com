import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("linked history UI data minimization", () => {
  it("restricts employee audit metadata by permission, organization and stable identifiers", () => {
    const page = readFileSync("src/app/hr/admin/employees/[id]/page.tsx", "utf8");
    expect(page).toContain('auth.permissions.has("audit.read")');
    expect(page).toContain('organizationId: auth.user.organizationId, OR:');
    expect(page).toContain('entityType: "HrEmployee", entityId: employee.id');
    expect(page).toContain('entityType: "HrUser", entityId: employee.userId');
    expect(page).toContain('entityType: "JobApplication", entityId: employee.recruitmentApplicationId');
    expect(page).toContain('select: { id: true, createdAt: true, action: true, actor: { select: { email: true } } }');
    expect(page).not.toContain('event.newValues');
    expect(page).not.toContain('event.previousValues');
    expect(page).toContain('href={`/hr/recruitment/${employee.recruitmentApplicationId}`}');
  });
  it("access history fetches metadata, never invitation tokens or retained message bodies", () => {
    const page = readFileSync("src/app/hr/recruitment/[id]/access/page.tsx", "utf8");
    expect(page).toContain('vacancy.responsibleHrUserId !== auth.user.id && !auth.user.isPrimaryAdmin');
    expect(page).toContain('select: { id: true, createdAt: true, status: true }');
    expect(page).toContain('where: { organizationId: auth.user.organizationId, userId: app.hrEmployee.userId }');
    expect(page).toContain('expiresAt: true, usedAt: true, status: true');
    expect(page).not.toContain('tokenHash');
    expect(page).not.toContain('email.body');
    expect(page).not.toContain('credentialEnvelope');
    expect(page).toContain('Creation is not proof of delivery');
  });
});
