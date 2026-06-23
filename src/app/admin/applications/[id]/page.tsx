import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { privateUploadExists } from "@/lib/storage";
import { parseStage3Metadata, stage3InterviewModes, stage3ScreeningTypes } from "@/lib/hiring";
import {
  adminStage1Action,
  permanentlyDeleteApplicationAction,
  restoreApplicationAction,
  softDeleteApplicationAction,
  adminStage2Action,
  adminStage3Action,
  adminStage3InstructionAction,
  adminOfferAction,
} from "../actions";
import { AdminDocumentActions } from "./AdminDocumentActions";

type AdminApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    stages: {
      include: {
        submissions: {
          include: {
            signature: true;
            documents: {
              include: {
                uploadedDocument: true;
              };
            };
          };
        };
        approvals: true;
      };
    };
    emails: true;
    auditLogs: true;
    offer: true;
  };
}>;

type ApplicationStage = AdminApplication["stages"][number];
type ApplicantDocument = NonNullable<
  ApplicationStage["submissions"][number]
>["documents"][number];
type EmailNotification = AdminApplication["emails"][number];
type AuditLog = AdminApplication["auditLogs"][number];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function formatDateTime(value?: Date | null) {
  return value ? value.toISOString() : "Missing";
}

function actionBanner(params: Record<string, string | undefined>) {
  const messages: string[] = [];
  if (params.success === "approved")
    messages.push("Stage 1 was approved and Stage 2 is now available.");
  if (params.success === "already_approved")
    messages.push("Stage 1 is already approved.");
  if (params.success === "rejected") messages.push("Application was rejected.");
  if (params.success === "correction")
    messages.push("Correction was requested.");
  if (params.success === "soft_deleted")
    messages.push("Application moved to deleted records.");
  if (params.success === "restored") messages.push("Application restored.");
  if (params.success === "stage2_approved") messages.push("Stage 2 was approved and Stage 3 is now available.");
  if (params.success === "stage2_already_approved") messages.push("Stage 2 is already approved.");
  if (params.success === "stage2_correction") messages.push("Stage 2 correction was requested.");
  if (params.success === "stage2_rejected") messages.push("Stage 2 was rejected.");
  if (params.success === "stage3_released") messages.push("Stage 3 instructions were released/updated.");
  if (params.success === "stage3_approved") messages.push("Stage 3 was approved and Stage 4 is now available.");
  if (params.success === "stage3_already_approved") messages.push("Stage 3 is already approved.");
  if (params.success === "stage3_correction") messages.push("Stage 3 correction was requested.");
  if (params.success === "stage3_rejected") messages.push("Stage 3 was rejected.");
  if (params.success === "offer_draft") messages.push("Draft offer saved.");
  if (params.success === "offer_released") messages.push("Offer released to candidate.");
  if (params.success === "offer_withdrawn") messages.push("Offer withdrawn.");
  if (params.warning === "email_failed")
    messages.push(
      "Stage 1 was approved, but the unlock email could not be sent. Please retry email delivery or contact the candidate manually.",
    );
  if (params.error === "action_failed")
    messages.push(
      "The admin action could not be completed. Please refresh and try again.",
    );
  if (params.error === "missing_stage")
    messages.push(
      "Required hiring stage data is missing. Please contact an administrator.",
    );
  if (params.error === "invalid_action") messages.push("Invalid admin action.");
  if (params.error === "invalid_confirmation")
    messages.push("Confirmation did not match. No records were deleted.");
  if (params.error === "restore_before_stage_action")
    messages.push("Restore this application before taking stage actions.");
  if (params.error === "delete_failed")
    messages.push("Delete failed. Please refresh and try again.");
  if (params.error === "file_delete_failed")
    messages.push(
      "Private file deletion failed, so the application was not permanently deleted.",
    );
  return messages;
}

