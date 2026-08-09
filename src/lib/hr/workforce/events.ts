export const WORKFORCE_EVENT_STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED", "APPROVED", "SCHEDULED", "APPLYING", "APPLIED", "REJECTED", "CANCELLED", "FAILED",
] as const;

export type WorkforceEventStatus = (typeof WORKFORCE_EVENT_STATUSES)[number];

const transitions: Record<WorkforceEventStatus, readonly WorkforceEventStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "RETURNED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "RETURNED", "REJECTED", "CANCELLED"],
  RETURNED: ["SUBMITTED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "APPLYING", "CANCELLED"],
  SCHEDULED: ["APPLYING", "CANCELLED"],
  APPLYING: ["APPLIED", "FAILED"],
  APPLIED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: ["APPLYING", "CANCELLED"],
};

export function assertWorkforceEventTransition(from: WorkforceEventStatus, to: WorkforceEventStatus) {
  if (!transitions[from]?.includes(to)) {
    throw new Error(`Invalid workforce event transition: ${from} -> ${to}`);
  }
}

export type WorkforceImpactSnapshot = Partial<{
  jobProfileId: string;
  positionId: string;
  departmentId: string;
  teamId: string | null;
  managerEmployeeId: string | null;
  locationId: string | null;
  legalEntityId: string | null;
  gradeId: string | null;
  employmentType: string;
  workMode: string;
  contractVersionId: string;
  employmentStatus: string;
}>;

const impactKeys = new Set<keyof WorkforceImpactSnapshot>([
  "jobProfileId", "positionId", "departmentId", "teamId", "managerEmployeeId", "locationId", "legalEntityId", "gradeId", "employmentType", "workMode", "contractVersionId", "employmentStatus",
]);

export function assertSupportedImpactSnapshot(snapshot: Record<string, unknown>) {
  const unknown = Object.keys(snapshot).filter((key) => !impactKeys.has(key as keyof WorkforceImpactSnapshot));
  if (unknown.length) throw new Error(`Unsupported workforce event impact fields: ${unknown.join(", ")}`);
  if (!Object.keys(snapshot).length) throw new Error("A workforce event must propose at least one governed change.");
}

export function changedImpactKeys(current: WorkforceImpactSnapshot, proposed: WorkforceImpactSnapshot) {
  assertSupportedImpactSnapshot(proposed);
  return Object.keys(proposed).filter((key) => current[key as keyof WorkforceImpactSnapshot] !== proposed[key as keyof WorkforceImpactSnapshot]);
}

export function assertEventVersion(expected: number, actual: number) {
  if (expected !== actual) throw new Error("This workforce event changed while you were reviewing it. Refresh and review the latest version.");
}

export function assertIndependentApproval(initiatedById: string, approverId: string) {
  if (initiatedById === approverId) throw new Error("Independent approval is required; the event initiator cannot approve this request.");
}

export function assertEffectiveDateNotEarly(effectiveAt: Date, now: Date) {
  if (effectiveAt.getTime() > now.getTime()) throw new Error("This workforce event is scheduled for a future effective date and cannot be applied early.");
}

export function eventsConflict(
  first: { employeeId: string; effectiveAt: Date; changes: WorkforceImpactSnapshot },
  second: { employeeId: string; effectiveAt: Date; changes: WorkforceImpactSnapshot },
) {
  if (first.employeeId !== second.employeeId) return false;
  if (first.effectiveAt.getTime() !== second.effectiveAt.getTime()) return false;
  const firstKeys = new Set(Object.keys(first.changes));
  return Object.keys(second.changes).some((key) => firstKeys.has(key));
}
