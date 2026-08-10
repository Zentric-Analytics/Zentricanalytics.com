export function assertProbationDecision(input: {
  actorUserId: string;
  employeeUserId?: string | null;
  finalReviewSubmittedById?: string | null;
  finalReviewSubmitted: boolean;
  recommendation?: "CONTINUE" | "CONFIRM" | "EXTEND" | "END_EMPLOYMENT" | null;
  outcome: "CONFIRM" | "EXTEND" | "END_EMPLOYMENT";
  currentEndAt: Date;
  extensionEndAt?: Date;
  extensionCount: number;
  maximumExtensions?: number;
}) {
  if (input.employeeUserId === input.actorUserId) throw new Error("An employee cannot decide their own probation outcome.");
  if (!input.finalReviewSubmitted) throw new Error("The final probation review must be completed before an outcome is recorded.");
  if (input.finalReviewSubmittedById === input.actorUserId) throw new Error("A probation outcome requires an independent decision after the final review.");
  if (input.outcome === "CONFIRM" && input.recommendation !== "CONFIRM") throw new Error("Confirmation requires a submitted manager recommendation to confirm.");
  if (input.outcome === "EXTEND") {
    if (!input.extensionEndAt || input.extensionEndAt <= input.currentEndAt) throw new Error("A probation extension must set a later end date.");
    if (input.extensionCount >= (input.maximumExtensions ?? 1)) throw new Error("The configured probation extension limit has been reached.");
  }
}

export function assertContractVersionDecision(input: { expectedVersion: number; actualVersion: number; createdById: string; approverId: string; documentVersionId?: string | null }) {
  if (input.expectedVersion !== input.actualVersion) throw new Error("This contract changed while it was being reviewed. Review the latest version.");
  if (input.createdById === input.approverId) throw new Error("A contract version requires independent approval.");
  if (!input.documentVersionId) throw new Error("The exact generated or signed document version is required for approval.");
}

export function assertContractActivation(input: { effectiveFrom: Date; now: Date; approved: boolean; signed: boolean }) {
  if (!input.approved || !input.signed) throw new Error("Only an approved and signed contract version can become active.");
  if (input.effectiveFrom > input.now) throw new Error("A future contract version cannot activate early.");
}

export function assertSeparationTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    DRAFT: ["SUBMITTED", "CANCELLED"],
    SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
    UNDER_REVIEW: ["APPROVED", "WITHDRAWN", "REJECTED"],
    APPROVED: ["SCHEDULED", "CANCELLED"],
    SCHEDULED: ["APPLIED", "WITHDRAWN", "FAILED"],
    FAILED: ["APPLIED", "CANCELLED"],
  };
  if (!allowed[from]?.includes(to)) throw new Error(`Invalid separation transition: ${from} -> ${to}`);
}

export function assertSeparationExecution(input: { finalWorkingDate: Date; now: Date; requiredTasksOpen: number; status: string }) {
  if (!['SCHEDULED', 'FAILED'].includes(input.status)) throw new Error("The separation case is not eligible for execution.");
  if (input.finalWorkingDate > input.now) throw new Error("Employee access and assignment must not end before the final working date.");
  if (input.requiredTasksOpen > 0) throw new Error("Required offboarding tasks remain incomplete.");
}

export function assertRehire(input: { personId?: string | null; priorRelationshipStatus: string; activeRelationshipCount: number; rehireOfId?: string | null }) {
  if (!input.personId) throw new Error("Rehire requires the existing Person identity.");
  if (input.priorRelationshipStatus !== "ENDED") throw new Error("Only an ended work relationship can be rehired.");
  if (input.activeRelationshipCount > 0) throw new Error("The person already has an active work relationship.");
  if (!input.rehireOfId) throw new Error("The new work relationship must reference the former relationship.");
}
