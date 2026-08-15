import { describe, expect, it, vi } from "vitest";
import { readUnit9Evidence, unit9EvidenceKinds } from "../src/lib/hr/payroll/unit9-evidence-service";
import fs from "node:fs";
import path from "node:path";

describe("Unit 9 candidate evidence isolation", () => {
  it.each(unit9EvidenceKinds)("tenant-scopes known-ID %s reads and returns no foreign record", async (kind) => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = new Proxy({}, { get: () => ({ findFirst }) });
    await expect(readUnit9Evidence(db as never, "tenant-a", kind, "known-tenant-b-id")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledOnce();
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "known-tenant-b-id", organizationId: "tenant-a" });
  });

  it("never selects encrypted RTA identifiers or pension RSA values", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = new Proxy({}, { get: () => ({ findFirst }) });
    await readUnit9Evidence(db as never, "tenant-a", "rta", "rta-id");
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("taxIdentifierEncrypted");
    await readUnit9Evidence(db as never, "tenant-a", "pension", "pension-id");
    expect(findFirst.mock.calls[1][0].select).not.toHaveProperty("rsaEncrypted");
  });

  it("fails generic administrators and employees before lookup and uses privacy-safe 404s", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/hr/payroll/unit9/evidence/[kind]/[id]/route.ts"), "utf8");
    expect(route).toContain('permissions.has("payroll.statutory.read")');
    expect(route.indexOf('permissions.has("payroll.statutory.read")')).toBeLessThan(route.indexOf("readUnit9Evidence(prisma"));
    expect(route.match(/status: 404/g)).toHaveLength(2);
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).not.toContain("taxIdentifierEncrypted");
    expect(route).not.toContain("rsaEncrypted");
  });
});
