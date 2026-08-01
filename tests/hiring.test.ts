import { describe, expect, it } from "vitest";
import {
  adminActionAuditName,
  canDownloadDocument,
  isStage1DownloadEligible,
  sanitizeDownloadFilenamePart,
  generateApplicationId,
  getStage1ApprovalEffects,
  initialApplicationSchema,
  isAccessCodeUsable,
  isStageStatus,
  maskSensitive,
  toStage1SubmissionPayload,
  toStageStatus,
} from "../src/lib/hiring";
import {
  renderSubmittedDocumentText,
  STAGE1_PDF_FIELD_MAP,
} from "../src/lib/pdf";
import { buildFullLegalName, normalizePhoneForCountry } from "../src/lib/phone";
import {
  experienceLevelOptions,
  roleAppliedForOptions,
} from "../src/lib/recruitment-options";
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  MAX_CV_BYTES,
  validateCvFile,
} from "../src/lib/storage";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { applicantIdentityFilter } from "../src/lib/hr/recruitment/applicant-identity";

const payload = {
  firstName: "Ada",
  middleInitial: "B",
  lastName: "Lovelace",
  preferredName: "Ada",
  residentialAddress: "12 Example Street, Lagos",
  email: "ada@example.com",
  phoneCountryIso: "NG",
  phoneNational: "08012345678",
  stateOfResidence: "Lagos",
  lgaOfResidence: "Ikeja",
  nationality: "Nigerian",
  rightToWorkNigeria: "Yes",
  genderForHr: "Prefer not to say",
  role: "Data Analyst",
  employmentType: "Full-time",
  workMode: "Remote",
  availableStartDate: "2026-07-01",
  noticePeriod: "2 weeks",
  salaryExpectation: "Negotiable",
  salaryNegotiable: "Yes",
  canWorkMondayFriday: "Yes",
  preferredWorkingTime: "9am-5pm",
  heardAboutUs: "Company website",
  skills: "SQL, Python",
  portfolioUrl: "https://github.com/ada",
  portfolioAvailable: "Yes",
  certificatesAvailable: "Yes",
  certificatesNote: "Available on request",
  otherDocumentNote: "None",
  educationHistory: "BSc Computer Science, Example University",
  employmentHistory: "Data analyst projects using SQL and Python.",
  message: "I am interested in this role because I can contribute immediately.",
  referee1Name: "Grace Hopper",
  referee1CompanyRole: "Example Ltd / Manager",
  referee1Relationship: "Supervisor",
  referee1Phone: "+2348000000000",
  referee1Email: "grace@example.com",
  referee1MayContact: "Yes",
  referee2Name: "Alan Turing",
  referee2CompanyRole: "Example Labs / Lead",
  referee2Relationship: "Mentor",
  referee2Phone: "+2348111111111",
  referee2Email: "alan@example.com",
  referee2MayContact: "No",
  declarationAccuracy: "on",
  privacyConsent: "on",
  signatureName: "Ada B Lovelace",
  signatureConsent: "on",
};
const file = (name: string, type: string, size = 12) =>
  new File([new Uint8Array(size)], name, { type });
const utf16PdfHex = (value: string) =>
  `<FEFF${[...value]
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("")
    .toUpperCase()}>`;
const utf16PdfHexFragment = (value: string) => utf16PdfHex(value).slice(5, -1);

