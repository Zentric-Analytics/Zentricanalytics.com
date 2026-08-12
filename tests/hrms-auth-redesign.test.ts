import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
describe("HRMS authentication redesign", () => {
  it("keeps credentials and authenticator code on separate routes", () => {
    const login = read("src/app/hr/login/page.tsx"); const form = read("src/app/hr/login/LoginForm.tsx"); const authenticator = read("src/app/hr/login/authenticator/page.tsx");
    expect(login).not.toContain("mfaCode"); expect(form).not.toContain("one-time-code"); expect(authenticator).toContain("Enter authenticator code"); expect(authenticator).toContain("authenticator app");
  });
  it("binds a short-lived encrypted MFA challenge before session creation", () => {
    const actions = read("src/app/hr/login/actions.ts");
    expect(actions).toContain("sealHrCredential"); expect(actions).toContain("httpOnly: true"); expect(actions).toContain("CHALLENGE_TTL = 5 * 60"); expect(actions).toContain("challenge.ipHash !== sha256(ip)");
  });
  it("uses real notification counts in the authenticated header", () => {
    const layout = read("src/app/hr/admin/layout.tsx"); const shell = read("src/components/HrAdminShell.tsx");
    expect(layout).toContain("hrNotification.findMany"); expect(layout).toContain("notifications.filter(item => !item.readAt).length"); expect(shell).toContain("HrNotificationCenter"); expect(shell).toContain("unread={unread}");
  });
});
