import { describe, expect, it } from "vitest";
import { hasCompletedAccountSecurity } from "../src/lib/hr/recruitment/states";

describe("shared account security readiness", () => {
  it.each([
    null, undefined,
    { passwordHash: null, mfaEnabled: true, status: "ACTIVE" },
    { passwordHash: "", mfaEnabled: true, status: "ACTIVE" },
    { passwordHash: "hash", mfaEnabled: false, status: "ACTIVE" },
    { passwordHash: "hash", mfaEnabled: true, status: "INVITED" },
    { passwordHash: "hash", mfaEnabled: true, status: "SUSPENDED" },
  ])("rejects incomplete or inactive accounts: %j", (user) => {
    expect(hasCompletedAccountSecurity(user)).toBe(false);
  });
  it("accepts only completed security on an active account", () => {
    expect(hasCompletedAccountSecurity({ passwordHash: "hash", mfaEnabled: true, status: "ACTIVE" })).toBe(true);
  });
});
