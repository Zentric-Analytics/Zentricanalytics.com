import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/hr/security/CopyAuthenticatorValue.tsx"),
  "utf8",
);
const pageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/hr/security/page.tsx"),
  "utf8",
);

describe("MFA authenticator value copy controls", () => {
  it("copies the protected value through the browser clipboard API", () => {
    expect(componentSource).toContain("navigator.clipboard.writeText(value)");
    expect(componentSource).not.toContain("console.");
  });

  it("provides accessible success and failure feedback", () => {
    expect(componentSource).toContain('aria-label={label}');
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain('aria-live="polite"');
    expect(componentSource).toContain("Copied to clipboard.");
    expect(componentSource).toContain("Copy failed.");
  });

  it("offers copy controls for both the manual key and setup link", () => {
    expect(pageSource).toContain("<CopyAuthenticatorValue value={pendingSecret}");
    expect(pageSource).toContain(
      '<CopyAuthenticatorValue value={provisioningUri} label="Copy authenticator setup link"',
    );
  });
});
