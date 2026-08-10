import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPasswordResetCode, normalizeHrEmail, passwordMeetsPolicy, sealHrCredential } from "../src/lib/hr/auth/crypto";
import { hrEmailContent } from "../src/lib/hr/notifications/worker";
const read = (path: string) => readFileSync(path, "utf8");
describe("HR password-reset OTP", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses the required lifetimes, cooldown, and attempt limit", () => { const service = read("src/lib/hr/auth/password-reset.ts"); expect(service).toContain("RESET_OTP_TTL_SECONDS = 600"); expect(service).toContain("RESET_SESSION_TTL_SECONDS = 600"); expect(service).toContain("RESET_RESEND_COOLDOWN_SECONDS = 60"); expect(service).toContain("RESET_ATTEMPT_LIMIT = 5"); });
  it("hashes codes with a purpose and identity namespace", () => { vi.stubEnv("AUTH_SECRET", "test-secret-that-is-longer-than-thirty-two-characters"); expect(hashPasswordResetCode("user-a", "123456")).not.toBe("123456"); expect(hashPasswordResetCode("user-a", "123456")).not.toBe(hashPasswordResetCode("user-b", "123456")); });
  it("enforces the shared 8 to 128 character password policy", () => { expect(passwordMeetsPolicy("1234567")).toBe(false); expect(passwordMeetsPolicy("12345678")).toBe(true); expect(passwordMeetsPolicy("a".repeat(129))).toBe(false); });
  it("renders a code email and a token-free completion email", () => { vi.stubEnv("AUTH_SECRET", "test-secret-that-is-longer-than-thirty-two-characters"); const otp = hrEmailContent("hr-password-reset", { credentialEnvelope: sealHrCredential("654321"), recipientName: "Employee" }, "https://staging.zentricanalytics.com"); expect(otp.body).toContain("654321"); expect(otp.body).toContain("10 minutes"); expect(otp.body).not.toContain("#token="); const done = hrEmailContent("hr-password-reset-complete", {}, "https://staging.zentricanalytics.com"); expect(done.body).toContain("sessions were signed out"); expect(done.body).not.toMatch(/654321|#token=|password=/); });
  it("configures secure scoped cookies, confirmation, and accessible redirect", () => { const actions = read("src/app/hr/password-reset/actions.ts"); const page = read("src/app/hr/password-reset/page.tsx"); expect(actions).toContain('httpOnly: true'); expect(actions).toContain('sameSite: "strict"'); expect(actions).toContain('path: "/hr/password-reset"'); expect(page).toContain('name="confirmation"'); expect(page).toContain('minLength={8}'); expect(read("src/components/HrResetRedirect.tsx")).toContain('router.replace("/hr/login")'); });
  it("preserves invitation credential-link consumption", () => { expect(read("src/lib/hr/auth/invitations.ts")).toContain("sealHrCredential"); expect(read("src/app/hr/invitation/redeem/page.tsx")).toContain("HrCredentialLinkConsumer"); });
  it("uses one account rate-limit identity for email case and whitespace variants", () => {
    const organizationId = "org-a";
    const variants = ["employee@company.com", "Employee@company.com", "EMPLOYEE@COMPANY.COM", " employee@company.com", "employee@company.com "];
    const keys = variants.map((email) => `${organizationId}:${normalizeHrEmail(email)}`);
    expect(new Set(keys)).toEqual(new Set(["org-a:employee@company.com"]));

    const allowance = new Map<string, number>();
    for (const key of keys) allowance.set(key, (allowance.get(key) ?? 0) + 1);
    expect(allowance.get("org-a:employee@company.com")).toBe(variants.length);
    expect(`${organizationId}:${normalizeHrEmail("other@company.com")}`).not.toBe(keys[0]);
  });
  it("constructs the password-reset account throttle with the canonical key helper", () => {
    const actions = read("src/app/hr/password-reset/actions.ts");
    expect(actions).toContain("const normalizedEmail = normalizeHrEmail(parsed.data.email)");
    expect(actions).toContain('key: `${orgId}:${normalizedEmail}`');
    expect(actions).not.toContain('key: `${orgId}:${parsed.data.email}`');
  });
});
