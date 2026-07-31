import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { positionDecisionErrorMessage } from "../src/lib/hr/organization/position-action-errors";

describe("position decision authorization UX", () => {
  it("turns the requester separation-of-duties denial into a clear instruction", () => {
    expect(positionDecisionErrorMessage(
      new Error("Position requester cannot approve or reject their own request."),
    )).toBe(
      "You cannot approve or reject a position request that you created. Ask a different authorized administrator to review it.",
    );
  });

  it("does not expose unexpected server errors", () => {
    expect(positionDecisionErrorMessage(new Error("database connection details"))).toBe(
      "The position decision could not be completed. Refresh the page and try again.",
    );
  });

  it("renders the decision result in an accessible inline status region", () => {
    const component = readFileSync(
      "src/app/hr/admin/positions/PositionDecisionForm.tsx",
      "utf8",
    );
    expect(component).toContain('role={state.status === "error" ? "alert" : "status"}');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("useActionState");
  });
});