export default async function AdminApplicationDetail({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams, resolvedSearchParams, adminSession] =
    await Promise.all([params, searchParams, getAdminSession()]);
  console.info("adminSessionPresentOnPageLoad", {
    page: "/admin/applications/[id]",
    present: Boolean(adminSession),
  });
  if (!adminSession) redirect("/admin/login");

  const application = await prisma.jobApplication.findUnique({
    where: { id: resolvedParams.id },
    include: {
      applicant: true,
      stages: {
        orderBy: { stageOrder: "asc" },
        include: {
          submissions: {
            include: {
              signature: true,
              documents: {
                include: {
                  uploadedDocument: true,
                },
              },
            },
          },
          approvals: true,
        },
      },
      emails: true,
      auditLogs: true,
      offer: true,
    },
  });

  if (!application) {
    notFound();
  }

  const stageOne = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 1,
  );
  const stageOneSubmission = stageOne?.submissions[0];
  const stageOneStatus = stageOne?.status ?? application.status;
  const stageTwo = application.stages.find((stage: ApplicationStage) => stage.stageOrder === 2);
  const stageTwoSubmission = stageTwo?.submissions[0];
  const stageTwoPayload = (stageTwoSubmission?.payload ?? {}) as Record<string, string | boolean>;
  const stageTwoSignature = stageTwoSubmission?.signature;
  const stageTwoDocuments = stageTwoSubmission?.documents ?? [];
  const stageThree = application.stages.find((stage: ApplicationStage) => stage.stageOrder === 3);
  const stageThreeMetadata = parseStage3Metadata(stageThree?.metadata);
  const stageThreeSubmission = stageThree?.submissions[0];
  const stageThreePayload = (stageThreeSubmission?.payload ?? {}) as Record<string, string | boolean>;
  const stageThreeDocuments = stageThreeSubmission?.documents ?? [];
  const signature = stageOneSubmission?.signature;
  const documents = stageOneSubmission?.documents ?? [];
  const documentsWithAvailability: Array<{
    document: ApplicantDocument;
    privateFileAvailable: boolean;
  }> = await Promise.all(
    documents.map(async (document: ApplicantDocument) => ({
      document,
      privateFileAvailable: document.uploadedDocument
        ? await privateUploadExists(
            document.uploadedDocument.storageKey,
            document.uploadedDocument.provider,
          )
        : false,
    })),
  );
  const stageTwoDocumentsWithAvailability = await Promise.all(stageTwoDocuments.map(async (document: ApplicantDocument) => ({ document, privateFileAvailable: document.uploadedDocument ? await privateUploadExists(document.uploadedDocument.storageKey, document.uploadedDocument.provider) : false })));
  const stageFour = application.stages.find((stage: ApplicationStage) => stage.stageOrder === 4);
  const stageFive = application.stages.find((stage: ApplicationStage) => stage.stageOrder === 5);
  const offer = application.offer;
  const canEditOffer = !offer || ["Draft", "Released"].includes(offer.status);
  const stageThreeDocumentsWithAvailability = await Promise.all(stageThreeDocuments.map(async (document: ApplicantDocument) => ({ document, privateFileAvailable: document.uploadedDocument ? await privateUploadExists(document.uploadedDocument.storageKey, document.uploadedDocument.provider) : false })));
  const stageOnePdfAvailable = Boolean(
    stageOneSubmission?.submittedAt &&
    signature?.confirmed &&
    signature?.signedAt,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{application.applicationId}</h1>
          <div className="mt-2 flex gap-2">
            <StatusBadge status={stageOneStatus} />
            {application.deletedAt ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                Deleted
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end">
          <span>Signed in as {adminSession.email}</span>
          <AdminLogoutButton />
        </div>
      </header>

      {actionBanner(resolvedSearchParams).map((message) => (
        <p
          className="card mt-4 border border-amber-200 bg-amber-50 p-4 text-sm"
          key={message}
        >
          {message}
        </p>
      ))}

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Applicant</h2>
        <p>
          <strong>Full name:</strong> {application.applicant.fullName}
        </p>
        <p>
          <strong>First:</strong>{" "}
          {application.applicant.firstName ?? "Legacy record"} ·{" "}
          <strong>Initial:</strong> {application.applicant.middleInitial ?? "—"}{" "}
          · <strong>Last:</strong>{" "}
          {application.applicant.lastName ?? "Legacy record"}
        </p>
        <p>
          <strong>Email:</strong> {application.applicant.email}
        </p>
        <p>
          <strong>Country:</strong>{" "}
          {application.applicant.phoneCountryName ?? "Not captured"} (
          {application.applicant.phoneDialCode ?? "—"})
        </p>
        <p>
          <strong>Phone:</strong>{" "}
          {application.applicant.phoneE164 ??
            application.applicant.phone ??
            "No phone provided"}
        </p>
        <p>{application.applicant.location ?? "No location provided"}</p>
        <p>
          <strong>Role selected:</strong> {application.roleAppliedFor} ·{" "}
          <strong>Experience:</strong>{" "}
          {application.experienceLevel ?? "Not provided"}
        </p>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Stage 1 answers</h2>
        {stageOneSubmission ? (
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(stageOneSubmission.payload ?? {}, null, 2)}
          </pre>
        ) : (
          <p>No Stage 1 submission found.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Official documents</h2>
        {stageOnePdfAvailable ? (
          <div className="mt-4 w-fit">
            <AdminDocumentActions
              url={`/api/admin/applications/${application.id}/documents/stage-1`}
              filename={`${application.applicationId}-stage-1-official.pdf`}
              stageOne
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Stage 1 PDF is not available yet.
          </p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Uploaded documents</h2>
        {documentsWithAvailability.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {documentsWithAvailability.map(
              ({ document, privateFileAvailable }) => {
                const uploadedDocument = document.uploadedDocument;
                const isPreviewable = uploadedDocument
                  ? [
                      "application/pdf",
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                    ].includes(uploadedDocument.mimeType)
                  : false;
                return uploadedDocument ? (
                  <article
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    key={document.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-ink">
                          {uploadedDocument.fileName}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {uploadedDocument.kind} · {uploadedDocument.mimeType}{" "}
                          · {uploadedDocument.sizeBytes} bytes
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Uploaded {formatDateTime(uploadedDocument.createdAt)}
                        </p>
                        {!privateFileAvailable ? (
                          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                            Stored file missing from private storage. The upload record exists, but the file is not available on this server. Ask the candidate to re-upload, or restore the file from backup.
                          </p>
                        ) : null}
                      </div>
                      <AdminDocumentActions
                        url={`/api/admin/applications/${application.id}/uploads/${uploadedDocument.id}`}
                        filename={uploadedDocument.fileName}
                        previewable={isPreviewable}
                      />
                    </div>
                  </article>
                ) : (
                  <p key={document.id}>Missing uploaded document.</p>
                );
              },
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No uploaded documents found.
          </p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Signature</h2>
        {signature ? (
          <p>
            {signature.typedName || "Missing typed name"} ·{" "}
            {signature.confirmed ? "Confirmed" : "Missing"} ·{" "}
            {formatDateTime(signature.signedAt)}
          </p>
        ) : (
          <p>Missing signature.</p>
        )}
      </section>


      <section className="card mt-6 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="font-bold">Stage 2 identity verification</h2>
          <StatusBadge status={stageTwo?.status ?? "Locked"} />
        </div>
        {stageTwoSubmission ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Identity details</h3><p>Legal name: {String(stageTwoPayload.fullLegalName ?? "—")}</p><p>DOB: {String(stageTwoPayload.dateOfBirth ?? "—")}</p><p>Gender: {String(stageTwoPayload.gender ?? "—")}</p><p>Nationality: {String(stageTwoPayload.nationality ?? "—")}</p><p>Residence: {String(stageTwoPayload.currentCity ?? "—")}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Government ID</h3><p>ID type: {String(stageTwoPayload.idType ?? "—")}</p><p>ID number: {String(stageTwoPayload.idNumberMasked ?? "—")}</p><p>NIN: {String(stageTwoPayload.ninMasked ?? "—")}</p><p>Tax ID: {String(stageTwoPayload.taxIdMasked ?? "—")}</p><p>Authority: {String(stageTwoPayload.idIssuingAuthority ?? "—")}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Emergency contact</h3><p>Name: {String(stageTwoPayload.emergencyContactName ?? "—")}</p><p>Relationship: {String(stageTwoPayload.emergencyContactRelationship ?? "—")}</p><p>Phone: {String(stageTwoPayload.emergencyContactPhone ?? "—")}</p><p>Address: {String(stageTwoPayload.emergencyContactAddress ?? "—")}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Declaration / signature</h3><p>Accuracy confirmed: {stageTwoPayload.declarationAccuracy ? "Yes" : "No"}</p><p>Processing consent: {stageTwoPayload.identityProcessingConsent ? "Yes" : "No"}</p><p>Signature: {stageTwoSignature?.typedName ?? String(stageTwoPayload.signatureName ?? "—")}</p><p>Signed: {formatDateTime(stageTwoSignature?.signedAt)}</p></div>
            </div>
            <div><h3 className="font-semibold">Uploaded Stage 2 documents</h3><div className="mt-3 grid gap-3">{stageTwoDocumentsWithAvailability.map(({ document, privateFileAvailable }) => document.uploadedDocument ? (<article className="rounded-2xl border border-slate-200 p-4" key={document.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{document.uploadedDocument.kind}</p><p className="text-sm text-slate-600">{document.uploadedDocument.fileName} · {document.uploadedDocument.mimeType} · {document.uploadedDocument.sizeBytes} bytes</p>{!privateFileAvailable ? <p className="mt-2 text-sm font-semibold text-amber-700">Stored file missing from private storage. The upload record exists, but the file is not available on this server. Ask the candidate to re-upload, or restore the file from backup.</p> : null}</div><AdminDocumentActions url={`/api/admin/applications/${application.id}/uploads/${document.uploadedDocument.id}`} filename={document.uploadedDocument.fileName} previewable={["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(document.uploadedDocument.mimeType)} /></div></article>) : null)}</div></div>
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">No Stage 2 submission found.</p>}
      </section>


      {stageThree && ['Available','In Progress','Correction Requested','Submitted','Under Review','Approved'].includes(stageThree.status) ? (
      <section className="card mt-6 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><h2 className="font-bold">Stage 3 Screening / Interview / Assessment</h2><StatusBadge status={stageThree.status} /></div>
        {application.deletedAt ? <p className="mt-3 text-sm font-semibold text-red-700">Restore this application before taking Stage 3 actions.</p> : (
          <form action={adminStage3InstructionAction} className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4">
            <input type="hidden" name="applicationDbId" value={application.id} />
            <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Screening type<select className="input mt-1" name="screeningType" defaultValue={stageThreeMetadata.screeningType ?? 'Screening'}>{stage3ScreeningTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-semibold">Title<input className="input mt-1" name="title" defaultValue={stageThreeMetadata.title ?? ''} required /></label><label className="text-sm font-semibold md:col-span-2">Instructions<textarea className="input mt-1 min-h-32" name="instructions" defaultValue={stageThreeMetadata.instructions ?? ''} required /></label><label className="text-sm font-semibold">Interview mode<select className="input mt-1" name="interviewMode" defaultValue={stageThreeMetadata.interviewMode ?? 'Not applicable'}>{stage3InterviewModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label><label className="text-sm font-semibold">Meeting link<input className="input mt-1" name="meetingLink" defaultValue={stageThreeMetadata.meetingLink ?? ''} /></label><label className="text-sm font-semibold">Location<input className="input mt-1" name="location" defaultValue={stageThreeMetadata.location ?? ''} /></label><label className="text-sm font-semibold">Scheduled at<input className="input mt-1" name="scheduledAt" type="datetime-local" defaultValue={stageThreeMetadata.scheduledAt ?? ''} /></label><label className="text-sm font-semibold">Assessment deadline<input className="input mt-1" name="deadlineAt" type="datetime-local" defaultValue={stageThreeMetadata.deadlineAt ?? ''} /></label><label className="text-sm font-semibold">Upload note<input className="input mt-1" name="allowedUploadNote" defaultValue={stageThreeMetadata.allowedUploadNote ?? ''} /></label></div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold"><label className="flex gap-2"><input name="requiresCandidateResponse" type="checkbox" defaultChecked={stageThreeMetadata.requiresCandidateResponse ?? true} /> Candidate response required</label><label className="flex gap-2"><input name="requiresUpload" type="checkbox" defaultChecked={stageThreeMetadata.requiresUpload ?? false} /> Assessment upload required</label></div>
            <button className="btn btn-primary">Release/update Stage 3 instructions</button>
          </form>
        )}
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Released instructions</h3><p className="mt-2 text-sm">{stageThreeMetadata.title ?? 'Not released'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{stageThreeMetadata.instructions ?? 'No instructions released yet.'}</p><p className="mt-2 text-xs text-slate-500">Released: {stageThreeMetadata.releasedAt ?? '—'} · By: {stageThreeMetadata.releasedByAdminEmail ?? '—'}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Candidate response</h3>{stageThreeSubmission ? <div className="mt-2 text-sm"><p><strong>Availability:</strong> {String(stageThreePayload.availability ?? '—')}</p><p className="whitespace-pre-wrap"><strong>Message:</strong> {String(stageThreePayload.responseMessage ?? '—')}</p><p><strong>Declared accurate:</strong> {stageThreePayload.declarationAccuracy ? 'Yes' : 'No'}</p><p>Submitted: {formatDateTime(stageThreeSubmission.submittedAt)}</p></div> : <p className="mt-2 text-sm text-slate-600">No Stage 3 response submitted.</p>}</div></div>
        <div className="mt-5"><h3 className="font-semibold">Uploaded Stage 3 files</h3><div className="mt-3 grid gap-3">{stageThreeDocumentsWithAvailability.length ? stageThreeDocumentsWithAvailability.map(({ document, privateFileAvailable }) => document.uploadedDocument ? (<article className="rounded-2xl border border-slate-200 p-4" key={document.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{document.uploadedDocument.kind}</p><p className="text-sm text-slate-600">{document.uploadedDocument.fileName} · {document.uploadedDocument.mimeType} · {document.uploadedDocument.sizeBytes} bytes</p>{!privateFileAvailable ? <p className="mt-2 text-sm font-semibold text-amber-700">Stored file missing from private storage. The upload record exists, but the file is not available on this server. Ask the candidate to re-upload, or restore the file from backup.</p> : null}</div><AdminDocumentActions url={`/api/admin/applications/${application.id}/uploads/${document.uploadedDocument.id}`} filename={document.uploadedDocument.fileName} previewable={['application/pdf','image/jpeg','image/png','image/webp'].includes(document.uploadedDocument.mimeType)} /></div></article>) : null) : <p className="text-sm text-slate-600">No Stage 3 uploads.</p>}</div></div>
        {application.deletedAt ? null : <form action={adminStage3Action} className="mt-5 flex flex-wrap gap-2"><input type="hidden" name="applicationDbId" value={application.id} /><input className="input max-w-xs" name="notes" placeholder="Optional notes" /><button className="btn btn-secondary" name="action" value="approve">Approve Stage 3</button><button className="btn btn-secondary" name="action" value="correction">Request correction</button><button className="btn btn-secondary" name="action" value="reject">Reject Stage 3</button></form>}
      </section>) : null}

      {((stageFour && ['Available','In Progress','Released','Submitted','Under Review','Approved','Completed'].includes(stageFour.status)) || offer) ? (
      <section className="card mt-6 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><h2 className="font-bold">Stage 4 Offer Stage</h2><StatusBadge status={offer?.status ?? stageFour?.status ?? "Locked"} /></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><p><strong>Released:</strong> {formatDateTime(offer?.releasedAt)}</p><p><strong>Candidate decision:</strong> {offer?.status === 'Accepted' || offer?.status === 'Declined' ? offer.status : 'Pending'}</p><p><strong>Decision time:</strong> {formatDateTime(offer?.candidateDecisionAt)}</p><p><strong>Stage 5:</strong> {stageFive?.status ?? 'Locked'}</p>{offer?.candidateDecisionNote ? <p className="md:col-span-2 whitespace-pre-wrap"><strong>Candidate note:</strong> {offer.candidateDecisionNote}</p> : null}</div>
        {application.deletedAt ? <p className="mt-3 text-sm font-semibold text-red-700">Restore this application before taking offer actions.</p> : canEditOffer ? <form action={adminOfferAction} className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4"><input type="hidden" name="applicationDbId" value={application.id} /><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Role offered<input className="input mt-1" name="roleOffered" defaultValue={offer?.roleOffered ?? application.roleAppliedFor} required /></label><label className="text-sm font-semibold">Salary/compensation<input className="input mt-1" name="salary" defaultValue={offer?.salary ?? ''} required /></label><label className="text-sm font-semibold">Start date<input className="input mt-1" type="date" name="startDate" defaultValue={offer?.startDate?.toISOString().slice(0,10) ?? ''} required /></label><label className="text-sm font-semibold">Work mode<input className="input mt-1" name="workMode" defaultValue={offer?.workMode ?? application.workModePreference ?? ''} required /></label><label className="text-sm font-semibold">Reporting manager<input className="input mt-1" name="reportingManager" defaultValue={offer?.reportingManager ?? ''} /></label><label className="text-sm font-semibold">Probation period<input className="input mt-1" name="probationPeriod" defaultValue={offer?.probationPeriod ?? ''} /></label><label className="text-sm font-semibold">Offer expiry date<input className="input mt-1" type="date" name="offerExpiryDate" defaultValue={offer?.offerExpiryDate?.toISOString().slice(0,10) ?? ''} /></label><label className="text-sm font-semibold md:col-span-2">Special conditions / notes<textarea className="input mt-1 min-h-28" name="specialConditions" defaultValue={offer?.specialConditions ?? ''} /></label></div><div className="flex flex-wrap gap-2"><button className="btn btn-secondary" name="action" value="draft">Save draft</button><button className="btn btn-primary" name="action" value="release">Release offer</button>{offer?.status === 'Released' ? <button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700" name="action" value="withdraw">Withdraw offer</button> : null}</div></form> : <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Accepted/declined offers are read-only.</p>}
      </section>) : null}

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Stage 2 admin actions</h2>
        {application.deletedAt ? <p className="mt-3 text-sm font-semibold text-red-700">Restore this application before taking stage actions.</p> : (
          <form action={adminStage2Action} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="applicationDbId" value={application.id} /><input className="input max-w-xs" name="notes" placeholder="Optional notes" /><button className="btn btn-secondary" name="action" value="approve">Approve Stage 2</button><button className="btn btn-secondary" name="action" value="correction">Request correction</button><button className="btn btn-secondary" name="action" value="reject">Reject Stage 2</button></form>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Stage 1 admin actions</h2>
        {application.deletedAt ? (
          <p className="mt-3 text-sm font-semibold text-red-700">
            Restore this application before taking stage actions.
          </p>
        ) : (
          <form
            action={adminStage1Action}
            className="mt-4 flex flex-wrap gap-2"
          >
            <input
              type="hidden"
              name="applicationDbId"
              value={application.id}
            />
            <input
              className="input max-w-xs"
              name="notes"
              placeholder="Optional notes"
            />
            <button className="btn btn-secondary" name="action" value="approve">
              Approve Stage 1
            </button>
            <button
              className="btn btn-secondary"
              name="action"
              value="correction"
            >
              Request correction
            </button>
            <button className="btn btn-secondary" name="action" value="reject">
              Reject
            </button>
          </form>
        )}
      </section>

      <section className="card mt-6 border border-red-200 bg-red-50 p-5">
        <h2 className="font-bold text-red-800">Delete controls</h2>
        {application.deletedAt ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Deleted {formatDateTime(application.deletedAt)} by{" "}
              {application.deletedByAdminEmail ?? "unknown admin"}. Reason:{" "}
              {application.deleteReason || "No reason provided"}.
            </p>
            <form action={restoreApplicationAction}>
              <input
                type="hidden"
                name="applicationDbId"
                value={application.id}
              />
              <button className="btn btn-secondary">Restore application</button>
            </form>
            <form
              action={permanentlyDeleteApplicationAction}
              className="space-y-3 rounded border border-red-300 bg-white p-4"
            >
              <input
                type="hidden"
                name="applicationDbId"
                value={application.id}
              />
              <p className="font-semibold text-red-800">
                This permanently deletes the application and cannot be undone.
              </p>
              <label className="block text-sm font-semibold">
                Type {application.applicationId} to confirm permanent delete
              </label>
              <input
                className="input"
                name="confirmationApplicationId"
                placeholder={application.applicationId}
                required
              />
              <button className="btn bg-red-700 text-white hover:bg-red-800">
                Permanently delete
              </button>
            </form>
          </div>
        ) : (
          <form action={softDeleteApplicationAction} className="mt-4 space-y-3">
            <input
              type="hidden"
              name="applicationDbId"
              value={application.id}
            />
            <label className="block text-sm font-semibold">
              Optional reason
            </label>
            <textarea className="input" name="deleteReason" maxLength={500} />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                name="confirmDelete"
                value="DELETE"
                required
              />{" "}
              Confirm moving this application to deleted records
            </label>
            <button className="btn bg-red-700 text-white hover:bg-red-800">
              Move to deleted records
            </button>
          </form>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Email history</h2>
        {application.emails.length > 0 ? (
          application.emails.map((email: EmailNotification) => (
            <p key={email.id}>
              {formatDateTime(email.createdAt)} · {email.template} ·{" "}
              {email.status} · {email.toEmail}
            </p>
          ))
        ) : (
          <p>No email history found.</p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Audit logs</h2>
        {application.auditLogs.length > 0 ? (
          application.auditLogs.map((log: AuditLog) => (
            <p key={log.id}>
              {formatDateTime(log.createdAt)} · {log.actorType} · {log.action}
            </p>
          ))
        ) : (
          <p>No audit logs found.</p>
        )}
      </section>
    </main>
  );
}
