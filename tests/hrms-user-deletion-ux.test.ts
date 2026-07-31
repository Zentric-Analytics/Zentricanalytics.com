import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { userDeletionErrorMessage } from "../src/lib/hr/users/deletion-errors";

describe("primary-admin user deletion UX", () => {
  it("returns a safe permanent-deletion failure", () => {
    const message = "The permanent deletion could not be completed.";
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

  it("releases restrictive retained references before physical deletion", () => {
    const action = readFileSync("src/app/hr/admin/users/actions.ts", "utf8");
    const helper = readFileSync("src/lib/hr/users/hard-delete.ts", "utf8");
    expect(action).toContain("releaseHrUserReferencesForDeletion");
    expect(action).toContain("The user was permanently deleted from the database.");
    expect(helper).toContain('reference.deleteRule === "CASCADE"');
    expect(helper).toContain('reference.deleteRule === "SET NULL"');
    expect(helper).toContain("primaryAdminId");
  });
});
