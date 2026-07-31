"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { maskGeneric, randomDigits, randomToken, sha256 } from "@/lib/security";
import { sendAndRecordEmail } from "@/lib/email";
import { accessCodeEmail, offerAcceptedEmail } from "../../lib/email-templates";
import {
  stage2SubmissionSchema,
  stage3SubmissionSchema,
  toStage2SubmissionPayload,
  toStage3SubmissionPayload,
  parseStage3Metadata,
  stage5CandidateSubmissionSchema,
  toStage5SubmissionPayload,
  stage6CandidateSchema,
  toStage6SubmissionPayload,
  stage7CandidateSchema,
  toStage7SubmissionPayload,
} from "../../lib/hiring";
import {
  deletePrivateUpload,
  savePrivateUpload,
  validateCvFile,
  validateIdentityDocumentFile,
  validateOnboardingDocumentFile,
} from "../../lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { accessCodeRateLimitConfig } from "@/lib/access-code-config";

type RedirectStatus = "requested" | "limited" | "error";

function trackUrl(
  status: RedirectStatus,
  applicationId: string,
  email: string,
) {
  const params = new URLSearchParams({ applicationId, email });
  params.set(status === "requested" ? "requested" : status, "1");
  const path = status === "requested" ? "/track/verify" : "/track";
  return `${path}?${params.toString()}`;
}

function verifyUrl(applicationId: string, email: string) {
  const params = new URLSearchParams({
    applicationId,
    email,
    requested: "1",
    verified: "0",
  });
  return `/track/verify?${params.toString()}`;
}

function safeDiagnostics(event: string, diagnostics: Record<string, unknown>) {
  console.info("trackAccessCode", { event, ...diagnostics });
}

