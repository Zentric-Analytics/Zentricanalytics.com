export const VACANCY_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "RETURNED_FOR_CORRECTION", "APPROVED", "SCHEDULED",
  "OPEN", "PAUSED", "CLOSED", "FILLED", "CANCELLED",
] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "PENDING_REVIEW", "UNDER_REVIEW", "INFORMATION_REQUESTED", "SHORTLISTED",
  "INTERVIEW_PENDING", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED",
  "ASSESSMENT_PENDING", "ASSESSMENT_COMPLETED", "FINAL_REVIEW", "REJECTED",
  "WITHDRAWN", "ON_HOLD", "OFFER_DRAFT", "OFFER_PENDING_APPROVAL", "OFFER_ISSUED",
  "OFFER_ACCEPTED", "OFFER_DECLINED", "OFFER_EXPIRED", "TRANSFERRED_TO_HR",
] as const;
export type RecruitmentApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const HANDOVER_STATUSES = [
  "PENDING_HR_REVIEW", "IN_REVIEW", "INFORMATION_REQUESTED", "RETURNED_TO_HIRING_TEAM",
  "APPROVED", "CANCELLED", "CONVERTED_TO_PRE_HIRE",
] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const ONBOARDING_STATUSES = [
  "NOT_STARTED", "IN_PROGRESS", "BLOCKED", "READY_FOR_START", "COMPLETED", "CANCELLED",
] as const;
export type RecruitmentOnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

const vacancyTransitions: Record<VacancyStatus, readonly VacancyStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "RETURNED_FOR_CORRECTION", "CANCELLED"],
  RETURNED_FOR_CORRECTION: ["PENDING_APPROVAL", "CANCELLED"],
  APPROVED: ["SCHEDULED", "OPEN", "CANCELLED"],
  SCHEDULED: ["OPEN", "CANCELLED"],
  OPEN: ["PAUSED", "CLOSED", "FILLED", "CANCELLED"],
  PAUSED: ["OPEN", "CLOSED", "CANCELLED"],
  CLOSED: [],
  FILLED: [],
  CANCELLED: [],
};

const applicationTransitions: Record<RecruitmentApplicationStatus, readonly RecruitmentApplicationStatus[]> = {
  PENDING_REVIEW: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["INFORMATION_REQUESTED", "SHORTLISTED", "ON_HOLD", "REJECTED", "WITHDRAWN"],
  INFORMATION_REQUESTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW_PENDING", "ASSESSMENT_PENDING", "FINAL_REVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW_PENDING: ["INTERVIEW_SCHEDULED", "REJECTED", "WITHDRAWN"],
  INTERVIEW_SCHEDULED: ["INTERVIEW_COMPLETED", "WITHDRAWN"],
  INTERVIEW_COMPLETED: ["ASSESSMENT_PENDING", "FINAL_REVIEW", "REJECTED", "WITHDRAWN"],
  ASSESSMENT_PENDING: ["ASSESSMENT_COMPLETED", "REJECTED", "WITHDRAWN"],
  ASSESSMENT_COMPLETED: ["FINAL_REVIEW", "REJECTED", "WITHDRAWN"],
  FINAL_REVIEW: ["OFFER_DRAFT", "ON_HOLD", "REJECTED", "WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
  ON_HOLD: ["UNDER_REVIEW", "FINAL_REVIEW", "REJECTED", "WITHDRAWN"],
  OFFER_DRAFT: ["OFFER_PENDING_APPROVAL", "FINAL_REVIEW", "WITHDRAWN"],
  OFFER_PENDING_APPROVAL: ["OFFER_ISSUED", "OFFER_DRAFT", "REJECTED", "WITHDRAWN"],
  OFFER_ISSUED: ["OFFER_ACCEPTED", "OFFER_DECLINED", "OFFER_EXPIRED", "WITHDRAWN"],
  OFFER_ACCEPTED: ["TRANSFERRED_TO_HR", "WITHDRAWN"],
  OFFER_DECLINED: [],
  OFFER_EXPIRED: ["OFFER_DRAFT"],
  TRANSFERRED_TO_HR: [],
};

const handoverTransitions: Record<HandoverStatus, readonly HandoverStatus[]> = {
  PENDING_HR_REVIEW: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["INFORMATION_REQUESTED", "RETURNED_TO_HIRING_TEAM", "APPROVED", "CANCELLED"],
  INFORMATION_REQUESTED: ["IN_REVIEW", "RETURNED_TO_HIRING_TEAM", "CANCELLED"],
  RETURNED_TO_HIRING_TEAM: ["IN_REVIEW", "CANCELLED"],
  APPROVED: ["CONVERTED_TO_PRE_HIRE", "CANCELLED"],
  CANCELLED: [],
  CONVERTED_TO_PRE_HIRE: [],
};

const onboardingTransitions: Record<RecruitmentOnboardingStatus, readonly RecruitmentOnboardingStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "READY_FOR_START", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "READY_FOR_START", "CANCELLED"],
  READY_FOR_START: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class InvalidRecruitmentTransitionError extends Error {
  constructor(domain: string, from: string, to: string) {
    super(`${domain} cannot transition from ${from} to ${to}.`);
    this.name = "InvalidRecruitmentTransitionError";
  }
}

