import { describe, expect, it } from "vitest";
import { maskSensitive, stage6AdminDecisionSchema, stage6CandidateSchema, toStage6SubmissionPayload } from "../src/lib/hiring";
import { validateOnboardingDocumentFile } from "../src/lib/storage";

const validStage6 = {
  session: "1234567890123456",
  fullLegalName: "Ada Candidate", preferredName: "Ada", dateOfBirth: "1990-01-01", residentialAddress: "1 Secure Street", currentCity: "Lagos", stateOfResidence: "Lagos", nationality: "Nigerian", phoneNumber: "+2348012345678", email: "ada@example.com",
  confirmedStartDate: "2026-07-01", preferredStartDateNotes: "", workModeReadiness: "Ready for hybrid work", equipmentNeeds: "Laptop and access", internetPowerReadiness: "Stable internet and backup power", availabilityForOrientation: "Available weekdays", emergencyStartConstraints: "",
  nextOfKinName: "Kin Person", nextOfKinRelationship: "Sibling", nextOfKinPhone: "+2348011111111", nextOfKinEmail: "kin@example.com", nextOfKinAddress: "2 Kin Street", emergencyContactName: "Emergency Person", emergencyContactRelationship: "Friend", emergencyContactPhone: "+2348022222222", emergencyContactAddress: "3 Help Street",
  bankName: "Secure Bank", accountName: "Ada Candidate", accountNumber: "1234567890", taxIdentificationNumber: "TIN123456", pensionProvider: "Pension Co", pensionAccountNumber: "PEN123456", nationalIdentificationNumber: "NIN123456789", statutoryContributionNotes: "",
  declarationAccuracy: "on", payrollProcessingConsent: "on", employmentAdministrationConsent: "on", finalApprovalAcknowledgement: "on", changeNotificationAgreement: "on", electronicSignatureConsent: "on", signatureName: "Ada Candidate",
};

describe("Stage 6 onboarding validation", () => {
  it("accepts a complete onboarding submission and masks sensitive values in payload", () => {
    const parsed = stage6CandidateSchema.parse(validStage6);
    const payload = toStage6SubmissionPayload(parsed);
    expect(payload.accountNumberMasked).toBe(maskSensitive(validStage6.accountNumber));
    expect(JSON.stringify(payload)).not.toContain(validStage6.accountNumber);
    expect(JSON.stringify(payload)).not.toContain(validStage6.nationalIdentificationNumber);
    expect(payload.declarations).toMatchObject({ declarationAccuracy: true, electronicSignatureConsent: true });
  });

  it("rejects missing declarations, invalid email, and invalid account number", () => {
    const parsed = stage6CandidateSchema.safeParse({ ...validStage6, email: "bad", accountNumber: "abc", declarationAccuracy: undefined });
    expect(parsed.success).toBe(false);
  });

  it("validates admin decisions and onboarding document types", () => {
    expect(stage6AdminDecisionSchema.parse({ applicationDbId: "app_1", action: "approve", notes: "Reviewed" }).action).toBe("approve");
    expect(validateOnboardingDocumentFile(new File(["x"], "proof.pdf", { type: "application/pdf" }))).toBeNull();
    expect(validateOnboardingDocumentFile(new File(["x"], "proof.exe", { type: "application/octet-stream" }))).toContain("Upload a PDF");
  });
});