export async function requestAccessCode(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const h = await headers();
  const ipHash = sha256(h.get("x-forwarded-for") ?? "unknown");
  const baseDiagnostics = {
    requestReceived: true,
    applicationIdPresent: applicationId.length > 0,
    applicationIdHash: applicationId
      ? maskGeneric(sha256(applicationId)).slice(0, 12)
      : null,
    emailPresent: email.length > 0,
    emailHash: email ? maskGeneric(sha256(email)).slice(0, 12) : null,
  };
  let destination = "";

  try {
    const limit = await checkRateLimit({
      scope: "access-code-request",
      key: `${applicationId}:${email}:${ipHash}`,
      limit: accessCodeRateLimitConfig.requestLimit(),
      windowMs: accessCodeRateLimitConfig.windowMs(),
    });
    safeDiagnostics("request", {
      ...baseDiagnostics,
      rateLimitAllowed: limit.allowed,
    });

    const app = await prisma.jobApplication.findFirst({
      where: { applicationId, deletedAt: null },
      include: { applicant: true },
    });
    const matchingApplicationFound = Boolean(
      app && app.applicant.email.toLowerCase() === email,
    );

    if (!limit.allowed) {
      if (app && matchingApplicationFound) {
        await prisma.auditLog.create({
          data: {
            applicationId: app.id,
            actorType: "applicant",
            actorRef: "masked-email",
            action: "Access code request rate limited",
            metadata: { scope: "access-code-request" },
          },
        });
      }
      safeDiagnostics("requestLimited", {
        ...baseDiagnostics,
        rateLimitAllowed: false,
        matchingApplicationFound,
        accessCodeCreated: false,
        emailAttempted: false,
        emailStatus: "not-attempted",
        redirectStatus: "limited",
      });
      destination = trackUrl("limited", applicationId, email);
    } else {
      let emailAttempted = false;
      let emailStatus = "not-attempted";
      let accessCodeCreated = false;
      if (app && matchingApplicationFound) {
        const code = randomDigits();
        await prisma.applicationAccessCode.create({
          data: {
            applicationId: app.id,
            codeHash: sha256(code),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
        accessCodeCreated = true;
        await prisma.auditLog.create({
          data: {
            applicationId: app.id,
            actorType: "applicant",
            actorRef: "masked-email",
            action: "Access code requested",
          },
        });
        emailAttempted = true;
        try {
          const accessEmail = accessCodeEmail({
            applicationId: app.applicationId,
            candidateName: app.applicant.fullName,
            accessCode: code,
          });
          const emailRecord = await sendAndRecordEmail({
            applicationId: app.id,
            to: email,
            template: "access-code",
            ...accessEmail,
          });
          emailStatus = emailRecord.status;
          if (emailRecord.status === "failed") {
            await prisma.auditLog.create({
              data: {
                applicationId: app.id,
                actorType: "system",
                action: "Access code email delivery failed",
                metadata: { template: "access-code" },
              },
            });
            safeDiagnostics("requestComplete", {
              ...baseDiagnostics,
              rateLimitAllowed: true,
              matchingApplicationFound,
              accessCodeCreated,
              emailAttempted,
              emailStatus,
              redirectStatus: "error",
            });
            destination = trackUrl("error", applicationId, email);
          }
        } catch (error) {
          emailStatus = "failed";
          await prisma.auditLog.create({
            data: {
              applicationId: app.id,
              actorType: "system",
              action: "Access code email delivery failed",
              metadata: {
                template: "access-code",
                errorName: error instanceof Error ? error.name : "UnknownError",
              },
            },
          });
          safeDiagnostics("emailRecordFailure", {
            ...baseDiagnostics,
            rateLimitAllowed: true,
            matchingApplicationFound,
            accessCodeCreated,
            emailAttempted: true,
            emailStatus,
            redirectStatus: "error",
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
          destination = trackUrl("error", applicationId, email);
        }
      }
      if (!destination.includes("error=1")) {
        safeDiagnostics("requestComplete", {
          ...baseDiagnostics,
          rateLimitAllowed: true,
          matchingApplicationFound,
          accessCodeCreated,
          emailAttempted,
          emailStatus,
          redirectStatus: "requested",
        });
        destination = trackUrl("requested", applicationId, email);
      }
    }
  } catch (error) {
    safeDiagnostics("requestError", {
      ...baseDiagnostics,
      rateLimitAllowed: null,
      matchingApplicationFound: null,
      accessCodeCreated: false,
      emailAttempted: false,
      emailStatus: "failed",
      redirectStatus: "error",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    destination = trackUrl("error", applicationId, email);
  }

  redirect(destination || trackUrl("error", applicationId, email));
}

export async function verifyAccessCode(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const h = await headers();
  const ipHash = sha256(h.get("x-forwarded-for") ?? "unknown");
  const failedUrl = verifyUrl(applicationId, email);
  const limit = await checkRateLimit({
    scope: "access-code-verify",
    key: `${applicationId}:${email}:${ipHash}`,
    limit: accessCodeRateLimitConfig.verifyLimit(),
    windowMs: accessCodeRateLimitConfig.windowMs(),
  });
  if (!limit.allowed) redirect(failedUrl);
  const app = await prisma.jobApplication.findFirst({
    where: { applicationId, deletedAt: null },
    include: { applicant: true },
  });
  if (!app || app.applicant.email.toLowerCase() !== email) redirect(failedUrl);
  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      applicationId: app.id,
      codeHash: sha256(code),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!access) redirect(failedUrl);
  const token = randomToken();
  await prisma.applicationAccessCode.update({
    where: { id: access.id },
    data: {
      usedAt: new Date(),
      verifiedSessionTokenHash: sha256(token),
      sessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await prisma.auditLog.create({
    data: {
      applicationId: app.id,
      actorType: "applicant",
      actorRef: "masked-email",
      action: "Access code verified",
    },
  });
  redirect(`/track/portal?session=${token}`);
}

function portalUrl(session: string, params: Record<string, string>) {
  const search = new URLSearchParams({ session, ...params });
  return `/track/portal?${search.toString()}`;
}

export async function submitStage2(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const parsed = stage2SubmissionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  const primaryIdFile =
    formData.get("primaryIdDocument") instanceof File
      ? (formData.get("primaryIdDocument") as File)
      : null;
  const secondaryIdFile =
    formData.get("secondaryIdDocument") instanceof File
      ? (formData.get("secondaryIdDocument") as File)
      : null;
  const photoFile =
    formData.get("passportPhoto") instanceof File
      ? (formData.get("passportPhoto") as File)
      : null;
  const secondaryUploadProvided = Boolean(
    secondaryIdFile && secondaryIdFile.size > 0,
  );
  const secondaryType = String(formData.get("secondaryIdType") ?? "").trim();
  const secondaryNumber = String(
    formData.get("secondaryIdNumber") ?? "",
  ).trim();
  const fileErrors = [
    validateIdentityDocumentFile(
      primaryIdFile,
      "Upload your primary ID document.",
    ),
    secondaryUploadProvided
      ? validateIdentityDocumentFile(
          secondaryIdFile,
          "Upload a valid secondary ID document.",
        )
      : null,
    photoFile && photoFile.size > 0
      ? validateIdentityDocumentFile(
          photoFile,
          "Upload a valid passport/profile photo.",
        )
      : null,
    secondaryUploadProvided && (!secondaryType || !secondaryNumber)
      ? "Enter secondary ID type and number for the uploaded secondary document."
      : null,
  ].filter(Boolean);
  if (!parsed.success || fileErrors.length)
    redirect(portalUrl(session, { stage: "2", error: "stage2_validation" }));

  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      verifiedSessionTokenHash: sha256(session),
      sessionExpiresAt: { gt: new Date() },
      application: { deletedAt: null },
    },
    include: { application: { include: { stages: true, applicant: true } } },
  });
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const stage1 = application.stages.find((stage) => stage.stageOrder === 1);
  const stage2 = application.stages.find((stage) => stage.stageOrder === 2);
  if (!stage2 || stage1?.status !== "Approved" || stage2.status === "Locked")
    redirect(portalUrl(session, { stage: "2", error: "stage2_locked" }));
  if (
    !["Available", "In Progress", "Correction Requested"].includes(
      stage2.status,
    )
  )
    redirect(portalUrl(session, { stage: "2", error: "stage2_not_open" }));

  const saved: Array<{
    file: File;
    kind: string;
    storageKey: string;
    provider: string;
    restricted: boolean;
  }> = [];
  try {
    for (const item of [
      { file: primaryIdFile!, kind: "Stage 2 Primary ID Document" },
      ...(secondaryIdFile && secondaryIdFile.size > 0
        ? [{ file: secondaryIdFile, kind: "Stage 2 Secondary ID Document" }]
        : []),
      ...(photoFile && photoFile.size > 0
        ? [{ file: photoFile, kind: "Stage 2 Passport/Profile Photo" }]
        : []),
    ]) {
      const stored = await savePrivateUpload(item.file, application.id);
      saved.push({ ...item, ...stored });
    }
    await prisma.$transaction(async (tx) => {
      const version =
        (await tx.stageSubmission.count({ where: { stageId: stage2.id } })) + 1;
      const submission = await tx.stageSubmission.create({
        data: {
          stageId: stage2.id,
          version,
          payload: toStage2SubmissionPayload(parsed.data),
          status: "Under Review",
          submittedAt: new Date(),
        },
      });
      for (const item of saved) {
        const uploaded = await tx.uploadedDocument.create({
          data: {
            applicationId: application.id,
            kind: item.kind,
            fileName: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            sizeBytes: item.file.size,
            provider: item.provider,
            storageKey: item.storageKey,
            restricted: item.restricted,
          },
        });
        await tx.applicantDocument.create({
          data: {
            submissionId: submission.id,
            uploadedDocumentId: uploaded.id,
            status: "Submitted",
          },
        });
      }
      await tx.electronicSignature.create({
        data: {
          submissionId: submission.id,
          typedName: parsed.data.signatureName,
          confirmed: true,
        },
      });
      await tx.hiringStage.update({
        where: { id: stage2.id },
        data: { status: "Under Review", submittedAt: new Date() },
      });
      await tx.jobApplication.update({
        where: { id: application.id },
        data: {
          status: "Candidate Information Required",
          currentStageOrder: 2,
        },
      });
      await tx.auditLog.create({
        data: {
          applicationId: application.id,
          actorType: "applicant",
          actorRef: "masked-email",
          action: "Applicant submitted Stage 2",
          metadata: { documentsUploaded: saved.length },
        },
      });
      await tx.emailNotification.create({
        data: {
          applicationId: application.id,
          toEmail: "admin",
          template: "stage-2-submitted-admin",
          subject: `Stage 2 submitted: ${application.applicationId}`,
          status: "recorded",
        },
      });
    });
  } catch (error) {
    await Promise.all(
      saved.map((item) => deletePrivateUpload(item.storageKey, item.provider)),
    );
    console.info("stage2SubmissionFailure", {
      applicationFound: true,
      stage2Found: true,
      filesCleaned: saved.length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    redirect(portalUrl(session, { stage: "2", error: "stage2_submit_failed" }));
  }
  redirect(portalUrl(session, { stage: "2", success: "stage2_submitted" }));
}

export async function submitStage3(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const diagnostics: Record<string, unknown> = {
    candidateStage3SubmitRequested: true,
    sessionValid: false,
    uploadAttempted: false,
    uploadSaved: false,
    dbWriteSucceeded: false,
    redirectStatus: null,
  };
  const parsed = stage3SubmissionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  const upload =
    formData.get("assessmentFile") instanceof File
      ? (formData.get("assessmentFile") as File)
      : null;
  if (!parsed.success)
    redirect(portalUrl(session, { stage: "3", error: "stage3_validation" }));
  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      verifiedSessionTokenHash: sha256(session),
      sessionExpiresAt: { gt: new Date() },
      application: { deletedAt: null },
    },
    include: { application: { include: { stages: true, applicant: true } } },
  });
  diagnostics.sessionValid = Boolean(access);
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const stage3 = application.stages.find((stage) => stage.stageOrder === 3);
  const metadata = parseStage3Metadata(stage3?.metadata);
  if (
    !stage3 ||
    !["Available", "In Progress", "Correction Requested"].includes(
      stage3.status,
    )
  )
    redirect(portalUrl(session, { stage: "3", error: "stage3_not_open" }));
  if (!metadata.releasedAt)
    redirect(portalUrl(session, { stage: "3", error: "stage3_not_released" }));
  if (metadata.requiresCandidateResponse && !parsed.data.availability)
    redirect(
      portalUrl(session, { stage: "3", error: "stage3_response_required" }),
    );
  const fileError =
    upload && upload.size > 0
      ? validateCvFile(upload)
      : metadata.requiresUpload
        ? "Upload the requested Stage 3 assessment file."
        : null;
  if (fileError)
    redirect(
      portalUrl(session, { stage: "3", error: "stage3_upload_required" }),
    );
  const saved: Array<{
    file: File;
    kind: string;
    storageKey: string;
    provider: string;
    restricted: boolean;
  }> = [];
  try {
    if (upload && upload.size > 0) {
      diagnostics.uploadAttempted = true;
      const stored = await savePrivateUpload(upload, application.id);
      saved.push({
        file: upload,
        kind: "Stage 3 Assessment Upload",
        storageKey: stored.storageKey,
        provider: stored.provider,
        restricted: stored.restricted,
      });
      diagnostics.uploadSaved = true;
    }
    await prisma.$transaction(async (tx) => {
      const version =
        (await tx.stageSubmission.count({ where: { stageId: stage3.id } })) + 1;
      const submission = await tx.stageSubmission.create({
        data: {
          stageId: stage3.id,
          version,
          payload: toStage3SubmissionPayload(parsed.data),
          status: "Under Review",
          submittedAt: new Date(),
        },
      });
      for (const item of saved) {
        const uploaded = await tx.uploadedDocument.create({
          data: {
            applicationId: application.id,
            kind: item.kind,
            fileName: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            sizeBytes: item.file.size,
            provider: item.provider,
            storageKey: item.storageKey,
            restricted: item.restricted,
          },
        });
        await tx.applicantDocument.create({
          data: {
            submissionId: submission.id,
            uploadedDocumentId: uploaded.id,
            status: "Submitted",
          },
        });
      }
      await tx.hiringStage.update({
        where: { id: stage3.id },
        data: { status: "Under Review", submittedAt: new Date() },
      });
      await tx.jobApplication.update({
        where: { id: application.id },
        data: { status: "Screening", currentStageOrder: 3 },
      });
      await tx.auditLog.create({
        data: {
          applicationId: application.id,
          actorType: "applicant",
          actorRef: "masked-email",
          action: "Applicant submitted Stage 3",
          metadata: { uploadProvided: saved.length > 0 },
        },
      });
      await tx.emailNotification.create({
        data: {
          applicationId: application.id,
          toEmail: "admin",
          template: "stage-3-submitted-admin",
          subject: `Stage 3 submitted: ${application.applicationId}`,
          status: "recorded",
        },
      });
    });
    diagnostics.dbWriteSucceeded = true;
    diagnostics.redirectStatus = "success";
    console.info("candidateStage3SubmitDiagnostics", diagnostics);
  } catch (error) {
    await Promise.all(
      saved.map((item) => deletePrivateUpload(item.storageKey, item.provider)),
    );
    diagnostics.redirectStatus = "error";
    diagnostics.errorName =
      error instanceof Error ? error.name : "UnknownError";
    console.info("candidateStage3SubmitDiagnostics", diagnostics);
    redirect(portalUrl(session, { stage: "3", error: "stage3_submit_failed" }));
  }
  redirect(portalUrl(session, { stage: "3", success: "stage3_submitted" }));
}

export async function submitOfferDecision(formData: FormData) {
  const { offerDecisionSchema } = await import("../../lib/hiring");
  const { acceptOffer, StageActionError } = await import("../../lib/workflow");
  const session = String(formData.get("session") ?? "");
  const diagnostics: Record<string, unknown> = {
    candidateOfferDecisionRequested: true,
    sessionValid: false,
    decisionType: String(formData.get("decision") ?? ""),
    decisionAccepted: false,
    dbWriteSucceeded: false,
    emailAttempted: false,
    emailStatus: "not_attempted",
    redirectStatus: null,
  };
  const parsed = offerDecisionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success)
    redirect(portalUrl(session, { stage: "4", error: "offer_validation" }));
  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      verifiedSessionTokenHash: sha256(session),
      sessionExpiresAt: { gt: new Date() },
      application: { deletedAt: null },
    },
    include: {
      application: { include: { stages: true, offer: true, applicant: true } },
    },
  });
  diagnostics.sessionValid = Boolean(access);
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const governedOffer = await prisma.hrRecruitmentOffer.findUnique({
    where: { applicationId: application.id },
    include: { activeVersion: true },
  });
  if (governedOffer?.status === "ISSUED" && governedOffer.activeVersion && application.organizationId) {
    if (parsed.data.decision === "accept") {
      const { acceptOffer: acceptGovernedOffer } = await import("@/lib/hr/recruitment/offers");
      await prisma.$transaction((tx) => acceptGovernedOffer(tx, {
        organizationId: application.organizationId!,
        offerId: governedOffer.id,
        applicantId: application.applicantId,
        offerVersionId: governedOffer.activeVersionId!,
        method: "SECURE_CANDIDATE_PORTAL",
        evidence: { sessionVerified: true, confirmation: true },
      }), { isolationLevel: "Serializable" });
      redirect(portalUrl(session, { stage: "4", success: "offer_accepted" }));
    }
    await prisma.$transaction(async (tx) => {
      await tx.hrRecruitmentOfferDecline.upsert({
        where: { offerId: governedOffer.id },
        update: {},
        create: {
          offerId: governedOffer.id,
          offerVersionId: governedOffer.activeVersionId!,
          applicantId: application.applicantId,
          reason: parsed.data.candidateDecisionNote || null,
        },
      });
      await tx.hrRecruitmentOffer.update({
        where: { id: governedOffer.id },
        data: { status: "DECLINED", version: { increment: 1 } },
      });
      await tx.jobApplication.update({
        where: { id: application.id },
        data: { recruitmentStatus: "OFFER_DECLINED", version: { increment: 1 } },
      });
    });
    redirect(portalUrl(session, { stage: "4", success: "offer_declined" }));
  }
  const stage4 = application.stages.find((s) => s.stageOrder === 4);
  const offer = application.offer;
  const expired = Boolean(
    offer?.offerExpiryDate && offer.offerExpiryDate.getTime() < Date.now(),
  );
  if (!stage4 || stage4.status === "Locked")
    redirect(portalUrl(session, { stage: "4", error: "offer_locked" }));
  if (!offer || offer.status !== "Released" || expired)
    redirect(
      portalUrl(session, {
        stage: "4",
        error: expired ? "offer_expired" : "offer_not_open",
      }),
    );
  let destination = "";
  try {
    if (parsed.data.decision === "accept") {
      await acceptOffer(
        application.id,
        parsed.data.candidateDecisionNote || undefined,
      );
      diagnostics.decisionAccepted = true;
      diagnostics.dbWriteSucceeded = true;
      try {
        const offerEmail = offerAcceptedEmail({
          applicationId: application.applicationId,
          candidateName: application.applicant.fullName,
        });
        const e = await sendAndRecordEmail({
          applicationId: application.id,
          to: application.applicant.email,
          template: "offer-accepted",
          ...offerEmail,
        });
        diagnostics.emailAttempted = true;
        diagnostics.emailStatus = e.status;
      } catch {
        diagnostics.emailAttempted = true;
        diagnostics.emailStatus = "failed";
      }
      diagnostics.redirectStatus = "success";
      console.info("candidateOfferDecisionDiagnostics", diagnostics);
      destination = portalUrl(session, {
        stage: "4",
        success: "offer_accepted",
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.offer.update({
          where: { applicationId: application.id },
          data: {
            status: "Declined",
            candidateDecisionAt: new Date(),
            candidateDecisionNote: parsed.data.candidateDecisionNote || null,
          },
        });
        await tx.hiringStage.update({
          where: { id: stage4.id },
          data: { status: "Rejected" },
        });
        await tx.jobApplication.update({
          where: { id: application.id },
          data: { status: "Rejected", currentStageOrder: 4 },
        });
        await tx.auditLog.create({
          data: {
            applicationId: application.id,
            actorType: "applicant",
            actorRef: "masked-email",
            action: "Candidate declined offer",
            metadata: {
              decisionAccepted: false,
              notePresent: Boolean(parsed.data.candidateDecisionNote),
            },
          },
        });
      });
      diagnostics.dbWriteSucceeded = true;
      diagnostics.redirectStatus = "declined";
      console.info("candidateOfferDecisionDiagnostics", diagnostics);
      destination = portalUrl(session, {
        stage: "4",
        success: "offer_declined",
      });
    }
  } catch (error) {
    diagnostics.errorName =
      error instanceof Error ? error.name : "UnknownError";
    diagnostics.redirectStatus = "error";
    console.info("candidateOfferDecisionDiagnostics", diagnostics);
    if (error instanceof StageActionError)
      redirect(portalUrl(session, { stage: "4", error: "offer_not_open" }));
    redirect(
      portalUrl(session, { stage: "4", error: "offer_decision_failed" }),
    );
  }
  redirect(
    destination ||
      portalUrl(session, { stage: "4", error: "offer_decision_failed" }),
  );
}

export async function submitGovernedDocumentReplacement(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const reviewId = String(formData.get("reviewId") ?? "");
  const file = formData.get("replacementFile");
  if (!(file instanceof File) || !reviewId) redirect(portalUrl(session, { error: "replacement_validation" }));
  const fileError = validateOnboardingDocumentFile(file);
  if (fileError) redirect(portalUrl(session, { error: "replacement_file_invalid" }));
  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      verifiedSessionTokenHash: sha256(session),
      sessionExpiresAt: { gt: new Date() },
      application: { deletedAt: null },
    },
    include: { application: true },
  });
  if (!access) redirect("/track?verified=0");
  const review = await prisma.hrRecruitmentDocumentReview.findFirst({
    where: {
      id: reviewId,
      status: "REPLACEMENT_REQUESTED",
      handover: { applicationId: access.application.id, organizationId: access.application.organizationId ?? undefined },
    },
  });
  if (!review) redirect(portalUrl(session, { error: "replacement_not_open" }));
  const previous = await prisma.uploadedDocument.findFirstOrThrow({
    where: { id: review.uploadedDocumentId, applicationId: access.application.id },
  });
  const saved = await savePrivateUpload(file, access.application.applicationId);
  try {
    await prisma.$transaction(async (tx) => {
      const replacement = await tx.uploadedDocument.create({
        data: {
          applicationId: access.application.id,
          kind: previous.kind,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          provider: saved.provider,
          storageKey: saved.storageKey,
          restricted: true,
        },
      });
      const claimed = await tx.hrRecruitmentDocumentReview.updateMany({
        where: { id: review.id, status: "REPLACEMENT_REQUESTED", replacedById: null },
        data: { replacedById: replacement.id },
      });
      if (claimed.count !== 1) throw new Error("The replacement request changed while the file was uploading.");
      await tx.hrRecruitmentDocumentReview.create({
        data: {
          handoverId: review.handoverId,
          uploadedDocumentId: replacement.id,
          documentVersion: review.documentVersion + 1,
          reviewScope: review.reviewScope,
          status: "PENDING",
        },
      });
      await tx.hrAuditEvent.create({
        data: {
          organizationId: access.application.organizationId!,
          entityType: "HrRecruitmentDocumentReview",
          entityId: review.id,
          action: "hr.recruitment.document.replacement_submitted",
          newValues: { replacementDocumentId: replacement.id, priorDocumentId: previous.id },
          reason: "Applicant submitted a replacement document through the verified portal",
          correlationId: randomToken(16),
        },
      });
    });
  } catch (error) {
    await deletePrivateUpload(saved.storageKey, saved.provider);
    throw error;
  }
  redirect(portalUrl(session, { success: "replacement_submitted" }));
}

