import { describe, expect, it } from "vitest";
import { MICROSOFT_365_MAILBOX_LOGIN_URL, renderMailboxWelcome } from "../src/lib/hr/recruitment/mailbox-welcome";

const input = { companyEmail: "employee@example.test", temporaryPassword: "Synthetic<&\"'Password", replyTo: "hr@example.test" };

describe("mailbox welcome message", () => {
  it("includes mailbox instructions and confirmation to the selected HR address", () => {
    const result = renderMailboxWelcome(input);
    expect(result.text).toContain(input.companyEmail);
    expect(result.text).toContain(input.temporaryPassword);
    expect(result.text).toContain("Change the temporary password immediately");
    expect(result.text).toContain("Microsoft Authenticator");
    expect(result.text).toContain(`FROM your company mailbox (${input.companyEmail}) TO ${input.replyTo}`);
    expect(result.text).toContain("Do not simply reply from your personal inbox");
    expect(result.text).toContain("not an HRMS invitation");
    expect(result.text).toContain("separate HRMS account invitation to your company mailbox");
  });

  it("escapes HTML and keeps credentials out of the official sign-in URL and subject", () => {
    const result = renderMailboxWelcome(input);
    expect(result.html).toContain("Synthetic&lt;&amp;&quot;&#39;Password");
    expect(result.html).not.toContain(input.temporaryPassword);
    const links = [...result.html.matchAll(/href="([^"]*)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));
    expect(links).toEqual([MICROSOFT_365_MAILBOX_LOGIN_URL]);
    expect(result.subject).not.toContain(input.temporaryPassword);
    expect(Object.keys(result).sort()).toEqual(["html", "subject", "text"]);
  });

  it.each(["bad", "hr@example.test\r\nBcc: other@example.test", "<script>@example.test"])("rejects invalid reply-to without reflecting input", (replyTo) => {
    expect(() => renderMailboxWelcome({ ...input, replyTo })).toThrow("A valid HR reply-to email is required.");
  });

  it("rejects invalid company email", () => {
    expect(() => renderMailboxWelcome({ ...input, companyEmail: "invalid" })).toThrow("A valid company email is required.");
  });

  it.each(["", "  ", "synthetic\nInjected", "x".repeat(1025)])("rejects empty or control-bearing password without exposing it", (temporaryPassword) => {
    expect(() => renderMailboxWelcome({ ...input, temporaryPassword })).toThrow("A valid temporary mailbox password is required.");
  });
});
