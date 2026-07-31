import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vacancyInput } from "../src/lib/hr/recruitment/vacancies";

const valid = {
  title: "Senior Data Engineer",
  departmentId: "cm1234567890123456789012",
  hiringTeamId: "cm1234567890123456789013",
  responsibleHrTeamId: "cm1234567890123456789014",
  vacancyOwnerId: "cm1234567890123456789015",
  employmentType: "FULL_TIME",
  workMode: "HYBRID",
  numberOfOpenings: 2,
  description: "Design and operate reliable data products and platform services for enterprise analytics teams.",
  responsibilities: "Build pipelines\nReview architecture",
  minimumQualifications: "Five years experience",
  preferredQualifications: "Cloud certification",
  requiredDocuments: "CV\nQualification evidence",
  screeningQuestions: "Describe a reliable pipeline.",
  currency: "ngn",
  publicSalary: false,
};

describe("governed vacancy input", () => {
  it("normalizes structured public fields", () => {
    const result = vacancyInput.parse({
      ...valid,
      opensAt: "",
      applicationDeadline: "",
      scheduledPublishAt: "",
    });
    expect(result.currency).toBe("NGN");
    expect(result.responsibilities).toEqual(["Build pipelines", "Review architecture"]);
    expect(result.opensAt).toBeUndefined();
    expect(result.applicationDeadline).toBeUndefined();
    expect(result.scheduledPublishAt).toBeUndefined();
  });

  it("rejects invalid date and salary ranges", () => {
    expect(() => vacancyInput.parse({
      ...valid,
      opensAt: "2026-08-10T00:00:00Z",
      applicationDeadline: "2026-08-01T00:00:00Z",
      salaryMinimum: 100,
      salaryMaximum: 50,
    })).toThrow();
  });
});

describe("public vacancy projection", () => {
  it("submits the enum value while presenting a readable employment-type label", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/hr/admin/vacancies/page.tsx"), "utf8");
    expect(source).toContain("<option value={item} key={item}>{item.replaceAll");
  });

  it("uses an explicit safe select and does not expose internal routing or approval records", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/careers/page.tsx"), "utf8");
    expect(source).toContain("select: {");
    expect(source).toContain("publicSalary: true");
    expect(source).not.toContain("include: { hiringTeam");
    expect(source).not.toContain("approval comments");
  });
});