export async function submitStage5(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const parsed = stage5CandidateSubmissionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(portalUrl(session, { stage: "5", error: "stage5_validation" }));
  const h = await headers();
  const access = await prisma.applicationAccessCode.findFirst({
    where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
    include: { application: { include: { stages: true, employmentAgreement: true } } },
  });
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const stage5 = application.stages.find((stage) => stage.stageOrder === 5);
  const agreement = application.employmentAgreement;
  if (!stage5 || !["Available", "In Progress", "Correction Requested"].includes(stage5.status)) redirect(portalUrl(session, { stage: "5", error: "stage5_not_open" }));
  if (!agreement || !["Released", "Correction Requested"].includes(agreement.status) && agreement.status !== "Approved") redirect(portalUrl(session, { stage: "5", error: "stage5_not_released" }));
  try {
    await prisma.$transaction(async (tx) => {
      const version = (await tx.stageSubmission.count({ where: { stageId: stage5.id } })) + 1;
      const submission = await tx.stageSubmission.create({ data: { stageId: stage5.id, version, payload: toStage5SubmissionPayload(parsed.data, agreement.id, agreement.version), status: "Under Review", submittedAt: new Date() } });
      await tx.electronicSignature.create({ data: { submissionId: submission.id, typedName: parsed.data.signatureName, confirmed: true, ipHash: sha256(h.get("x-forwarded-for") ?? "unknown"), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 500) } });
      await tx.hiringStage.update({ where: { id: stage5.id }, data: { status: "Under Review", submittedAt: new Date() } });
      await tx.employmentAgreement.update({ where: { applicationId: application.id }, data: { status: "Submitted", candidateSubmittedAt: new Date() } });
      await tx.jobApplication.update({ where: { id: application.id }, data: { status: "Agreement Pending", currentStageOrder: 5 } });
      await tx.auditLog.create({ data: { applicationId: application.id, actorType: "applicant", actorRef: "masked-email", action: "Applicant submitted Stage 5 agreement", metadata: { agreementVersion: agreement.version, confirmationsAccepted: true } } });
      await tx.emailNotification.create({ data: { applicationId: application.id, toEmail: "admin", template: "stage-5-submitted-admin", subject: `Stage 5 submitted: ${application.applicationId}`, status: "recorded" } });
    });
  } catch (error) {
    console.info("candidateStage5SubmitDiagnostics", { sessionValid: true, dbWriteSucceeded: false, errorName: error instanceof Error ? error.name : "UnknownError" });
    redirect(portalUrl(session, { stage: "5", error: "stage5_submit_failed" }));
  }
  redirect(portalUrl(session, { stage: "5", success: "stage5_submitted" }));
}


