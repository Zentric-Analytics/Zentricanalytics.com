import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  HANDOVER_STATUSES,
  ONBOARDING_STATUSES,
  VACANCY_STATUSES,
  assertApplicationTransition,
  assertHandoverTransition,
  assertOnboardingTransition,
  assertVacancyTransition,
  canPublishVacancy,
  evaluateActivationReadiness,
  evaluatePreHireEligibility,
  isVacancyAcceptingApplications,
  recruitmentTransitionMaps,
} from "../src/lib/hr/recruitment/states";

describe("connected recruitment lifecycle state machines", () => {
  it("defines every required controlled status", () => {
    expect(VACANCY_STATUSES).toContain("RETURNED_FOR_CORRECTION");
    expect(APPLICATION_STATUSES).toContain("TRANSFERRED_TO_HR");
    expect(HANDOVER_STATUSES).toContain("CONVERTED_TO_PRE_HIRE");
    expect(ONBOARDING_STATUSES).toContain("READY_FOR_START");
  });

  it("accepts every declared transition and rejects every undeclared transition", () => {
    const domains = [
      [recruitmentTransitionMaps.vacancy, assertVacancyTransition],
      [recruitmentTransitionMaps.application, assertApplicationTransition],
      [recruitmentTransitionMaps.handover, assertHandoverTransition],
      [recruitmentTransitionMaps.onboarding, assertOnboardingTransition],
    ] as const;
    for (const [map, assert] of domains) {
      const transitionMap = map as Record<string, readonly string[]>;
      const assertDomainTransition = assert as (from: never, to: never) => void;
      for (const from of Object.keys(transitionMap)) {
        for (const to of Object.keys(transitionMap)) {
          if (transitionMap[from].includes(to)) {
            expect(() => assertDomainTransition(from as never, to as never)).not.toThrow();
          } else {
            expect(() => assertDomainTransition(from as never, to as never)).toThrow(/cannot transition/);
          }
        }
      }
    }
  });
});

describe("server-side recruitment gates", () => {
  it("blocks publishing without an approved vacancy, team, owners, and approvals", () => {
    expect(canPublishVacancy({
      status: "DRAFT",
      activeHiringTeam: false,
      vacancyOwnerId: null,
      responsibleHrTeamId: null,
      requiredApprovalsComplete: false,
    })).toEqual({
      publishable: false,
      blockers: [
        "vacancy_not_approved",
        "active_hiring_team_missing",
        "vacancy_owner_missing",
        "responsible_hr_team_missing",
        "required_approvals_missing",
      ],
    });
  });

  it("enforces vacancy status and deadline at submission time", () => {
    const now = new Date("2026-08-01T12:00:00Z");
    expect(isVacancyAcceptingApplications({ status: "OPEN", now, closesAt: new Date("2026-08-02T00:00:00Z") })).toBe(true);
    expect(isVacancyAcceptingApplications({ status: "PAUSED", now })).toBe(false);
    expect(isVacancyAcceptingApplications({ status: "OPEN", now, closesAt: new Date("2026-07-31T00:00:00Z") })).toBe(false);
  });

  it("blocks pre-hire conversion for every failed server-side requirement", () => {
    const result = evaluatePreHireEligibility({
      handoverStatus: "IN_REVIEW",
      acceptedOfferValid: false,
      employmentDetailsComplete: false,
      employeeAlreadyLinked: true,
      requiredApprovalsComplete: false,
      requirements: [{ key: "identity", blocking: true, status: "REJECTED" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("requirement:identity:rejected");
    expect(result.blockers).toHaveLength(6);
  });

  it("allows verified or explicitly waived blocking requirements", () => {
    expect(evaluatePreHireEligibility({
      handoverStatus: "APPROVED",
      acceptedOfferValid: true,
      employmentDetailsComplete: true,
      employeeAlreadyLinked: false,
      requiredApprovalsComplete: true,
      requirements: [
        { key: "identity", blocking: true, status: "VERIFIED" },
        { key: "licence", blocking: true, status: "WAIVED" },
      ],
    }).eligible).toBe(true);
  });

  it("prevents employee activation before all readiness gates pass", () => {
    const result = evaluateActivationReadiness({
      finalHrApprovalComplete: false,
      blockingRequirementsComplete: false,
      startDate: new Date("2026-08-02T00:00:00Z"),
      now: new Date("2026-08-01T00:00:00Z"),
      securitySetupComplete: false,
      activeAssignmentExists: false,
      cancelledOrOnHold: true,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toHaveLength(6);
  });
});