function assertTransition<T extends string>(
  domain: string,
  transitions: Record<T, readonly T[]>,
  from: T,
  to: T,
) {
  if (!transitions[from].includes(to)) throw new InvalidRecruitmentTransitionError(domain, from, to);
}

export const assertVacancyTransition = (from: VacancyStatus, to: VacancyStatus) =>
  assertTransition("Vacancy", vacancyTransitions, from, to);
export const assertApplicationTransition = (from: RecruitmentApplicationStatus, to: RecruitmentApplicationStatus) =>
  assertTransition("Application", applicationTransitions, from, to);
export const assertHandoverTransition = (from: HandoverStatus, to: HandoverStatus) =>
  assertTransition("HR handover", handoverTransitions, from, to);
export const assertOnboardingTransition = (from: RecruitmentOnboardingStatus, to: RecruitmentOnboardingStatus) =>
  assertTransition("Onboarding", onboardingTransitions, from, to);

export type RequirementEvaluation = {
  key: string;
  blocking: boolean;
  status: "NOT_STARTED" | "PENDING_SUBMISSION" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "WAIVED" | "EXPIRED";
};

export function evaluatePreHireEligibility(input: {
  handoverStatus: HandoverStatus;
  acceptedOfferValid: boolean;
  employmentDetailsComplete: boolean;
  employeeAlreadyLinked: boolean;
  requiredApprovalsComplete: boolean;
  requirements: RequirementEvaluation[];
}) {
  const blockers: string[] = [];
  if (input.handoverStatus !== "APPROVED") blockers.push("handover_not_approved");
  if (!input.acceptedOfferValid) blockers.push("accepted_offer_invalid");
  if (!input.employmentDetailsComplete) blockers.push("employment_details_incomplete");
  if (input.employeeAlreadyLinked) blockers.push("employee_already_linked");
  if (!input.requiredApprovalsComplete) blockers.push("required_approvals_missing");
  for (const requirement of input.requirements) {
    if (requirement.blocking && !["VERIFIED", "WAIVED"].includes(requirement.status)) {
      blockers.push(`requirement:${requirement.key}:${requirement.status.toLowerCase()}`);
    }
  }
  return { eligible: blockers.length === 0, blockers };
}

export function evaluateActivationReadiness(input: {
  finalHrApprovalComplete: boolean;
  blockingRequirementsComplete: boolean;
  startDate: Date;
  now: Date;
  securitySetupComplete: boolean;
  activeAssignmentExists: boolean;
  cancelledOrOnHold: boolean;
}) {
  const blockers: string[] = [];
  if (!input.finalHrApprovalComplete) blockers.push("final_hr_approval_missing");
  if (!input.blockingRequirementsComplete) blockers.push("blocking_requirements_incomplete");
  if (input.startDate.getTime() > input.now.getTime()) blockers.push("start_date_not_reached");
  if (!input.securitySetupComplete) blockers.push("security_setup_incomplete");
  if (!input.activeAssignmentExists) blockers.push("employment_assignment_missing");
  if (input.cancelledOrOnHold) blockers.push("hire_cancelled_or_on_hold");
  return { ready: blockers.length === 0, blockers };
}

export function canPublishVacancy(input: {
  status: VacancyStatus;
  activeHiringTeam: boolean;
  vacancyOwnerId?: string | null;
  responsibleHrTeamId?: string | null;
  requiredApprovalsComplete: boolean;
}) {
  const blockers: string[] = [];
  if (input.status !== "APPROVED" && input.status !== "SCHEDULED") blockers.push("vacancy_not_approved");
  if (!input.activeHiringTeam) blockers.push("active_hiring_team_missing");
  if (!input.vacancyOwnerId) blockers.push("vacancy_owner_missing");
  if (!input.responsibleHrTeamId) blockers.push("responsible_hr_team_missing");
  if (!input.requiredApprovalsComplete) blockers.push("required_approvals_missing");
  return { publishable: blockers.length === 0, blockers };
}

export function isVacancyAcceptingApplications(input: {
  status: VacancyStatus;
  opensAt?: Date | null;
  closesAt?: Date | null;
  now: Date;
  allowLateSubmission?: boolean;
}) {
  if (input.status !== "OPEN") return false;
  if (input.opensAt && input.opensAt > input.now) return false;
  if (!input.allowLateSubmission && input.closesAt && input.closesAt < input.now) return false;
  return true;
}

export const recruitmentTransitionMaps = {
  vacancy: vacancyTransitions,
  application: applicationTransitions,
  handover: handoverTransitions,
  onboarding: onboardingTransitions,
} as const;