export async function submitStage6(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const parsed = stage6CandidateSchema.safeParse(Object.fromEntries(formData.entries()));
  const fileInputs = [
    ["bankProof", "Stage 6 Bank Proof"],
    ["statutoryDocument", "Stage 6 Tax/Statutory Document"],
    ["additionalDocument", "Stage 6 Additional Onboarding Document"],
  ] as const;
  const uploads = fileInputs.map(([field, kind]) => ({ field, kind, file: formData.get(field) instanceof File ? (formData.get(field) as File) : null })).filter((item) => item.file && item.file.size > 0);
  const fileErrors = uploads.map((item) => validateOnboardingDocumentFile(item.file)).filter(Boolean);
  if (!parsed.success || fileErrors.length) redirect(portalUrl(session, { stage: "6", error: "stage6_validation" }));
  const h = await headers();
  const access = await prisma.applicationAccessCode.findFirst({
    where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
    include: { application: { include: { stages: true, applicant: true } } },
  });
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const stage5 = application.stages.find((stage) => stage.stageOrder === 5);
  const stage6 = application.stages.find((stage) => stage.stageOrder === 6);
  if (stage5?.status !== "Approved") redirect(portalUrl(session, { stage: "6", error: "stage6_stage5_required" }));
  if (!stage6 || !["Available", "In Progress", "Correction Requested"].includes(stage6.status)) redirect(portalUrl(session, { stage: "6", error: "stage6_not_open" }));
  const saved: Array<{ file: File; kind: string; storageKey: string; provider: string; restricted: boolean }> = [];
  try {
    for (const item of uploads) {
      const stored = await savePrivateUpload(item.file!, application.id);
      saved.push({ file: item.file!, kind: item.kind, ...stored });
    }
    await prisma.$transaction(async (tx) => {
      const version = (await tx.stageSubmission.count({ where: { stageId: stage6.id } })) + 1;
      const submission = await tx.stageSubmission.create({ data: { stageId: stage6.id, version, payload: toStage6SubmissionPayload(parsed.data), status: "Under Review", submittedAt: new Date() } });
      for (const item of saved) {
        const uploaded = await tx.uploadedDocument.create({ data: { applicationId: application.id, kind: item.kind, fileName: item.file.name, mimeType: item.file.type || "application/octet-stream", sizeBytes: item.file.size, provider: item.provider, storageKey: item.storageKey, restricted: item.restricted } });
        await tx.applicantDocument.create({ data: { submissionId: submission.id, uploadedDocumentId: uploaded.id, status: "Submitted" } });
      }
      await tx.electronicSignature.create({ data: { submissionId: submission.id, typedName: parsed.data.signatureName, confirmed: true, ipHash: sha256(h.get("x-forwarded-for") ?? "unknown"), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 500) } });
      await tx.hiringStage.update({ where: { id: stage6.id }, data: { status: "Under Review", submittedAt: new Date() } });
      await tx.jobApplication.update({ where: { id: application.id }, data: { status: "Onboarding Pending", currentStageOrder: 6 } });
      await tx.auditLog.create({ data: { applicationId: application.id, actorType: "applicant", actorRef: "masked-email", action: "Applicant submitted Stage 6 onboarding", metadata: { documentsUploaded: saved.length, declarationsAccepted: true } } });
      await tx.emailNotification.create({ data: { applicationId: application.id, toEmail: "admin", template: "stage-6-submitted-admin", subject: `Stage 6 submitted: ${application.applicationId}`, status: "recorded" } });
    });
  } catch (error) {
    await Promise.all(saved.map((item) => deletePrivateUpload(item.storageKey, item.provider)));
    await prisma.auditLog.create({ data: { applicationId: application.id, actorType: "system", action: "Stage 6 upload failure cleanup", metadata: { filesCleaned: saved.length, errorName: error instanceof Error ? error.name : "UnknownError" } } }).catch(() => undefined);
    console.info("candidateStage6SubmitDiagnostics", { sessionValid: true, dbWriteSucceeded: false, filesCleaned: saved.length, errorName: error instanceof Error ? error.name : "UnknownError" });
    redirect(portalUrl(session, { stage: "6", error: "stage6_submit_failed" }));
  }
  redirect(portalUrl(session, { stage: "6", success: "stage6_submitted" }));
}


