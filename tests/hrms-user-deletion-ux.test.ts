import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { userDeletionErrorMessage } from "../src/lib/hr/users/deletion-errors";

describe("primary-admin user deletion UX", () => {
  it("explains why a retained account cannot be permanently deleted", () => {
    const message = "Hard deletion is blocked while the user is linked to an employee record.";
    expect(userDeletionErrorMessage(new Error(message))).toBe(message);
  });

  it("does not expose unexpected deletion failures", () => {
    expect(userDeletionErrorMessage(new Error("database connection details"))).toBe(
      "The user deletion could not be completed. Refresh the page and try again.",
    );
  });

  it("submits deletion through a stateful action and renders the result inline", () => {
    const component = readFileSync("src/app/hr/admin/users/UserDeletionForm.tsx", "utf8");
    expect(component).toContain("hardDeleteHrUserWithStateAction");
    expect(component).toContain('role={state.status === "error" ? "alert" : "status"}');
    expect(component).toContain('aria-live="polite"');
  });
});
