import { describe, expect, it } from "vitest";
import { canApproveReviewedVacancy, type VacancyAuthority } from "../src/lib/hr/recruitment/vacancy-authority";

const primary: VacancyAuthority = { id: "primary", isPrimaryAdmin: true, roles: ["ADMIN"] };
const secondary: VacancyAuthority = { id: "secondary", isPrimaryAdmin: false, roles: ["ADMIN"] };
const hr: VacancyAuthority = { id: "hr", isPrimaryAdmin: false, roles: ["HR_ADMIN"] };
const employee: VacancyAuthority = { id: "employee", isPrimaryAdmin: false, roles: ["EMPLOYEE"] };
describe("owner-reviewed vacancy approval routes", () => {
  it("allows primary self approval only for their own vacancy", () => {
    expect(canApproveReviewedVacancy(primary, primary)).toBe(true);
    expect(canApproveReviewedVacancy(primary, secondary)).toBe(false);
    expect(canApproveReviewedVacancy(primary, hr)).toBe(false);
  });
  it("routes secondary-created vacancies to primary or HR", () => {
    expect(canApproveReviewedVacancy(secondary, primary)).toBe(true);
    expect(canApproveReviewedVacancy(secondary, hr)).toBe(true);
    expect(canApproveReviewedVacancy(secondary, secondary)).toBe(false);
    expect(canApproveReviewedVacancy(secondary, { ...secondary, id: "another" })).toBe(false);
  });
  it("routes HR-created vacancies to primary or secondary", () => {
    expect(canApproveReviewedVacancy(hr, primary)).toBe(true);
    expect(canApproveReviewedVacancy(hr, secondary)).toBe(true);
    expect(canApproveReviewedVacancy(hr, hr)).toBe(false);
  });
  it("never grants vacancy approval to employee-only accounts", () => {
    for (const creator of [primary, secondary, hr, employee]) {
      expect(canApproveReviewedVacancy(creator, employee)).toBe(false);
    }
    expect(canApproveReviewedVacancy(employee, primary)).toBe(false);
  });
});
