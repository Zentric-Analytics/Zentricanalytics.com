import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("governed position job-profile mapping", () => {
  it("requires an active tenant-scoped job profile when a position is created", () => {
    const page = read("src/app/hr/admin/positions/page.tsx");
    const actions = read("src/app/hr/admin/positions/actions.ts");

    expect(page).toContain('name="jobProfileId"');
    expect(page).toContain("Select job profile");
    expect(actions).toContain("positionCreateInput");
    expect(actions).toContain("jobProfileId: z.string().cuid()");
    expect(actions).toContain("id: input.jobProfileId, organizationId, status: \"ACTIVE\"");
    expect(actions).not.toContain('hrJobProfile.findUniqueOrThrow({ where: { organizationId_code');
  });
});
