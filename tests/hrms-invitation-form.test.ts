import { describe, expect, it } from "vitest";
import { invitationErrorMessage, invitationFormSchema } from "../src/lib/hr/auth/invitation-form";
describe("invitation form", () => {
  it.each(["password_policy", "password-policy"])("explains %s without claiming expiry", (error) => {
    expect(invitationErrorMessage(error)).toContain("12 to 128");
    expect(invitationErrorMessage(error)).toContain("must match");
    expect(invitationErrorMessage(error)).not.toContain("expired");
  });
  it("retains invalid-token guidance", () => {
    expect(invitationErrorMessage("invalid")).toContain("expired");
    expect(invitationErrorMessage()).toBeNull();
  });
  it.each([8, 11, 129, 256])("rejects length %i", (length) => {
    const password = "a".repeat(length);
    expect(invitationFormSchema.safeParse({ password, confirmPassword: password }).success).toBe(false);
  });
  it.each([12, 128])("accepts matching length %i", (length) => {
    const password = "a".repeat(length);
    expect(invitationFormSchema.safeParse({ password, confirmPassword: password }).success).toBe(true);
  });
  it("rejects mismatched confirmation", () => {
    expect(invitationFormSchema.safeParse({ password: "a".repeat(12), confirmPassword: "b".repeat(12) }).success).toBe(false);
  });
});
