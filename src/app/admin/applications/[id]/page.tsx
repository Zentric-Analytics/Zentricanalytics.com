import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import {
  privateUploadConfigurationStatus,
  privateUploadDiagnostic,
} from "@/lib/storage";
import {
  parseStage3Metadata,
  parseStage5RoleSchedule,
  stage3InterviewModes,
  stage3ScreeningTypes,
} from "@/lib/hiring";
import {
  adminStage1Action,
  permanentlyDeleteApplicationAction,
  restoreApplicationAction,
  softDeleteApplicationAction,
  adminStage2Action,
  adminStage3Action,
  adminStage3InstructionAction,
  adminOfferAction,
  adminStage5AgreementAction,
  adminStage5Action,
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
    employmentAgreement: true;
  };
}>;

type ApplicationStage = AdminApplication["stages"][number];
type ApplicantDocument = NonNullable<
  ApplicationStage["submissions"][number]
>["documents"][number];
type EmailNotification = AdminApplication["emails"][number];
type AuditLog = AdminApplication["auditLogs"][number];

type UploadDiagnostic = Awaited<ReturnType<typeof privateUploadDiagnostic>> & {
  databaseMetadataSizeBytes: number | null;
};

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function StorageDiagnosticsPanel({
  status,
  diagnostics,
}: {
  status: Awaited<ReturnType<typeof privateUploadConfigurationStatus>>;
  diagnostics: Array<{
    id: string;
    label: string;
    diagnostic: UploadDiagnostic;
  }>;
}) {
  return (
    <details className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
      <summary className="cursor-pointer font-bold text-blue-950">
        Storage diagnostics
      </summary>
      <p className="mt-1 text-xs text-blue-900">
        Admin storage diagnostics: admin-only runtime view of the upload
        provider, configured root, resolved paths, and on-disk file checks.
      </p>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        <div>
          <dt className="font-semibold">Selected provider</dt>
          <dd>{status.provider}</dd>
        </div>
        <div>
          <dt className="font-semibold">APP_ENV</dt>
          <dd>{status.appEnv ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="font-semibold">NODE_ENV</dt>
          <dd>{status.nodeEnv ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="font-semibold">PRIVATE_UPLOAD_ROOT configured</dt>
          <dd>{yesNo(status.rootConfigured)}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold">Resolved upload root</dt>
          <dd className="break-all font-mono text-xs">
            {status.resolvedPrivateUploadRoot}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Root directory exists</dt>
          <dd>{yesNo(status.rootExists)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Root directory writable</dt>
          <dd>{yesNo(status.rootWritable)}</dd>
        </div>
      </dl>
      {diagnostics.length ? (
        <div className="mt-4 grid gap-3">
          {diagnostics.map(({ id, label, diagnostic }) => (
            <details
              className="rounded-xl border border-blue-100 bg-white p-3"
              key={id}
            >
              <summary className="cursor-pointer font-semibold text-blue-950">
                {label}
              </summary>
              <dl className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <dt className="font-semibold">Provider</dt>
                  <dd>{diagnostic.provider}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Storage key present</dt>
                  <dd>{yesNo(diagnostic.storageKeyPresent)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">
                    PRIVATE_UPLOAD_ROOT configured
                  </dt>
                  <dd>{yesNo(diagnostic.privateUploadRootConfigured)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">File exists</dt>
                  <dd>{yesNo(diagnostic.fileExists)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Root exists</dt>
                  <dd>{yesNo(diagnostic.rootExists)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Root writable</dt>
                  <dd>{yesNo(diagnostic.rootWritable)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">File size on disk</dt>
                  <dd>{diagnostic.fileSizeOnDisk ?? "Missing"}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Metadata size from database</dt>
                  <dd>{diagnostic.databaseMetadataSizeBytes ?? "Missing"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-semibold">
                    Resolved private upload root
                  </dt>
                  <dd className="break-all font-mono text-xs">
                    {diagnostic.resolvedPrivateUploadRoot}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-semibold">Expected resolved file path</dt>
                  <dd className="break-all font-mono text-xs">
                    {diagnostic.expectedResolvedFilePath ?? "Unavailable"}
                  </dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-blue-900">
          No uploaded document records are attached to this application.
        </p>
      )}
    </details>
  );
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

function formatDateTime(value?: Date | null) {
  return value ? value.toISOString() : "Missing";
}

function formatField(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function InfoGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          key={label}
        >
          <dt className="font-semibold text-slate-500">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-950">
            {formatField(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StageActionForm({
  action,
  applicationId,
  stage,
}: {
  action: (formData: FormData) => void | Promise<void>;
  applicationId: string;
  stage: string;
}) {
  return (
    <form action={action} className="mt-4 flex flex-wrap gap-2">
      <input type="hidden" name="applicationDbId" value={applicationId} />
      <input
        className="input max-w-xs"
        name="notes"
        placeholder="Optional notes"
      />
      <button className="btn btn-secondary" name="action" value="approve">
        Approve {stage}
      </button>
      <button className="btn btn-secondary" name="action" value="correction">
        Request correction
      </button>
      <button
        className="rounded-full border border-red-200 px-5 py-2 font-semibold text-red-700 hover:bg-red-50"
        name="action"
        value="reject"
      >
        Reject {stage}
      </button>
    </form>
  );
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
  if (params.success === "stage2_approved")
    messages.push("Stage 2 was approved and Stage 3 is now available.");
  if (params.success === "stage2_already_approved")
    messages.push("Stage 2 is already approved.");
  if (params.success === "stage2_correction")
    messages.push("Stage 2 correction was requested.");
  if (params.success === "stage2_rejected")
    messages.push("Stage 2 was rejected.");
  if (params.success === "stage3_released")
    messages.push("Stage 3 instructions were released/updated.");
  if (params.success === "stage3_approved")
    messages.push("Stage 3 was approved and Stage 4 is now available.");
  if (params.success === "stage3_already_approved")
    messages.push("Stage 3 is already approved.");
  if (params.success === "stage3_correction")
    messages.push("Stage 3 correction was requested.");
  if (params.success === "stage3_rejected")
    messages.push("Stage 3 was rejected.");
  if (params.success === "offer_draft") messages.push("Draft offer saved.");
  if (params.success === "offer_released")
    messages.push("Offer released to candidate.");
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
      employmentAgreement: true,
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
  const stageTwo = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 2,
  );
  const stageTwoSubmission = stageTwo?.submissions[0];
  const stageTwoPayload = (stageTwoSubmission?.payload ?? {}) as Record<
    string,
    string | boolean
  >;
  const stageTwoSignature = stageTwoSubmission?.signature;
  const stageTwoDocuments = stageTwoSubmission?.documents ?? [];
  const stageThree = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 3,
  );
  const stageThreeMetadata = parseStage3Metadata(stageThree?.metadata);
  const stageThreeSubmission = stageThree?.submissions[0];
  const stageThreePayload = (stageThreeSubmission?.payload ?? {}) as Record<
    string,
    string | boolean
  >;
  const stageThreeDocuments = stageThreeSubmission?.documents ?? [];
  const signature = stageOneSubmission?.signature;
  const documents = stageOneSubmission?.documents ?? [];
  const documentsWithAvailability = await Promise.all(
    documents.map(async (document: ApplicantDocument) => {
      const diagnostic = document.uploadedDocument
        ? await privateUploadDiagnostic(
            document.uploadedDocument.storageKey,
            document.uploadedDocument.provider,
          )
        : null;
      return {
        document,
        privateFileAvailable: Boolean(diagnostic?.fileExists),
        diagnostic,
      };
    }),
  );
  const stageTwoDocumentsWithAvailability = await Promise.all(
    stageTwoDocuments.map(async (document: ApplicantDocument) => {
      const diagnostic = document.uploadedDocument
        ? await privateUploadDiagnostic(
            document.uploadedDocument.storageKey,
            document.uploadedDocument.provider,
          )
        : null;
      return {
        document,
        privateFileAvailable: Boolean(diagnostic?.fileExists),
        diagnostic,
      };
    }),
  );
  const stageFour = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 4,
  );
  const stageFive = application.stages.find(
    (stage: ApplicationStage) => stage.stageOrder === 5,
  );
  const offer = application.offer;
  const agreement = application.employmentAgreement;
  const roleSchedule = parseStage5RoleSchedule(agreement?.roleSchedule);
  const stageFiveSubmission = stageFive?.submissions[0];
  const stageFiveSignature = stageFiveSubmission?.signature;
  const canEditOffer = !offer || ["Draft", "Released"].includes(offer.status);
  const stageThreeDocumentsWithAvailability = await Promise.all(
    stageThreeDocuments.map(async (document: ApplicantDocument) => {
      const diagnostic = document.uploadedDocument
        ? await privateUploadDiagnostic(
            document.uploadedDocument.storageKey,
            document.uploadedDocument.provider,
          )
        : null;
      return {
        document,
        privateFileAvailable: Boolean(diagnostic?.fileExists),
        diagnostic,
      };
    }),
  );
  const storageStatus = await privateUploadConfigurationStatus();
  const uploadDiagnostics = [
    ...documentsWithAvailability,
    ...stageTwoDocumentsWithAvailability,
    ...stageThreeDocumentsWithAvailability,
  ]
    .filter((item) => item.document.uploadedDocument && item.diagnostic)
    .map((item) => ({
      id: item.document.uploadedDocument!.id,
      label: `${item.document.uploadedDocument!.kind}: ${item.document.uploadedDocument!.fileName}`,
      diagnostic: {
        ...item.diagnostic!,
        databaseMetadataSizeBytes: item.document.uploadedDocument!.sizeBytes,
      },
    }));
  const stageOnePdfAvailable = Boolean(
    stageOneSubmission?.submittedAt &&
    signature?.confirmed &&
    signature?.signedAt,
  );

  const stageOnePayload = (stageOneSubmission?.payload ?? {}) as Record<
    string,
    unknown
  >;
  const timelineStages = application.stages.map((stage) => {
    const order = stage.stageOrder;
    return { order, stage, submission: stage.submissions[0], approval: stage.approvals[0] };
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <Link
              className="btn btn-secondary mb-4 inline-flex"
              href="/admin/applications"
            >
              ← Back to applications
            </Link>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {application.applicationId}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {application.applicant.fullName}
            </h1>
            <p className="mt-2 text-slate-600">
              {application.roleAppliedFor} · Stage{" "}
              {application.currentStageOrder} · {application.status}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={application.status} />
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
          <h2 className="text-xl font-bold">Profile summary</h2>
          <InfoGrid
            rows={[
              ["Name", application.applicant.fullName],
              ["Email", application.applicant.email],
              [
                "Phone",
                application.applicant.phoneE164 ??
                  application.applicant.phone ??
                  "No phone provided",
              ],
              [
                "Location",
                application.applicant.location ??
                  application.applicant.phoneCountryName ??
                  "Not captured",
              ],
              ["Role applied for", application.roleAppliedFor],
              [
                "Experience level",
                application.experienceLevel ?? "Not provided",
              ],
              ["Application date", formatDateTime(application.createdAt)],
              [
                "Current stage/status",
                `Stage ${application.currentStageOrder} · ${application.status}`,
              ],
            ]}
          />
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-xl font-bold">Stage timeline / progress</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {timelineStages.map(({ order, stage, submission, approval }) => (
              <div
                className={`rounded-2xl border p-4 ${application.currentStageOrder === order ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
                key={order}
              >
                <p className="text-sm font-bold text-slate-950">
                  Stage {order}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {stage?.title ??
                    (order === 5 ? "Agreement / onboarding" : "Not built yet")}
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {stage?.status ?? "Locked"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Submitted: {formatDateTime(submission?.submittedAt)}
                </p>
                <p className="text-xs text-slate-500">
                  Approved: {formatDateTime(approval?.createdAt)}
                </p>
                {application.currentStageOrder === order ? (
                  <span className="mt-3 inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                    Current
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-6 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Stage 1 Application</h2>
              <p className="text-sm text-slate-600">
                Submitted application answers, official PDF, candidate upload,
                and Stage 1 decisions.
              </p>
            </div>
            <StatusBadge status={stageOneStatus} />
          </div>
          <div className="mt-4">
            {stageOneSubmission ? (
              <InfoGrid
                rows={[
                  ["Message", stageOnePayload.message ?? application.message],
                  ["Skills", stageOnePayload.skills ?? application.skills],
                  ["Work mode preference", application.workModePreference],
                  ["Portfolio", application.portfolioUrl],
                  ["Submitted", formatDateTime(stageOneSubmission.submittedAt)],
                  [
                    "Signature",
                    signature
                      ? `${signature.typedName || "Missing typed name"} · ${signature.confirmed ? "Confirmed" : "Missing"} · ${formatDateTime(signature.signedAt)}`
                      : "Missing signature",
                  ],
                ]}
              />
            ) : (
              <p className="text-sm text-slate-600">
                No Stage 1 submission found.
              </p>
            )}
          </div>
          <h3 className="mt-5 font-semibold">Official documents</h3>
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
          <h3 className="mt-5 font-semibold">Uploaded documents</h3>
          <StorageDiagnosticsPanel
            status={storageStatus}
            diagnostics={uploadDiagnostics}
          />
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
                            {uploadedDocument.kind} ·{" "}
                            {uploadedDocument.mimeType} ·{" "}
                            {uploadedDocument.sizeBytes} bytes
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Uploaded{" "}
                            {formatDateTime(uploadedDocument.createdAt)}
                          </p>
                          {!privateFileAvailable ? (
                            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                              Stored file missing from private storage. The
                              upload record exists, but the file is not
                              available on this server. Ask the candidate to
                              re-upload, or restore the file from backup.
                            </p>
                          ) : null}
                        </div>
                        <AdminDocumentActions
                          url={`/api/admin/applications/${application.id}/uploads/${uploadedDocument.id}`}
                          filename={uploadedDocument.fileName}
                          previewable={isPreviewable && privateFileAvailable}
                          available={privateFileAvailable}
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
          <h3 className="mt-5 font-semibold">Stage 1 admin actions</h3>
          {application.deletedAt ? (
            <p className="mt-3 text-sm font-semibold text-red-700">
              Restore this application before taking stage actions.
            </p>
          ) : (
            <StageActionForm
              action={adminStage1Action}
              applicationId={application.id}
              stage="Stage 1"
            />
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold">Identity details</h3>
                  <p>
                    Legal name: {String(stageTwoPayload.fullLegalName ?? "—")}
                  </p>
                  <p>DOB: {String(stageTwoPayload.dateOfBirth ?? "—")}</p>
                  <p>Gender: {String(stageTwoPayload.gender ?? "—")}</p>
                  <p>
                    Nationality: {String(stageTwoPayload.nationality ?? "—")}
                  </p>
                  <p>Residence: {String(stageTwoPayload.currentCity ?? "—")}</p>
                  <p>
                    Phone: {String(stageTwoPayload.applicantPhoneE164 ?? "—")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold">Primary ID summary</h3>
                  <p>
                    Primary ID type:{" "}
                    {String(stageTwoPayload.primaryIdType ?? "—")}
                  </p>
                  <p>
                    Primary ID number:{" "}
                    {String(stageTwoPayload.primaryIdNumberMasked ?? "—")}
                  </p>
                  <p>
                    Authority:{" "}
                    {String(stageTwoPayload.primaryIdIssuingAuthority ?? "—")}
                  </p>
                  <p>
                    Issue date:{" "}
                    {String(stageTwoPayload.primaryIdIssueDate ?? "—")}
                  </p>
                  <p>
                    Expiry date:{" "}
                    {String(stageTwoPayload.primaryIdExpiryDate ?? "—")}
                  </p>
                </div>
                {stageTwoPayload.hasSecondaryId ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold">Secondary ID summary</h3>
                    <p>
                      Secondary ID type:{" "}
                      {String(stageTwoPayload.secondaryIdType ?? "—")}
                    </p>
                    <p>
                      Secondary ID number:{" "}
                      {String(stageTwoPayload.secondaryIdNumberMasked ?? "—")}
                    </p>
                    <p>
                      Authority:{" "}
                      {String(
                        stageTwoPayload.secondaryIdIssuingAuthority ?? "—",
                      )}
                    </p>
                    <p>
                      Issue date:{" "}
                      {String(stageTwoPayload.secondaryIdIssueDate ?? "—")}
                    </p>
                    <p>
                      Expiry date:{" "}
                      {String(stageTwoPayload.secondaryIdExpiryDate ?? "—")}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold">Emergency contact</h3>
                  <p>
                    Name: {String(stageTwoPayload.emergencyContactName ?? "—")}
                  </p>
                  <p>
                    Relationship:{" "}
                    {String(
                      stageTwoPayload.emergencyContactRelationship ?? "—",
                    )}
                  </p>
                  <p>
                    Phone:{" "}
                    {String(stageTwoPayload.emergencyContactPhoneE164 ?? "—")}
                  </p>
                  <p>
                    Address:{" "}
                    {String(stageTwoPayload.emergencyContactAddress ?? "—")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold">Declaration / signature</h3>
                  <p>
                    Accuracy confirmed:{" "}
                    {stageTwoPayload.declarationAccuracy ? "Yes" : "No"}
                  </p>
                  <p>
                    Processing consent:{" "}
                    {stageTwoPayload.identityProcessingConsent ? "Yes" : "No"}
                  </p>
                  <p>
                    Signature:{" "}
                    {stageTwoSignature?.typedName ??
                      String(stageTwoPayload.signatureName ?? "—")}
                  </p>
                  <p>Signed: {formatDateTime(stageTwoSignature?.signedAt)}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold">Uploaded Stage 2 documents</h3>
                <div className="mt-3 grid gap-3">
                  {stageTwoDocumentsWithAvailability.map(
                    ({ document, privateFileAvailable }) =>
                      document.uploadedDocument ? (
                        <article
                          className="rounded-2xl border border-slate-200 p-4"
                          key={document.id}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">
                                {document.uploadedDocument.kind}
                              </p>
                              <p className="text-sm text-slate-600">
                                {document.uploadedDocument.fileName} ·{" "}
                                {document.uploadedDocument.mimeType} ·{" "}
                                {document.uploadedDocument.sizeBytes} bytes
                              </p>
                              {!privateFileAvailable ? (
                                <p className="mt-2 text-sm font-semibold text-amber-700">
                                  Stored file missing from private storage. The
                                  upload record exists, but the file is not
                                  available on this server. Ask the candidate to
                                  re-upload, or restore the file from backup.
                                </p>
                              ) : null}
                            </div>
                            <AdminDocumentActions
                              url={`/api/admin/applications/${application.id}/uploads/${document.uploadedDocument.id}`}
                              filename={document.uploadedDocument.fileName}
                              previewable={
                                privateFileAvailable &&
                                [
                                  "application/pdf",
                                  "image/jpeg",
                                  "image/png",
                                  "image/webp",
                                ].includes(document.uploadedDocument.mimeType)
                              }
                              available={privateFileAvailable}
                            />
                          </div>
                        </article>
                      ) : null,
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No Stage 2 submission found.
            </p>
          )}
          <h3 className="mt-5 font-semibold">Stage 2 admin actions</h3>
          {application.deletedAt ? (
            <p className="mt-3 text-sm font-semibold text-red-700">
              Restore this application before taking stage actions.
            </p>
          ) : (
            <StageActionForm
              action={adminStage2Action}
              applicationId={application.id}
              stage="Stage 2"
            />
          )}
        </section>

        {stageThree &&
        [
          "Locked",
          "Available",
          "In Progress",
          "Correction Requested",
          "Submitted",
          "Under Review",
          "Approved",
          "Rejected",
        ].includes(stageThree.status) ? (
          <section className="card mt-6 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="font-bold">
                Stage 3 Screening / Interview / Assessment
              </h2>
              <StatusBadge status={stageThree.status} />
            </div>
            {application.deletedAt ? (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Restore this application before taking Stage 3 actions.
              </p>
            ) : ["Approved", "Rejected"].includes(stageThree.status) ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Stage 3 is {stageThree.status.toLowerCase()}; setup editing is
                closed for this stage.
              </p>
            ) : stageThree.status === "Locked" ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Stage 3 is locked until Stage 2 is approved. Release controls
                will appear when this stage becomes available.
              </p>
            ) : (
              <form
                action={adminStage3InstructionAction}
                className="mt-5 space-y-5 rounded-2xl border border-slate-200 p-4"
              >
                <input
                  type="hidden"
                  name="applicationDbId"
                  value={application.id}
                />
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">Screening setup</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold">
                      Screening type{" "}
                      <span className="text-red-600">(required)</span>
                      <select
                        className="input mt-1"
                        name="screeningType"
                        defaultValue={
                          stageThreeMetadata.screeningType ?? "Screening"
                        }
                      >
                        {stage3ScreeningTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Title <span className="text-red-600">(required)</span>
                      <input
                        className="input mt-1"
                        name="title"
                        defaultValue={stageThreeMetadata.title ?? ""}
                        required
                      />
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">Interview details</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold">
                      Interview mode{" "}
                      <span className="text-red-600">(required)</span>
                      <select
                        className="input mt-1"
                        name="interviewMode"
                        defaultValue={
                          stageThreeMetadata.interviewMode ?? "Not applicable"
                        }
                      >
                        {stage3InterviewModes.map((mode) => (
                          <option key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Meeting link{" "}
                      <span className="text-slate-500">(optional)</span>
                      <input
                        className="input mt-1"
                        name="meetingLink"
                        placeholder="https://..."
                        defaultValue={stageThreeMetadata.meetingLink ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Location{" "}
                      <span className="text-slate-500">(optional)</span>
                      <input
                        className="input mt-1"
                        name="location"
                        defaultValue={stageThreeMetadata.location ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Scheduled date/time{" "}
                      <span className="text-slate-500">(optional)</span>
                      <input
                        className="input mt-1"
                        name="scheduledAt"
                        type="datetime-local"
                        defaultValue={stageThreeMetadata.scheduledAt ?? ""}
                      />
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">Assessment requirements</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-semibold">
                      Deadline{" "}
                      <span className="text-slate-500">(optional)</span>
                      <input
                        className="input mt-1"
                        name="deadlineAt"
                        type="datetime-local"
                        defaultValue={stageThreeMetadata.deadlineAt ?? ""}
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Upload instructions / accepted file note{" "}
                      <span className="text-slate-500">(optional)</span>
                      <input
                        className="input mt-1"
                        name="allowedUploadNote"
                        defaultValue={
                          stageThreeMetadata.allowedUploadNote ?? ""
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                    <label className="flex gap-2">
                      <input
                        name="requiresCandidateResponse"
                        type="checkbox"
                        defaultChecked={
                          stageThreeMetadata.requiresCandidateResponse ?? true
                        }
                      />{" "}
                      Candidate response required
                    </label>
                    <label className="flex gap-2">
                      <input
                        name="requiresUpload"
                        type="checkbox"
                        defaultChecked={
                          stageThreeMetadata.requiresUpload ?? false
                        }
                      />{" "}
                      Assessment upload required
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">Candidate instructions</h3>
                  <label className="mt-3 block text-sm font-semibold">
                    Instructions{" "}
                    <span className="text-red-600">(required)</span>
                    <textarea
                      className="input mt-1 min-h-32"
                      name="instructions"
                      defaultValue={stageThreeMetadata.instructions ?? ""}
                      required
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-700">
                    Release or update the Stage 3 workspace shown to the
                    candidate.
                  </p>
                  <button className="btn btn-primary">
                    Release/update Stage 3 instructions
                  </button>
                </div>
              </form>
            )}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold">Released instructions</h3>
                <p className="mt-2 text-sm">
                  {stageThreeMetadata.title ?? "Not released"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {stageThreeMetadata.instructions ??
                    "No instructions released yet."}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Released: {stageThreeMetadata.releasedAt ?? "—"} · By:{" "}
                  {stageThreeMetadata.releasedByAdminEmail ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold">Candidate response</h3>
                {stageThreeSubmission ? (
                  <div className="mt-2 text-sm">
                    <p>
                      <strong>Availability:</strong>{" "}
                      {String(stageThreePayload.availability ?? "—")}
                    </p>
                    <p className="whitespace-pre-wrap">
                      <strong>Message:</strong>{" "}
                      {String(stageThreePayload.responseMessage ?? "—")}
                    </p>
                    <p>
                      <strong>Declared accurate:</strong>{" "}
                      {stageThreePayload.declarationAccuracy ? "Yes" : "No"}
                    </p>
                    <p>
                      Submitted:{" "}
                      {formatDateTime(stageThreeSubmission.submittedAt)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    No Stage 3 response submitted.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5">
              <h3 className="font-semibold">Uploaded Stage 3 files</h3>
              <div className="mt-3 grid gap-3">
                {stageThreeDocumentsWithAvailability.length ? (
                  stageThreeDocumentsWithAvailability.map(
                    ({ document, privateFileAvailable }) =>
                      document.uploadedDocument ? (
                        <article
                          className="rounded-2xl border border-slate-200 p-4"
                          key={document.id}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">
                                {document.uploadedDocument.kind}
                              </p>
                              <p className="text-sm text-slate-600">
                                {document.uploadedDocument.fileName} ·{" "}
                                {document.uploadedDocument.mimeType} ·{" "}
                                {document.uploadedDocument.sizeBytes} bytes
                              </p>
                              {!privateFileAvailable ? (
                                <p className="mt-2 text-sm font-semibold text-amber-700">
                                  Stored file missing from private storage. The
                                  upload record exists, but the file is not
                                  available on this server. Ask the candidate to
                                  re-upload, or restore the file from backup.
                                </p>
                              ) : null}
                            </div>
                            <AdminDocumentActions
                              url={`/api/admin/applications/${application.id}/uploads/${document.uploadedDocument.id}`}
                              filename={document.uploadedDocument.fileName}
                              previewable={
                                privateFileAvailable &&
                                [
                                  "application/pdf",
                                  "image/jpeg",
                                  "image/png",
                                  "image/webp",
                                ].includes(document.uploadedDocument.mimeType)
                              }
                              available={privateFileAvailable}
                            />
                          </div>
                        </article>
                      ) : null,
                  )
                ) : (
                  <p className="text-sm text-slate-600">No Stage 3 uploads.</p>
                )}
              </div>
            </div>
            <h3 className="mt-5 font-semibold">Stage 3 admin actions</h3>
            {application.deletedAt ? (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Restore this application before taking stage actions.
              </p>
            ) : (
              <StageActionForm
                action={adminStage3Action}
                applicationId={application.id}
                stage="Stage 3"
              />
            )}
          </section>
        ) : null}

        {(stageFour &&
          [
            "Available",
            "In Progress",
            "Released",
            "Submitted",
            "Under Review",
            "Approved",
            "Completed",
          ].includes(stageFour.status)) ||
        offer ? (
          <section className="card mt-6 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="font-bold">Stage 4 Offer Stage</h2>
              <StatusBadge
                status={offer?.status ?? stageFour?.status ?? "Locked"}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <p>
                <strong>Released:</strong> {formatDateTime(offer?.releasedAt)}
              </p>
              <p>
                <strong>Candidate decision:</strong>{" "}
                {offer?.status === "Accepted" || offer?.status === "Declined"
                  ? offer.status
                  : "Pending"}
              </p>
              <p>
                <strong>Decision time:</strong>{" "}
                {formatDateTime(offer?.candidateDecisionAt)}
              </p>
              <p>
                <strong>Stage 5:</strong> {stageFive?.status ?? "Locked"}
              </p>
              {offer?.candidateDecisionNote ? (
                <p className="md:col-span-2 whitespace-pre-wrap">
                  <strong>Candidate note:</strong> {offer.candidateDecisionNote}
                </p>
              ) : null}
            </div>
            {application.deletedAt ? (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Restore this application before taking offer actions.
              </p>
            ) : canEditOffer ? (
              <form
                action={adminOfferAction}
                className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4"
              >
                <input
                  type="hidden"
                  name="applicationDbId"
                  value={application.id}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Role offered
                    <input
                      className="input mt-1"
                      name="roleOffered"
                      defaultValue={
                        offer?.roleOffered ?? application.roleAppliedFor
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Salary/compensation
                    <input
                      className="input mt-1"
                      name="salary"
                      defaultValue={offer?.salary ?? ""}
                      required
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Start date
                    <input
                      className="input mt-1"
                      type="date"
                      name="startDate"
                      defaultValue={
                        offer?.startDate?.toISOString().slice(0, 10) ?? ""
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Work mode
                    <input
                      className="input mt-1"
                      name="workMode"
                      defaultValue={
                        offer?.workMode ?? application.workModePreference ?? ""
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Reporting manager
                    <input
                      className="input mt-1"
                      name="reportingManager"
                      defaultValue={offer?.reportingManager ?? ""}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Probation period
                    <input
                      className="input mt-1"
                      name="probationPeriod"
                      defaultValue={offer?.probationPeriod ?? ""}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Offer expiry date
                    <input
                      className="input mt-1"
                      type="date"
                      name="offerExpiryDate"
                      defaultValue={
                        offer?.offerExpiryDate?.toISOString().slice(0, 10) ?? ""
                      }
                    />
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Special conditions / notes
                    <textarea
                      className="input mt-1 min-h-28"
                      name="specialConditions"
                      defaultValue={offer?.specialConditions ?? ""}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary"
                    name="action"
                    value="draft"
                  >
                    Save draft
                  </button>
                  <button
                    className="btn btn-primary"
                    name="action"
                    value="release"
                  >
                    Release offer
                  </button>
                  {offer?.status === "Released" ? (
                    <button
                      className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700"
                      name="action"
                      value="withdraw"
                    >
                      Withdraw offer
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Accepted/declined offers are read-only.
              </p>
            )}
          </section>
        ) : null}

        {(stageFive && stageFive.status !== "Locked") || application.currentStageOrder >= 5 || offer?.status === "Accepted" || agreement ? (
          <section className="card mt-6 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><h2 className="font-bold">Stage 5 Agreement / onboarding · Employment Agreement + Role Schedule</h2><StatusBadge status={stageFive?.status ?? agreement?.status ?? "Locked"} /></div>
            {!offer || offer.status !== "Accepted" ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Stage 5 release requires an accepted Stage 4 offer.</p> : null}
            {application.deletedAt ? <p className="mt-3 text-sm font-semibold text-red-700">Restore this application before taking Stage 5 actions.</p> : !["Approved","Rejected"].includes(stageFive?.status ?? "") ? (
              <form action={adminStage5AgreementAction} className="mt-5 space-y-4 rounded-2xl border border-slate-200 p-4">
                <input type="hidden" name="applicationDbId" value={application.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  {[ ["title","Agreement title", agreement?.title ?? "Employment Agreement + Role Schedule"], ["version","Agreement version", agreement?.version ?? 1], ["roleOffered","Role offered", roleSchedule.roleOffered ?? offer?.roleOffered ?? application.roleAppliedFor], ["departmentTeam","Department/team", roleSchedule.departmentTeam ?? ""], ["reportingManager","Reporting manager", roleSchedule.reportingManager ?? offer?.reportingManager ?? ""], ["workMode","Work mode", roleSchedule.workMode ?? offer?.workMode ?? application.workModePreference ?? ""], ["compensationSalary","Compensation/salary", roleSchedule.compensationSalary ?? offer?.salary ?? ""], ["probationPeriod","Probation period", roleSchedule.probationPeriod ?? offer?.probationPeriod ?? ""], ["workingHours","Working hours / schedule", roleSchedule.workingHours ?? ""], ["agreementExpiryDate","Agreement expiry date", roleSchedule.agreementExpiryDate ?? ""] ].map(([name,label,value]) => <label className="text-sm font-semibold" key={String(name)}>{String(label)}<input className="input mt-1" name={String(name)} type={name === "version" ? "number" : name === "agreementExpiryDate" ? "date" : "text"} defaultValue={String(value ?? "")} required={["title","version","roleOffered","workMode","compensationSalary","workingHours"].includes(String(name))} /></label>)}
                  <label className="text-sm font-semibold">Start date<input className="input mt-1" name="startDate" type="date" defaultValue={String(roleSchedule.startDate ?? offer?.startDate?.toISOString().slice(0,10) ?? "")} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Duties and responsibilities<textarea className="input mt-1 min-h-24" name="dutiesAndResponsibilities" defaultValue={roleSchedule.dutiesAndResponsibilities ?? ""} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Confidentiality / data protection clause<textarea className="input mt-1 min-h-24" name="confidentialityAndDataProtection" defaultValue={roleSchedule.confidentialityAndDataProtection ?? ""} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Equipment / system access note<textarea className="input mt-1 min-h-24" name="equipmentAndSystemAccess" defaultValue={roleSchedule.equipmentAndSystemAccess ?? ""} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Special conditions<textarea className="input mt-1 min-h-24" name="specialConditions" defaultValue={roleSchedule.specialConditions ?? offer?.specialConditions ?? ""} /></label>
                  <label className="text-sm font-semibold md:col-span-2">Employment agreement text<textarea className="input mt-1 min-h-48" name="agreementText" defaultValue={agreement?.agreementText ?? ""} required /></label>
                </div>
                <div className="flex flex-wrap gap-2"><button className="btn btn-secondary" name="action" value="draft">Save Stage 5 draft</button><button className="btn btn-primary" name="action" value="release" disabled={offer?.status !== "Accepted"}>Release to candidate</button></div>
              </form>
            ) : <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Stage 5 is {stageFive?.status}; agreement editing is closed.</p>}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Released agreement summary</h3><p className="mt-2 text-sm">{agreement ? `${agreement.title} · v${agreement.version} · ${agreement.status}` : "No agreement draft yet."}</p><p className="mt-1 text-xs text-slate-500">Released: {formatDateTime(agreement?.releasedAt)} · By: {agreement?.releasedByAdminEmail ?? "—"}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Candidate submission and signature</h3>{stageFiveSubmission ? <div className="mt-2 text-sm"><p>Submitted: {formatDateTime(stageFiveSubmission.submittedAt)}</p><p>Version: {stageFiveSubmission.version}</p><p>Signature: {stageFiveSignature?.confirmed ? "Confirmed" : "Missing"} · Signed: {formatDateTime(stageFiveSignature?.signedAt)}</p></div> : <p className="mt-2 text-sm text-slate-600">No Stage 5 submission found.</p>}</div>
            </div>
            <h3 className="mt-5 font-semibold">Stage 5 admin actions</h3>
            <StageActionForm action={adminStage5Action} applicationId={application.id} stage="Stage 5" />
          </section>
        ) : null}

        <section className="card mt-6 border border-red-200 bg-red-50 p-5">
          <h2 className="font-bold text-red-800">Danger zone</h2>
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
                <button className="btn btn-secondary">
                  Restore application
                </button>
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
            <form
              action={softDeleteApplicationAction}
              className="mt-4 space-y-3"
            >
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

        <details className="card mt-6 p-5">
          <summary className="cursor-pointer font-bold">Email history</summary>
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
        </details>

        <details className="card mt-6 p-5">
          <summary className="cursor-pointer font-bold">Audit logs</summary>
          {application.auditLogs.length > 0 ? (
            application.auditLogs.map((log: AuditLog) => (
              <p key={log.id}>
                {formatDateTime(log.createdAt)} · {log.actorType} · {log.action}
              </p>
            ))
          ) : (
            <p>No audit logs found.</p>
          )}
        </details>
      </div>
    </main>
  );
}