describe("hiring workflow helpers", () => {
  it("matches existing applicants by email, not a reused phone number", () => {
    expect(applicantIdentityFilter({ organizationId: "org-1", normalizedEmail: "  GeneralDeveloper2@ZentricAnalytics.com " })).toEqual({ organizationId: "org-1", normalizedEmail: "generaldeveloper2@zentricanalytics.com" });
  });

  it("generates formatted application ids", () => {
    expect(generateApplicationId(41, new Date("2026-06-21T00:00:00Z"))).toBe(
      "ZA-APP-2026-00041",
    );
  });
  it("validates Stage 1 payloads and computes submitted name/phone/role", () => {
    const result = initialApplicationSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = toStage1SubmissionPayload(result.data);
      expect(data.fullName).toBe("Ada B Lovelace");
      expect(data.phoneE164).toBe("+2348012345678");
      expect(data.roleAppliedFor).toBe("Data Analyst");
      expect(data.location).toBe("Ikeja, Lagos");
    }
  });
  it("generates full legal names from split fields", () => {
    expect(buildFullLegalName("Ada", "B", "Lovelace")).toBe("Ada B Lovelace");
    expect(buildFullLegalName("Ada", "", "Lovelace")).toBe("Ada Lovelace");
  });
  it("exposes required role and experience dropdown values", () => {
    expect(roleAppliedForOptions).toContain("Junior Frontend Developer");
    expect(roleAppliedForOptions).toContain("Other");
    expect(experienceLevelOptions).toContain("No professional experience yet");
    expect(experienceLevelOptions).toContain("Manager");
  });
  it("accepts valid Nigerian, US, and UK phone numbers and normalizes E.164 values", () => {
    expect(normalizePhoneForCountry("NG", "0801 234 5678")).toMatchObject({
      valid: true,
      e164: "+2348012345678",
      countryName: "Nigeria",
      dialCode: "+234",
      nationalNumber: "8012345678",
    });
    expect(normalizePhoneForCountry("US", "(415) 555-2671")).toMatchObject({
      valid: true,
      e164: "+14155552671",
    });
    expect(normalizePhoneForCountry("GB", "07911 123456")).toMatchObject({
      valid: true,
      e164: "+447911123456",
    });
    expect(normalizePhoneForCountry("NG", "8012345678")).toMatchObject({
      valid: true,
      e164: "+2348012345678",
    });
    expect(normalizePhoneForCountry("NG", "0701 234 5678")).toMatchObject({
      valid: true,
      e164: "+2347012345678",
    });
    expect(normalizePhoneForCountry("NG", "0812 345 6789")).toMatchObject({
      valid: true,
      e164: "+2348123456789",
    });
    expect(normalizePhoneForCountry("NG", "0903 456 7890")).toMatchObject({
      valid: true,
      e164: "+2349034567890",
    });
    expect(normalizePhoneForCountry("NG", "+234 801-234-5678")).toMatchObject({
      valid: true,
      e164: "+2348012345678",
    });
    expect(normalizePhoneForCountry("NG", "+234 916-345-6789")).toMatchObject({
      valid: true,
      e164: "+2349163456789",
    });
    expect(normalizePhoneForCountry("NG", "0916 345 6789")).toMatchObject({
      valid: true,
      e164: "+2349163456789",
    });
    expect(normalizePhoneForCountry("NG", "9153456789")).toMatchObject({
      valid: true,
      e164: "+2349153456789",
    });
    expect(normalizePhoneForCountry("GB", "+44 20 7946 0958")).toMatchObject({
      valid: true,
      e164: "+442079460958",
    });
  });
  it("rejects truly invalid or unsafe phone values without overly strict formatting checks", () => {
    expect(normalizePhoneForCountry("NG", "1111111111")).toMatchObject({
      valid: false,
    });
    expect(normalizePhoneForCountry("US", "123")).toMatchObject({
      valid: false,
    });
    expect(normalizePhoneForCountry("ZZ", "08012345678")).toMatchObject({
      valid: false,
      error: "Select a valid country.",
    });
    expect(
      initialApplicationSchema.safeParse({ ...payload, phoneNational: "123" })
        .success,
    ).toBe(false);
  });
  it("accepts PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP uploads and rejects unsupported formats", () => {
    expect(validateCvFile(file("cv.pdf", "application/pdf"))).toBeNull();
    expect(validateCvFile(file("cv.doc", "application/msword"))).toBeNull();
    expect(
      validateCvFile(
        file(
          "cv.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toBeNull();
    expect(validateCvFile(file("cv.jpg", "image/jpeg"))).toBeNull();
    expect(validateCvFile(file("cv.jpeg", "image/pjpeg"))).toBeNull();
    expect(validateCvFile(file("cv.png", "image/png"))).toBeNull();
    expect(validateCvFile(file("cv.webp", "image/webp"))).toBeNull();
    expect(validateCvFile(file("cv.pdf", ""))).toBeNull();
    expect(
      validateCvFile(file("cv.docx", "application/octet-stream")),
    ).toBeNull();
    expect(validateCvFile(file("cv.svg", "image/svg+xml"))).toContain(
      "PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP",
    );
    expect(
      validateCvFile(file("cv.exe", "application/octet-stream")),
    ).toContain("PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP");
  });
  it("returns a file-specific error when the Stage 1 upload is missing", () => {
    expect(validateCvFile(null)).toContain("Upload your CV");
  });
  it("enforces the 20MB Stage 1 upload limit by default", () => {
    expect(DEFAULT_UPLOAD_MAX_BYTES).toBe(20971520);
    expect(MAX_CV_BYTES).toBe(20971520);
    expect(
      validateCvFile(
        file("cv.pdf", "application/pdf", DEFAULT_UPLOAD_MAX_BYTES),
      ),
    ).toBeNull();
    expect(
      validateCvFile(
        file("cv.pdf", "application/pdf", DEFAULT_UPLOAD_MAX_BYTES - 1),
      ),
    ).toBeNull();
    expect(
      validateCvFile(
        file("cv.pdf", "application/pdf", DEFAULT_UPLOAD_MAX_BYTES + 1),
      ),
    ).toContain("20MB or smaller");
  });

  it("Stage 1 form renders focused required fields and an independent submit button", () => {
    const page = readFileSync(
      "src/app/apply/Stage1ApplicationForm.tsx",
      "utf8",
    );
    [
      "firstName",
      "middleInitial",
      "lastName",
      "preferredName",
      "residentialAddress",
      "email",
      "phoneCountryIso",
      "phoneNational",
      "role",
      "otherRole",
      "employmentType",
      "workMode",
      "experienceLevel",
      "skills",
      "portfolioUrl",
      "message",
      "cv",
      "declarationAccuracy",
      "privacyConsent",
      "signatureName",
      "signatureConsent",
    ].forEach((name) => expect(page).toContain(`name="${name}"`));
    [
      "genderForHr",
      "rightToWorkNigeria",
      "salaryExpectation",
      "salaryNegotiable",
      "availableStartDate",
      "noticePeriod",
      "canWorkMondayFriday",
      "preferredWorkingTime",
      "heardAboutUs",
      "certificatesAvailable",
      "certificatesNote",
      "otherDocumentNote",
      "educationHistory",
      "employmentHistory",
      "referee1Name",
      "referee2Name",
    ].forEach((name) => expect(page).not.toContain(`name="${name}"`));
    expect(page).toContain("disabled={pending}");
    expect(page).toContain("Submit stage 1 application");
    expect(page.indexOf("Declaration and signature")).toBeLessThan(
      page.indexOf("Submit stage 1 application"),
    );
  });
  it("Stage 1 form clears server errors on edit and explains file reselection", () => {
    const page = readFileSync(
      "src/app/apply/Stage1ApplicationForm.tsx",
      "utf8",
    );
    expect(page).toContain("clearedErrors");
    expect(page).toContain("editedSinceServerError");
    expect(page).toContain("visibleMessage");
    expect(page).toContain("clearFieldError(name)");
    expect(page).toContain("clearFieldError('cv')");
    expect(page).toContain("validateVisibleFileSelection");
    expect(page).toContain("Please reselect your CV/resume before submitting again.");
    expect(page).toContain("onInvalid={()=>setFileNeedsReselection(true)}");
    expect(page).toContain("disabled={pending}");
  });
  it("removed Stage 1 PDF fields are optional while a focused submission passes", () => {
    const focused = {
      firstName: "Ada",
      middleInitial: "B",
      lastName: "Lovelace",
      preferredName: "Ada",
      residentialAddress: "Ikeja, Lagos",
      email: "ada@example.com",
      phoneCountryIso: "NG",
      phoneNational: "08012345678",
      role: "Data Analyst",
      employmentType: "Full-time",
      workMode: "Remote",
      experienceLevel: "Intermediate",
      skills: "SQL, Python",
      portfolioUrl: "https://github.com/ada",
      message:
        "I am interested in this role because I can contribute immediately.",
      declarationAccuracy: "on",
      privacyConsent: "on",
      signatureName: "Ada B Lovelace",
      signatureConsent: "on",
    };
    const result = initialApplicationSchema.safeParse(focused);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = toStage1SubmissionPayload(result.data);
      expect(data.location).toBe("Ikeja, Lagos");
      expect(data.roleAppliedFor).toBe("Data Analyst");
    }
    expect(
      initialApplicationSchema.safeParse({ ...focused, message: "" }).success,
    ).toBe(false);
  });
  it("returns field-specific schema failures for missing required name and signature confirmation", () => {
    const missingName = initialApplicationSchema.safeParse({
      ...payload,
      firstName: "",
    });
    expect(missingName.success).toBe(false);
    if (!missingName.success)
      expect(
        missingName.error.issues.some(
          (issue) =>
            issue.path[0] === "firstName" &&
            issue.message.includes("first name"),
        ),
      ).toBe(true);
    const missingSignature = initialApplicationSchema.safeParse({
      ...payload,
      signatureConsent: undefined,
    });
    expect(missingSignature.success).toBe(false);
    if (!missingSignature.success)
      expect(
        missingSignature.error.issues.some(
          (issue) => issue.path[0] === "signatureConsent",
        ),
      ).toBe(true);
  });
  it("narrows database status strings to valid stage statuses", () => {
    expect(isStageStatus("Submitted")).toBe(true);
    expect(isStageStatus("Unexpected")).toBe(false);
    expect(toStageStatus("Approved")).toBe("Approved");
    expect(toStageStatus("Unexpected")).toBe("Locked");
    expect(toStageStatus(null, "Available")).toBe("Available");
  });
  it("blocks and allows downloads according to full Stage 1 eligibility state", () => {
    expect(
      canDownloadDocument("Approved", true, "2026-06-21", "2026-06-21"),
    ).toBe(true);
    expect(
      canDownloadDocument("Completed", true, "2026-06-21", "2026-06-21"),
    ).toBe(true);
    expect(
      canDownloadDocument("Under Review", true, "2026-06-21", "2026-06-21"),
    ).toBe(false);
    expect(
      canDownloadDocument("Available", true, "2026-06-21", "2026-06-21"),
    ).toBe(false);
    expect(
      canDownloadDocument("Approved", false, "2026-06-21", "2026-06-21"),
    ).toBe(false);
    expect(canDownloadDocument("Approved", true, null, "2026-06-21")).toBe(
      false,
    );
    expect(canDownloadDocument("Approved", true, "2026-06-21", null)).toBe(
      false,
    );
    expect(
      isStage1DownloadEligible({
        stagePresent: true,
        submissionPresent: true,
        submissionSubmitted: true,
        signaturePresent: true,
        signatureConfirmed: true,
        signedAtPresent: true,
        stageStatus: "Approved",
      }),
    ).toBe(true);
    expect(
      isStage1DownloadEligible({
        stagePresent: true,
        submissionPresent: true,
        submissionSubmitted: true,
        signaturePresent: true,
        signatureConfirmed: true,
        signedAtPresent: false,
        stageStatus: "Approved",
      }),
    ).toBe(false);
  });
  it("sanitizes Stage 1 PDF download filenames", () => {
    expect(sanitizeDownloadFilenamePart("ZA/APP 2026:00041")).toBe(
      "ZA-APP-2026-00041",
    );
    expect(
      `${sanitizeDownloadFilenamePart("ZA/APP 2026:00041")}-stage-1-official.pdf`,
    ).toBe("ZA-APP-2026-00041-stage-1-official.pdf");
  });
  it("renders official Zentric document structure and masks sensitive values", () => {
    const doc = renderSubmittedDocumentText({
      title: "Candidate Information",
      applicantName: "Ada",
      applicationId: "ZA-APP-2026-00041",
      fields: [{ label: "ID number", value: "12345678901", sensitive: true }],
      signatureName: "Ada",
      submittedAt: "2026-06-21",
      version: 1,
      status: "Submitted",
    });
    expect(doc).toContain("Zentric Analytics Ltd");
    expect(doc).toContain("PRIVATE & CONFIDENTIAL");
    expect(doc).toContain("Employment Application");
    expect(doc).toContain("Candidate Data Privacy Acknowledgement");
    expect(doc).toContain("For Zentric Use Only");
    expect(doc).toContain("*******8901");
    expect(doc).not.toContain("12345678901");
    expect(maskSensitive("abcdef")).toBe("****cdef");
  });
  it("expires and verifies access code usability", () => {
    const now = new Date("2026-06-22T12:00:00Z");
    expect(
      isAccessCodeUsable({ expiresAt: new Date("2026-06-22T12:01:00Z") }, now),
    ).toBe(true);
    expect(
      isAccessCodeUsable({ expiresAt: new Date("2026-06-22T11:59:00Z") }, now),
    ).toBe(false);
    expect(
      isAccessCodeUsable(
        { expiresAt: new Date("2026-06-22T12:01:00Z"), usedAt: now },
        now,
      ),
    ).toBe(false);
  });
  it("describes Stage 1 approval unlocking Stage 2", () => {
    expect(getStage1ApprovalEffects()).toEqual({
      stage1Status: "Approved",
      stage2Status: "Available",
      applicationStatus: "Candidate Information Required",
      currentStageOrder: 2,
    });
  });
  it("maps admin actions to audit log actions", () => {
    expect(adminActionAuditName("approve")).toBe("Admin approved Stage 1");
    expect(adminActionAuditName("reject")).toBe("Admin rejected Stage 1");
    expect(adminActionAuditName("correction")).toBe(
      "Admin requested correction",
    );
  });
});

import {
  createAdminSessionToken,
  hashAdminPassword,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "../src/lib/admin-auth";
import {
  renderSubmittedDocumentPdf,
  STAGE_1_TEMPLATE_PATH,
} from "../src/lib/pdf";
import { hashRateLimitKey } from "../src/lib/rate-limit";
import {
  assertPrivateUploadStorageConfigured,
  deletePrivateUpload,
  PrivateUploadStorageConfigurationError,
  privateUploadConfigurationStatus,
  privateUploadDiagnostic,
  privateUploadExists,
  readPrivateUpload,
  resolvePrivateUploadPath,
  savePrivateUpload,
  selectedStorageProvider,
} from "../src/lib/storage";

describe("production hardening helpers", () => {
  it("hashes and verifies admin passwords without plaintext storage", () => {
    const hash = hashAdminPassword(
      "correct horse battery staple",
      "abc123abc123abc1",
    );
    expect(hash).toMatch(/^pbkdf2_sha256\$/);
    expect(verifyAdminPassword("correct horse battery staple", hash)).toBe(
      true,
    );
    expect(verifyAdminPassword("wrong", hash)).toBe(false);
  });
  it("signs short-lived admin sessions", () => {
    process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
    const token = createAdminSessionToken("admin@example.com", 1000);
    expect(verifyAdminSessionToken(token, 2000)?.email).toBe(
      "admin@example.com",
    );
    expect(verifyAdminSessionToken(token.replace(/.$/, "x"), 2000)).toBeNull();
    expect(
      verifyAdminSessionToken(token, 1000 + 5 * 60 * 60 * 1000),
    ).toBeNull();
  });
  it("generates the Stage 1 PDF from the official template and overlays applicant values", async () => {
    expect(existsSync(STAGE_1_TEMPLATE_PATH)).toBe(true);
    const pdf = await renderSubmittedDocumentPdf({
      title: "Candidate Information",
      applicantName: "Ada B Lovelace",
      applicationId: "ZA-APP-2026-00041",
      fields: [
        { label: "First name", value: "Ada" },
        { label: "Middle initial", value: "B" },
        { label: "Last name", value: "Lovelace" },
        { label: "Email", value: "ada@example.com" },
        { label: "Preferred name", value: "Ada" },
        { label: "Residential address", value: "12 Example Street, Lagos" },
        { label: "State of residence", value: "Lagos" },
        { label: "LGA of residence", value: "Ikeja" },
        { label: "Nationality", value: "Nigerian" },
        { label: "Right to work Nigeria", value: "Yes" },
        { label: "Gender for HR record", value: "Prefer not to say" },
        { label: "Phone country name", value: "Nigeria" },
        { label: "Phone E164", value: "+2348012345678" },
        { label: "Phone display", value: "Nigeria +2348012345678" },
        { label: "Location", value: "Lagos, Nigeria" },
        { label: "Role applied for", value: "Data Analyst" },
        { label: "Employment type", value: "Full-time" },
        { label: "Work mode", value: "Remote" },
        { label: "Available start date", value: "2026-07-01" },
        { label: "Notice period", value: "2 weeks" },
        { label: "Salary expectation", value: "Negotiable" },
        { label: "Salary negotiable", value: "Yes" },
        { label: "Can work Monday Friday", value: "Yes" },
        { label: "Preferred working time", value: "9am-5pm" },
        { label: "Heard about us", value: "Company website" },
        { label: "Skills", value: "SQL, Python" },
        { label: "Portfolio URL", value: "https://github.com/ada" },
        { label: "Education history", value: "BSc Computer Science" },
        { label: "Employment history", value: "Data analyst projects" },
        { label: "Declaration accuracy", value: "on" },
        { label: "Privacy consent", value: "true" },
      ],
      documents: [
        {
          label: "Stage 1 CV",
          value: "ada-cv.pdf (application/pdf, 1000 bytes)",
        },
      ],
      signatureName: "Ada B Lovelace",
      submittedAt: "2026-06-21T10:00:00.000Z",
      signedAt: "2026-06-21T10:01:00.000Z",
      version: 1,
      status: "Under Review",
    });
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain("/Count 4");
    expect(raw).toContain("/FlateDecode");
    expect(raw).toContain(utf16PdfHexFragment("ZA-APP-2026-00041"));
    expect(raw).toContain(utf16PdfHexFragment("Ada B Lovelace"));
    expect(raw).not.toContain("session-token");
    expect(raw).not.toContain("123456");
    expect(raw).not.toContain("private/storage/key");
    expect(raw).not.toContain("secret-key");
  });
  it("renders a valid PDF with removed public fields blank for new focused submissions", async () => {
    const pdf = await renderSubmittedDocumentPdf({
      title: "Candidate Information",
      applicantName: "Ada B Lovelace",
      applicationId: "ZA-APP-2026-00042",
      fields: [
        { label: "First name", value: "Ada" },
        { label: "Middle initial", value: "B" },
        { label: "Last name", value: "Lovelace" },
        { label: "Email", value: "ada@example.com" },
        { label: "Residential address", value: "Ikeja, Lagos" },
        { label: "Phone country name", value: "Nigeria" },
        { label: "Phone E164", value: "+2348012345678" },
        { label: "Role applied for", value: "Data Analyst" },
        { label: "Employment type", value: "Full-time" },
        { label: "Work mode", value: "Remote" },
        { label: "Experience level", value: "Intermediate" },
        { label: "Skills", value: "SQL, Python" },
        { label: "Portfolio URL", value: "https://github.com/ada" },
        {
          label: "Message",
          value:
            "I am interested in this role because I can contribute immediately.",
        },
        { label: "Declaration accuracy", value: "on" },
        { label: "Privacy consent", value: "on" },
      ],
      documents: [
        {
          label: "Stage 1 CV",
          value: "ada-cv.pdf (application/pdf, 1000 bytes)",
        },
      ],
      signatureName: "Ada B Lovelace",
      submittedAt: "2026-06-21T10:00:00.000Z",
      signedAt: "2026-06-21T10:01:00.000Z",
      version: 1,
      status: "Under Review",
    });
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain("/Count 4");
    expect(raw).toContain(utf16PdfHexFragment("ZA-APP-2026-00042"));
    expect(raw).toContain(utf16PdfHexFragment("Ada B Lovelace"));
    expect(raw).not.toContain("session-token");
    expect(raw).not.toContain("secret-key");
  });
  it("exposes a Stage 1 coordinate map covering major applicant PDF fields", () => {
    const keys = STAGE1_PDF_FIELD_MAP.map((entry) => entry.fieldKey);
    [
      "fullName",
      "residentialAddress",
      "rightToWorkNigeria",
      "genderForHr",
      "employmentType",
      "workMode",
      "documentsSubmitted",
      "educationHistory",
      "skills",
      "referee1",
      "referee2",
      "privacyConsent",
      "signatureName",
    ].forEach((key) => expect(keys).toContain(key));
    expect(
      STAGE1_PDF_FIELD_MAP.every(
        (entry) =>
          entry.page >= 1 &&
          entry.x >= 0 &&
          entry.y >= 0 &&
          entry.maxWidth > 0 &&
          entry.fontSize > 0,
      ),
    ).toBe(true);
  });

  it("saves, reads, checks, and deletes local-private uploads through one safe helper", async () => {
    const previousRoot = process.env.PRIVATE_UPLOAD_ROOT;
    const previousProvider = process.env.PRIVATE_OBJECT_STORAGE_PROVIDER;
    const root = await mkdtemp(path.join(os.tmpdir(), "zentric-private-"));
    process.env.PRIVATE_UPLOAD_ROOT = root;
    process.env.PRIVATE_OBJECT_STORAGE_PROVIDER = "local-private";
    try {
      const upload = await savePrivateUpload(
        file("../Ada CV.pdf", "application/pdf", 5),
        "ZA-APP-2026-00001",
      );
      expect(upload.provider).toBe("local-private");
      expect(upload.restricted).toBe(true);
      expect(upload.storageKey).toContain("ZA-APP-2026-00001");
      expect(upload.storageKey).not.toContain("..");
      expect(await privateUploadExists(upload.storageKey, upload.provider)).toBe(true);
      const stored = await readPrivateUpload(upload.storageKey, upload.provider);
      expect(stored.sizeBytes).toBe(5);
      await deletePrivateUpload(upload.storageKey, upload.provider);
      expect(await privateUploadExists(upload.storageKey, upload.provider)).toBe(false);
    } finally {
      if (previousRoot === undefined) delete process.env.PRIVATE_UPLOAD_ROOT;
      else process.env.PRIVATE_UPLOAD_ROOT = previousRoot;
      if (previousProvider === undefined) delete process.env.PRIVATE_OBJECT_STORAGE_PROVIDER;
      else process.env.PRIVATE_OBJECT_STORAGE_PROVIDER = previousProvider;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prevents storage keys escaping the private upload directory", async () => {
    const previousRoot = process.env.PRIVATE_UPLOAD_ROOT;
    const root = await mkdtemp(path.join(os.tmpdir(), "zentric-private-"));
    process.env.PRIVATE_UPLOAD_ROOT = root;
    try {
      expect(() => resolvePrivateUploadPath("../secret.pdf")).toThrow(
        "Invalid private upload key.",
      );
      expect(() => resolvePrivateUploadPath(path.resolve(root, "x.pdf"))).toThrow(
        "Invalid private upload key.",
      );
    } finally {
      if (previousRoot === undefined) delete process.env.PRIVATE_UPLOAD_ROOT;
      else process.env.PRIVATE_UPLOAD_ROOT = previousRoot;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports diagnostics for available and missing private upload files", async () => {
    const previousRoot = process.env.PRIVATE_UPLOAD_ROOT;
    const root = await mkdtemp(path.join(os.tmpdir(), "zentric-private-"));
    process.env.PRIVATE_UPLOAD_ROOT = root;
    try {
      const upload = await savePrivateUpload(file("cv.pdf", "application/pdf", 3), "app-1");
      await expect(privateUploadDiagnostic(upload.storageKey, upload.provider)).resolves.toMatchObject({
        provider: "local-private",
        storageKeyPresent: true,
        privateUploadRootConfigured: true,
        resolvedPrivateUploadRoot: root,
        localPrivateStorageAvailable: true,
        fileExists: true,
        rootExists: true,
        rootWritable: true,
        expectedResolvedFilePath: resolvePrivateUploadPath(upload.storageKey),
        fileSizeOnDisk: 3,
      });
      await unlink(resolvePrivateUploadPath(upload.storageKey));
      await expect(privateUploadDiagnostic(upload.storageKey, upload.provider)).resolves.toMatchObject({ fileExists: false });
    } finally {
      if (previousRoot === undefined) delete process.env.PRIVATE_UPLOAD_ROOT;
      else process.env.PRIVATE_UPLOAD_ROOT = previousRoot;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a controlled missing-file condition for orphaned upload metadata", async () => {
    const previousRoot = process.env.PRIVATE_UPLOAD_ROOT;
    const root = await mkdtemp(path.join(os.tmpdir(), "zentric-private-"));
    process.env.PRIVATE_UPLOAD_ROOT = root;
    try {
      const upload = await savePrivateUpload(file("cv.pdf", "application/pdf", 3), "app-1");
      await unlink(resolvePrivateUploadPath(upload.storageKey));
      expect(await privateUploadExists(upload.storageKey, upload.provider)).toBe(false);
      await expect(readPrivateUpload(upload.storageKey, upload.provider)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      if (previousRoot === undefined) delete process.env.PRIVATE_UPLOAD_ROOT;
      else process.env.PRIVATE_UPLOAD_ROOT = previousRoot;
      await rm(root, { recursive: true, force: true });
    }
  });


  it("saves private bytes before committing uploaded document metadata", () => {
    const action = readFileSync("src/app/apply/actions.ts", "utf8").replace(/\r\n/g, "\n");
    expect(action.indexOf("await savePrivateUpload(file, applicationPublicId)")).toBeGreaterThan(-1);
    expect(action.indexOf("await savePrivateUpload(file, applicationPublicId)")).toBeLessThan(
      action.indexOf("tx.uploadedDocument.create"),
    );
    expect(action).toContain("savedUploads.push(upload)");
    expect(action).toContain("deletePrivateUpload(upload.storageKey, upload.provider)");
  });

  it("redirects after the Stage 1 cleanup try/catch so successful uploads are not deleted", () => {
    const action = readFileSync("src/app/apply/actions.ts", "utf8").replace(/\r\n/g, "\n");
    const catchStart = action.indexOf("} catch (error) {");
    const catchEnd = action.indexOf("\n  }\n\n  redirect(`/apply?submitted=", catchStart);
    const successRedirect = action.indexOf("redirect(`/apply?submitted=", catchStart);

    expect(catchStart).toBeGreaterThan(-1);
    expect(catchEnd).toBeGreaterThan(catchStart);
    expect(successRedirect).toBeGreaterThan(catchEnd);
    expect(action.slice(catchStart, catchEnd)).toContain("if (!metadataCommitted)");
    expect(action.slice(catchStart, catchEnd)).toContain("deletePrivateUpload(upload.storageKey, upload.provider)");
    expect(action.slice(catchStart, catchEnd)).not.toContain("redirect(`/apply?submitted=");
  });

  it("requires an explicit private upload root for local production or staging uploads", () => {
    const previousRoot = process.env.PRIVATE_UPLOAD_ROOT;
    const previousAppEnv = process.env.APP_ENV;
    delete process.env.PRIVATE_UPLOAD_ROOT;
    process.env.APP_ENV = "staging";
    try {
      expect(() => assertPrivateUploadStorageConfigured()).toThrow(PrivateUploadStorageConfigurationError);
      expect(() => assertPrivateUploadStorageConfigured()).toThrow("PRIVATE_UPLOAD_ROOT must be configured");
    } finally {
      if (previousRoot === undefined) delete process.env.PRIVATE_UPLOAD_ROOT;
      else process.env.PRIVATE_UPLOAD_ROOT = previousRoot;
      if (previousAppEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousAppEnv;
    }
  });

  it("accepts complete S3-compatible configuration for applicant uploads", () => {
    const keys = [
      "PRIVATE_OBJECT_STORAGE_PROVIDER",
      "OBJECT_STORAGE_ENDPOINT",
      "OBJECT_STORAGE_BUCKET",
      "OBJECT_STORAGE_REGION",
      "OBJECT_STORAGE_ACCESS_KEY_ID",
      "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    ] as const;
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      PRIVATE_OBJECT_STORAGE_PROVIDER: "s3-compatible",
      OBJECT_STORAGE_ENDPOINT: "https://storage.staging.example",
      OBJECT_STORAGE_BUCKET: "unit3-staging",
      OBJECT_STORAGE_REGION: "auto",
      OBJECT_STORAGE_ACCESS_KEY_ID: "staging-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "staging-secret",
    });
    try {
      expect(selectedStorageProvider()).toBe("s3-compatible");
      expect(() => assertPrivateUploadStorageConfigured()).not.toThrow();
      const source = readFileSync("src/lib/storage.ts", "utf8");
      expect(source).toContain("await storage.put(key, bytes");
      expect(source).toContain("return hrObjectStorage().exists(storageKey)");
      expect(source).toContain("await hrObjectStorage().delete(storageKey)");
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  it("returns a safe application form error when stage 1 upload storage is not configured", () => {
    const action = readFileSync("src/app/apply/actions.ts", "utf8");
    expect(action).toContain("error instanceof PrivateUploadStorageConfigurationError");
    expect(action).toContain("Application upload storage is not configured. Please contact support.");
    expect(action).toContain("applicationUploadStorageRejected");
    expect(action).toContain("PRIVATE_UPLOAD_ROOT missing");
    expect(action).toContain("upload rejected before DB metadata creation");
    expect(action.indexOf("await savePrivateUpload(file, applicationPublicId)")).toBeLessThan(
      action.indexOf("tx.uploadedDocument.create"),
    );
  });

  it("documents that local-private production storage needs a persistent private volume", async () => {
    const envExample = readFileSync(".env.staging.example", "utf8");
    const renderConfig = readFileSync("render.yaml", "utf8");
    const deploymentDocs = readFileSync("HIRING_PHASE2.md", "utf8");
    delete process.env.PRIVATE_UPLOAD_ROOT;
    const status = await privateUploadConfigurationStatus();
    expect(status.localPrivateUsesDefaultEphemeralPath).toBe(true);
    expect(envExample).toContain("persistent private volume");
    expect(envExample).toContain("PRIVATE_UPLOAD_ROOT=/var/data/zentric-private-uploads");
    expect(envExample).toContain("PRIVATE_OBJECT_STORAGE_PROVIDER=local-private");
    expect(renderConfig).toContain("mountPath: /var/data");
    expect(renderConfig).toContain("PRIVATE_UPLOAD_ROOT");
    expect(renderConfig).toContain("/var/data/zentric-private-uploads");
    expect(deploymentDocs).toContain("Stage 1 CV upload");
    expect(deploymentDocs).toContain("Stage 2 government ID/photo upload");
    expect(deploymentDocs).toContain("Stage 3 assessment upload");
    expect(deploymentDocs).toContain("admin View/Download controls");
    expect(deploymentDocs).toContain("missing-file warning");
  });

  it("selects local-private storage fallback and hashes rate-limit keys", () => {
    delete process.env.PRIVATE_OBJECT_STORAGE_PROVIDER;
    expect(selectedStorageProvider()).toBe("local-private");
    const hashed = hashRateLimitKey("ip@example");
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain("ip@example");
  });
});

describe("admin auth robustness", () => {
  it("verifies correct passwords and rejects wrong passwords", () => {
    const hash = hashAdminPassword(
      "correct horse battery staple",
      "abc123abc123abc1",
    );
    expect(verifyAdminPassword("correct horse battery staple", hash)).toBe(
      true,
    );
    expect(verifyAdminPassword("wrong", hash)).toBe(false);
  });
  it("normalizes ADMIN_EMAIL spaces and uppercase for matching diagnostics", async () => {
    const mod = await import("../src/lib/admin-auth");
    process.env.ADMIN_EMAIL = "  ADMIN@EXAMPLE.COM  ";
    process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(
      "pw",
      "abc123abc123abc1",
    );
    process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
    const diagnostics = mod.buildAdminLoginDiagnostics(
      " admin@example.com ",
      true,
    );
    expect(diagnostics.submittedEmailMatchesConfiguredEmail).toBe(true);
    expect(mod.getConfiguredAdminEmail()).toBe("admin@example.com");
  });
  it("verifies ADMIN_PASSWORD_HASH with surrounding spaces", () => {
    const hash = `  ${hashAdminPassword("pw", "abc123abc123abc1")}  `;
    expect(verifyAdminPassword("pw", hash)).toBe(true);
  });
  it("verifies ADMIN_PASSWORD_HASH with surrounding quotes", () => {
    const hash = `"${hashAdminPassword("pw", "abc123abc123abc1")}"`;
    expect(verifyAdminPassword("pw", hash)).toBe(true);
    expect(
      verifyAdminPassword(
        "pw",
        `'${hashAdminPassword("pw", "abc123abc123abc1")}'`,
      ),
    ).toBe(true);
  });
  it("rejects ADMIN_PASSWORD_HASH values that include the variable name with safe diagnostics", async () => {
    const mod = await import("../src/lib/admin-auth");
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD_HASH = `ADMIN_PASSWORD_HASH=${hashAdminPassword("pw", "abc123abc123abc1")}`;
    process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
    const diagnostics = mod.buildAdminLoginDiagnostics(
      "admin@example.com",
      mod.verifyAdminPassword("pw"),
    );
    expect(diagnostics.passwordHashConfigured).toBe(true);
    expect(diagnostics.passwordHashFormatValid).toBe(false);
    expect(diagnostics.passwordVerified).toBe(false);
  });
  it("fails safely for malformed hashes", async () => {
    const mod = await import("../src/lib/admin-auth");
    for (const value of [
      "",
      "pbkdf2_sha256",
      "sha1$310000$salt$abcd",
      "pbkdf2_sha256$0$salt$abcd",
      "pbkdf2_sha256$abc$salt$abcd",
      "pbkdf2_sha256$310000$$abcd",
      "pbkdf2_sha256$310000$salt$not-hex",
    ]) {
      expect(mod.parseAdminPasswordHash(value)).toBeNull();
      expect(mod.verifyAdminPassword("pw", value)).toBe(false);
    }
  });
  it("detects ADMIN_SESSION_SECRET shorter than 32 characters", async () => {
    const mod = await import("../src/lib/admin-auth");
    expect(mod.isAdminSessionSecretLengthValid("x".repeat(31))).toBe(false);
    expect(mod.isAdminSessionSecretLengthValid("x".repeat(32))).toBe(true);
  });
  it("diagnostics never include secrets", async () => {
    const mod = await import("../src/lib/admin-auth");
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD_HASH = hashAdminPassword(
      "super-secret-password",
      "abc123abc123abc1",
    );
    process.env.ADMIN_SESSION_SECRET =
      "secret-session-value-that-is-long-enough";
    const diagnostics = mod.buildAdminLoginDiagnostics(
      "admin@example.com",
      false,
    );
    const text = JSON.stringify(diagnostics);
    expect(text).not.toContain("admin@example.com");
    expect(text).not.toContain("super-secret-password");
    expect(text).not.toContain("pbkdf2_sha256");
    expect(text).not.toContain("abc123abc123abc1");
    expect(text).not.toContain("secret-session-value");
  });
});

describe("Stage 1 download and admin safety source checks", () => {
  it("candidate portal and route do not expose applicant-facing downloads", () => {
    const portal = readFileSync("src/app/track/portal/page.tsx", "utf8");
    const route = readFileSync(
      "src/app/api/candidate/documents/stage-1/route.ts",
      "utf8",
    );
    expect(portal).toContain(
      "Your initial application is under review. The next step will",
    );
    expect(portal).not.toContain("Stage1DownloadButton");
    expect(portal).not.toContain("/api/candidate/documents/stage-1");
    expect(portal).not.toContain("Download PDF");
    expect(route).toContain("Document download is currently unavailable.");
    expect(route).toContain("status: 404");
    expect(route).toContain("no-store");
    expect(route).not.toContain("renderSubmittedDocumentPdf");
    expect(route).not.toContain("storageKey");
    expect(route).not.toContain("verifiedSessionTokenHash");
  });
  it("admin document routes require admin, return safe statuses, and avoid unsafe request exposure", () => {
    const stageRoute = readFileSync(
      "src/app/api/admin/applications/[applicationId]/documents/stage-1/route.ts",
      "utf8",
    );
    const uploadRoute = readFileSync(
      "src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts",
      "utf8",
    );
    const storage = readFileSync("src/lib/storage.ts", "utf8");
    expect(stageRoute).toContain("requireAdminSession");
    expect(stageRoute).toContain("application/pdf");
    expect(stageRoute).toContain("attachment; filename=");
    expect(stageRoute).toContain("Admin downloaded Stage 1 PDF");
    expect(uploadRoute).toContain("requireAdminSession");
    expect(uploadRoute).toContain(
      "where: { id: documentId, applicationId }",
    );
    expect(uploadRoute).toContain("PREVIEW_SAFE_MIME_TYPES");
    expect(uploadRoute).toContain("Unauthorized");
    expect(uploadRoute).toContain("Document not found");
    expect(uploadRoute).toContain("status === 404");
    expect(uploadRoute).toContain("Temporary document download error");
    expect(uploadRoute).toContain("privateUploadDiagnostic");
    expect(uploadRoute).toContain("Stored file missing from private storage");
    expect(uploadRoute).toContain("inline");
    expect(uploadRoute).toContain("attachment");
    expect(uploadRoute).toContain("Admin viewed uploaded document");
    expect(uploadRoute).toContain("Admin downloaded uploaded document");
    expect(uploadRoute).not.toContain(
      "request.nextUrl.searchParams.get('storageKey')",
    );
    expect(storage).toContain("resolvePrivateUploadPath");
    expect(storage).toContain("path.relative(root, resolved)");
    expect(storage).toContain("readPrivateUpload");
    expect(storage).toContain("privateUploadExists");
    expect(storage).toContain("Private upload write verification failed.");
    expect(storage).toContain("privateUploadSaveDiagnostic");
    expect(storage).toContain("fileExistsAfterSave");
    expect(storage).toContain("databaseMetadataSizeBytes");
  });
  it("admin uploaded document UI renders official PDF plus View and Download controls", () => {
    const detail = readFileSync(
      "src/app/admin/applications/[id]/page.tsx",
      "utf8",
    );
    const actions = readFileSync(
      "src/app/admin/applications/[id]/AdminDocumentActions.tsx",
      "utf8",
    );
    expect(detail).toContain("Official documents");
    expect(detail).toContain("AdminDocumentActions");
    expect(detail).toContain("Stage 1 PDF is not available yet.");
    expect(detail).toContain("Uploaded documents");
    expect(detail).toContain("No uploaded documents found.");
    expect(detail).toContain("Admin storage diagnostics");
    expect(detail).toContain("Expected resolved file path");
    expect(detail).toContain("databaseMetadataSizeBytes");
    expect(actions).toContain("View");
    expect(actions).toContain("Download");
    expect(actions).toContain("Preparing...");
    expect(actions).toContain("fetch");
    expect(actions).toContain("Download disabled because the private file is missing on disk.");
    expect(actions).toContain("available?: boolean");
    expect(actions).toContain("window.open");
    expect(actions).toContain(
      "Stored file missing from private storage. The upload record exists, but the file is not available on this server. Ask the candidate to re-upload, or restore the file from backup.",
    );
    expect(detail).toContain(
      "/api/admin/applications/${application.id}/uploads/${uploadedDocument.id}",
    );
  });
  it("document buttons stay outside stage action forms", () => {
    const detail = readFileSync(
      "src/app/admin/applications/[id]/page.tsx",
      "utf8",
    );
    expect(detail.indexOf("Official documents")).toBeLessThan(
      detail.indexOf("Stage 1 admin actions"),
    );
    expect(detail.indexOf("Uploaded documents")).toBeLessThan(
      detail.indexOf("Stage 1 admin actions"),
    );
    const actions = readFileSync(
      "src/app/admin/applications/[id]/AdminDocumentActions.tsx",
      "utf8",
    );
    expect(actions).toContain('type="button"');
    expect(actions).not.toContain("<form");
  });
  it("safe diagnostics do not expose private document details", () => {
    const uploadRoute = readFileSync(
      "src/app/api/admin/applications/[applicationId]/uploads/[documentId]/route.ts",
      "utf8",
    );
    const diagnosticBlock = uploadRoute.slice(
      uploadRoute.indexOf("type Diagnostic"),
      uploadRoute.indexOf("export async function GET"),
    );
    expect(diagnosticBlock).toContain("adminAuthenticated");
    expect(diagnosticBlock).toContain("privateUploadReadSucceeded");
    expect(diagnosticBlock).toContain("storageKeyPresent");
    [
      "fullPath",
      "fileName",
      "email",
      "cookie",
      "session",
      "token",
      "secret",
      "buffer",
    ].forEach((unsafe) => expect(diagnosticBlock).not.toContain(unsafe));
  });
  it("admin action catches failures, redirects with safe state, and revalidates list plus detail pages", () => {
    const actions = readFileSync(
      "src/app/admin/applications/actions.ts",
      "utf8",
    );
    expect(actions).toContain("try {");
    expect(actions).toContain("catch (error)");
    expect(actions).toContain("adminStageActionDiagnostics");
    expect(actions).toContain("warning=email_failed");
    expect(actions).toContain("revalidatePath('/admin/applications')");
    expect(actions).toContain(
      "revalidatePath(`/admin/applications/${applicationId}`)",
    );
    expect(actions).not.toContain("console.error");
    expect(actions).not.toContain("stack");
  });
});