export async function submitStage7(formData: FormData) {
  const session = String(formData.get("session") ?? "");
  const parsed = stage7CandidateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(portalUrl(session, { stage: "7", error: "stage7_validation" }));
  const h = await headers();
  const access = await prisma.applicationAccessCode.findFirst({
    where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
    include: { application: { include: { stages: true, applicant: true } } },
  });
  if (!access) redirect("/track?verified=0");
  const application = access.application;
  const stage6 = application.stages.find((stage) => stage.stageOrder === 6);
  const stage7 = application.stages.find((stage) => stage.stageOrder === 7);
  if (stage6?.status !== "Approved") redirect(portalUrl(session, { stage: "7", error: "stage7_stage6_required" }));
  if (!stage7 || !["Available", "In Progress", "Correction Requested"].includes(stage7.status)) redirect(portalUrl(session, { stage: "7", error: "stage7_not_open" }));
  try {
    await prisma.$transaction(async (tx) => {
      const version = (await tx.stageSubmission.count({ where: { stageId: stage7.id } })) + 1;
      const submission = await tx.stageSubmission.create({ data: { stageId: stage7.id, version, payload: toStage7SubmissionPayload(parsed.data), status: "Under Review", submittedAt: new Date() } });
      await tx.electronicSignature.create({ data: { submissionId: submission.id, typedName: parsed.data.signatureName, confirmed: true, ipHash: sha256(h.get("x-forwarded-for") ?? "unknown"), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 500) } });
      await tx.hiringStage.update({ where: { id: stage7.id }, data: { status: "Under Review", submittedAt: new Date() } });
      await tx.jobApplication.update({ where: { id: application.id }, data: { status: "Final Review", currentStageOrder: 7 } });
      await tx.auditLog.create({ data: { applicationId: application.id, actorType: "applicant", actorRef: "masked-email", action: "Applicant submitted Stage 7 acknowledgements", metadata: { acknowledgementVersion: 1, allRequiredAcknowledgements: true, candidateNotePresent: Boolean(parsed.data.candidateNote) } } });
      await tx.emailNotification.create({ data: { applicationId: application.id, toEmail: "admin", template: "stage-7-submitted-admin", subject: `Stage 7 submitted: ${application.applicationId}`, status: "recorded" } });
    });
  } catch (error) {
    console.info("candidateStage7SubmitDiagnostics", { sessionValid: true, dbWriteSucceeded: false, errorName: error instanceof Error ? error.name : "UnknownError" });
    redirect(portalUrl(session, { stage: "7", error: "stage7_submit_failed" }));
  }
  redirect(portalUrl(session, { stage: "7", success: "stage7_submitted" }));
}
