import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageShell } from "@/components/PageShell";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import {
  parseStage3Metadata,
  stages as stageDefs,
  toStageStatus,
  type StageStatus,
} from "@/lib/hiring";
import { submitOfferDecision, submitStage2, submitStage3 } from "../actions";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";

type PortalApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    offer: true;
    stages: {
      include: {
        submissions: {
          include: {
            signature: true;
          };
        };
      };
    };
  };
}>;

type PortalStage = PortalApplication["stages"][number];

function isComplete(status: StageStatus) {
  return status === "Approved" || status === "Completed";
}

function isCandidateActionable(status: StageStatus) {
  return ["Available", "In Progress", "Correction Requested"].includes(status);
}

function isSelectable(status: StageStatus) {
  return [
    "Available",
    "In Progress",
    "Correction Requested",
    "Submitted",
    "Under Review",
    "Approved",
    "Completed",
    "Rejected",
  ].includes(status);
}

function stageCardActionLabel(status: StageStatus, selected: boolean) {
  if (selected) return "Selected";
  if (isCandidateActionable(status))
    return status === "Available" ? "Open form" : "Continue";
  if (status === "Submitted" || status === "Under Review")
    return "Under review";
  if (isComplete(status)) return "Completed";
  return "Locked";
}

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(value)
    : "Not available";
}

export default async function Portal({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; stage?: string }>;
}) {
  const { session, stage: stageParam } = await searchParams;
  const access = session
    ? await prisma.applicationAccessCode.findFirst({
        where: {
          verifiedSessionTokenHash: sha256(session),
          sessionExpiresAt: { gt: new Date() },
          application: { deletedAt: null },
        },
        include: {
          application: {
            include: {
              applicant: true,
              offer: true,
              stages: {
                orderBy: { stageOrder: "asc" },
                include: { submissions: { include: { signature: true } } },
              },
            },
          },
        },
      })
    : null;

  if (!access) {
    return (
      <PageShell>
        <Section eyebrow="Candidate portal" title="Session expired">
          <div className="card max-w-2xl p-5 sm:p-6">
            <h2 className="text-xl font-bold text-ink">
              Open your portal again
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your secure session has expired. Request a new passcode to
              continue.
            </p>
            <Link className="btn btn-primary mt-5" href="/track">
              Request passcode
            </Link>
          </div>
        </Section>
      </PageShell>
    );
  }

  const application = access.application;
  const portalStages = stageDefs.map((definition) => {
    const stage = application.stages.find(
      (candidateStage: PortalStage) =>
        candidateStage.stageKey === definition.key,
    );
    const status = toStageStatus(stage?.status);

    return {
      ...definition,
      stage,
      status,
      isCurrent: definition.order === application.currentStageOrder,
    };
  });

  const completedStageCount = portalStages.filter((stage) =>
    isComplete(stage.status),
  ).length;
  const progressPercent = Math.round(
    (completedStageCount / stageDefs.length) * 100,
  );
  const currentStage =
    portalStages.find((stage) => stage.isCurrent) ?? portalStages[0];
  const requestedStageOrder = Number(stageParam);
  const requestedStage = Number.isInteger(requestedStageOrder)
    ? portalStages.find((stage) => stage.order === requestedStageOrder)
    : undefined;
  const bestNextActionableStage = portalStages.find((stage) =>
    isCandidateActionable(stage.status),
  );
  const defaultSelectedStage =
    bestNextActionableStage ??
    (currentStage && isSelectable(currentStage.status)
      ? currentStage
      : portalStages[0]);
  const selectedStage =
    requestedStage && isSelectable(requestedStage.status)
      ? requestedStage
      : defaultSelectedStage;
  const selectedStageStatus = selectedStage?.status ?? "Locked";
  const selectedStageIsLocked =
    !selectedStage || !isSelectable(selectedStage.status);
  const offer = application.offer;
  const offerExpired = Boolean(
    offer?.offerExpiryDate &&
    offer.offerExpiryDate.getTime() < Date.now() &&
    offer.status === "Released",
  );
  const stage3Metadata = parseStage3Metadata(portalStages[2]?.stage?.metadata);
  const showOfferDecision = Boolean(
    offer &&
    offer.status === "Released" &&
    !offerExpired &&
    selectedStage?.order === 4,
  );
  const stageOneSignature = portalStages[0]?.stage?.submissions[0]?.signature;

  return (
    <PageShell>
      <Section eyebrow="Candidate portal" title="Track your application">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
          <section
            className="card overflow-hidden p-0 lg:col-start-1 lg:row-start-1"
            aria-labelledby="portal-overview-title"
          >
            <div className="border-b border-slate-100 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                    Application ID
                  </p>
                  <h2
                    id="portal-overview-title"
                    className="mt-2 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl"
                  >
                    {application.applicationId}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {application.applicant.fullName} ·{" "}
                    {application.roleAppliedFor}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Current step
                </p>
                <p className="mt-2 text-base font-bold text-ink">
                  {currentStage?.title ?? "Not available"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Progress
                </p>
                <p className="mt-2 text-base font-bold text-ink">
                  {completedStageCount} of {stageDefs.length} completed
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Last signed
                </p>
                <p className="mt-2 text-base font-bold text-ink">
                  {formatDate(stageOneSignature?.signedAt)}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                aria-label={`${progressPercent}% complete`}
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </section>

          <aside
            className="card p-5 sm:p-6 lg:col-start-2 lg:row-span-3 lg:row-start-1"
            aria-labelledby="portal-progress-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Progress
                </p>
                <h2
                  id="portal-progress-title"
                  className="mt-2 text-xl font-bold tracking-tight text-ink"
                >
                  Application progress
                </h2>
              </div>
              <p className="text-sm font-bold text-slate-700">
                {progressPercent}%
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {portalStages.map((definition) => {
                const selected = selectedStage?.order === definition.order;
                const selectable = isSelectable(definition.status);
                const href = session
                  ? `/track/portal?session=${encodeURIComponent(session)}&stage=${definition.order}`
                  : `/track/portal?stage=${definition.order}`;
                const cardClassName = `flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                  selected
                    ? "border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20"
                    : selectable
                      ? "border-slate-200 bg-white hover:border-brand/60 hover:bg-slate-50"
                      : "border-slate-100 bg-slate-50 opacity-75"
                }`;
                const content = (
                  <>
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isComplete(definition.status)
                          ? "bg-emerald-600 text-white"
                          : definition.isCurrent
                            ? "bg-brand text-white"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {definition.order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-ink">
                          {definition.title}
                        </p>
                        {definition.isCurrent ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {definition.status}
                      </p>
                      <p
                        className={`mt-2 text-xs font-bold ${selected ? "text-brand" : selectable ? "text-slate-600" : "text-slate-400"}`}
                      >
                        {stageCardActionLabel(definition.status, selected)}
                      </p>
                    </div>
                  </>
                );

                return selectable ? (
                  <Link
                    className={cardClassName}
                    href={href}
                    key={definition.key}
                    aria-current={selected ? "step" : undefined}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={cardClassName}
                    key={definition.key}
                    aria-disabled="true"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </aside>

          <section
            className="card p-5 sm:p-6 lg:col-start-1 lg:row-start-2"
            aria-labelledby="selected-stage-title"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Stage workspace
                </p>
                <h2
                  id="selected-stage-title"
                  className="mt-2 text-2xl font-bold tracking-tight text-ink"
                >
                  Stage {selectedStage?.order ?? currentStage?.order}:{" "}
                  {selectedStage?.title ??
                    currentStage?.title ??
                    "Application stage"}
                </h2>
              </div>
              <StatusBadge status={selectedStageStatus} />
            </div>

            {selectedStage?.order === 1 ? (
              selectedStageStatus === "Under Review" ||
              selectedStageStatus === "Submitted" ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Your initial application is under review. The next step will
                  appear here after admin approval.
                </p>
              ) : selectedStageStatus === "Approved" ||
                selectedStageStatus === "Completed" ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Initial application completed. Select the next available stage
                  to continue.
                </p>
              ) : selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 1 is not available yet.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Complete your initial application from the application page.
                </p>
              )
            ) : selectedStage?.order === 2 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 2 unlocks after Stage 1 approval.
                </p>
              ) : ["Available", "In Progress", "Correction Requested"].includes(
                  selectedStageStatus,
                ) ? (
                <form
                  action={submitStage2}
                  className="mt-6 space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
                >
                  <input type="hidden" name="session" value={session ?? ""} />
                  <h3 className="text-lg font-bold text-ink">
                    Candidate Information / Identity Verification
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Full legal name
                      <input
                        className="input mt-1"
                        name="fullLegalName"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Date of birth
                      <input
                        className="input mt-1"
                        name="dateOfBirth"
                        type="date"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Gender
                      <select className="input mt-1" name="gender" required>
                        <option value="">Select</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Prefer not to say</option>
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Nationality
                      <input
                        className="input mt-1"
                        name="nationality"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      State of origin
                      <input
                        className="input mt-1"
                        name="stateOfOrigin"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      State of residence
                      <input
                        className="input mt-1"
                        name="stateOfResidence"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      LGA
                      <input className="input mt-1" name="lga" required />
                    </label>
                    <label className="block text-sm font-semibold">
                      Current city/location
                      <input
                        className="input mt-1"
                        name="currentCity"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold md:col-span-2">
                      Residential address
                      <textarea
                        className="input mt-1 min-h-24"
                        name="residentialAddress"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Phone number
                      <input
                        className="input mt-1"
                        name="phoneNumber"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Email
                      <input
                        className="input mt-1"
                        name="email"
                        type="email"
                        required
                        defaultValue={application.applicant.email}
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      ID type
                      <select className="input mt-1" name="idType" required>
                        <option value="">Select</option>
                        <option>National Identification Number / NIN</option>
                        <option>International Passport</option>
                        <option>Driver’s Licence</option>
                        <option>Voter’s Card</option>
                        <option>Other Government-issued ID</option>
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      ID number
                      <input className="input mt-1" name="idNumber" required />
                    </label>
                    <label className="block text-sm font-semibold">
                      Issuing authority
                      <input className="input mt-1" name="idIssuingAuthority" />
                    </label>
                    <label className="block text-sm font-semibold">
                      Issue date
                      <input
                        className="input mt-1"
                        name="idIssueDate"
                        type="date"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Expiry date
                      <input
                        className="input mt-1"
                        name="idExpiryDate"
                        type="date"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      NIN if separate
                      <input className="input mt-1" name="nin" />
                    </label>
                    <label className="block text-sm font-semibold">
                      Tax ID optional
                      <input className="input mt-1" name="taxId" />
                    </label>
                    <label className="block text-sm font-semibold">
                      Government ID document upload
                      <input
                        className="input mt-1"
                        name="governmentIdDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Passport/profile photo upload
                      <input
                        className="input mt-1"
                        name="passportPhoto"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold md:col-span-2">
                      Additional support optional
                      <input
                        className="input mt-1"
                        name="additionalIdentityDocument"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Emergency contact name
                      <input
                        className="input mt-1"
                        name="emergencyContactName"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Emergency contact relationship
                      <input
                        className="input mt-1"
                        name="emergencyContactRelationship"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Emergency contact phone
                      <input
                        className="input mt-1"
                        name="emergencyContactPhone"
                        required
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Emergency contact address
                      <input
                        className="input mt-1"
                        name="emergencyContactAddress"
                      />
                    </label>
                  </div>
                  <label className="flex gap-2 text-sm font-semibold">
                    <input
                      name="declarationAccuracy"
                      type="checkbox"
                      required
                    />{" "}
                    I declare the information provided is accurate.
                  </label>
                  <label className="flex gap-2 text-sm font-semibold">
                    <input
                      name="identityProcessingConsent"
                      type="checkbox"
                      required
                    />{" "}
                    I consent to identity verification processing.
                  </label>
                  <label className="block text-sm font-semibold">
                    Typed electronic signature
                    <input
                      className="input mt-1"
                      name="signatureName"
                      required
                    />
                  </label>
                  <label className="flex gap-2 text-sm font-semibold">
                    <input name="signatureConsent" type="checkbox" required /> I
                    confirm this electronic signature.
                  </label>
                  <button className="btn btn-primary" type="submit">
                    Submit Stage 2
                  </button>
                </form>
              ) : selectedStageStatus === "Submitted" ||
                selectedStageStatus === "Under Review" ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Stage 2 submitted and under review.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 2 is {selectedStageStatus}.
                </p>
              )
            ) : selectedStage?.order === 3 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 3 unlocks after Stage 2 approval.
                </p>
              ) : selectedStageStatus === "Submitted" ||
                selectedStageStatus === "Under Review" ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Stage 3 submitted and under review.
                </p>
              ) : !stage3Metadata.releasedAt ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Screening details will be shared by the admin.
                </p>
              ) : ["Available", "In Progress", "Correction Requested"].includes(
                  selectedStageStatus,
                ) ? (
                <form
                  action={submitStage3}
                  className="mt-6 space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
                >
                  <input type="hidden" name="session" value={session ?? ""} />
                  <h3 className="text-lg font-bold text-ink">
                    {stage3Metadata.title ??
                      "Screening / Interview / Assessment"}
                  </h3>
                  <div className="space-y-2 text-sm leading-6 text-slate-700">
                    <p className="whitespace-pre-wrap">
                      <strong>Instructions:</strong>{" "}
                      {stage3Metadata.instructions}
                    </p>
                    <p>
                      <strong>Interview mode:</strong>{" "}
                      {stage3Metadata.interviewMode ?? "Not specified"}
                    </p>
                    {stage3Metadata.meetingLink ? (
                      <p>
                        <strong>Meeting link:</strong>{" "}
                        {stage3Metadata.meetingLink}
                      </p>
                    ) : null}
                    {stage3Metadata.location ? (
                      <p>
                        <strong>Location:</strong> {stage3Metadata.location}
                      </p>
                    ) : null}
                    {stage3Metadata.scheduledAt ? (
                      <p>
                        <strong>Scheduled date/time:</strong>{" "}
                        {stage3Metadata.scheduledAt}
                      </p>
                    ) : null}
                    {stage3Metadata.deadlineAt ? (
                      <p>
                        <strong>Deadline:</strong> {stage3Metadata.deadlineAt}
                      </p>
                    ) : null}
                  </div>
                  <label className="block text-sm font-semibold">
                    Candidate availability/confirmation input
                    <input
                      className="input mt-1"
                      name="availability"
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Response message
                    <textarea
                      className="input mt-1 min-h-28"
                      name="responseMessage"
                    />
                  </label>
                  {stage3Metadata.requiresUpload ? (
                    <label className="block text-sm font-semibold">
                      Assessment upload
                      <input
                        className="input mt-1"
                        name="assessmentFile"
                        type="file"
                        required
                      />
                    </label>
                  ) : null}
                  <label className="flex gap-2 text-sm font-semibold">
                    <input
                      name="declarationAccuracy"
                      type="checkbox"
                      required
                    />{" "}
                    I declare this response is accurate.
                  </label>
                  <button className="btn btn-primary" type="submit">
                    Submit Stage 3
                  </button>
                </form>
              ) : selectedStageStatus === "Submitted" ||
                selectedStageStatus === "Under Review" ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Stage 3 submitted and under review.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 3 is {selectedStageStatus}.
                </p>
              )
            ) : selectedStage?.order === 4 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Offer stage unlocks after screening approval.
                </p>
              ) : offer?.status === "Accepted" ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Offer accepted. Stage 5 is available when the employment
                  agreement is released.
                </p>
              ) : offer?.status === "Declined" ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  Offer declined. Stage 5 does not unlock after a declined
                  offer.
                </p>
              ) : offer?.status === "Withdrawn" ||
                offer?.status === "Expired" ||
                offerExpired ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  This offer is closed and no decision can be submitted.
                </p>
              ) : showOfferDecision ? (
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <h3 className="text-lg font-bold text-ink">
                      Offer details
                    </h3>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <p>
                        <strong>Role offered:</strong> {offer?.roleOffered}
                      </p>
                      <p>
                        <strong>Salary/compensation:</strong> {offer?.salary}
                      </p>
                      <p>
                        <strong>Start date:</strong>{" "}
                        {formatDate(offer?.startDate)}
                      </p>
                      <p>
                        <strong>Work mode:</strong> {offer?.workMode}
                      </p>
                      <p>
                        <strong>Reporting manager:</strong>{" "}
                        {offer?.reportingManager ?? "—"}
                      </p>
                      <p>
                        <strong>Probation period:</strong>{" "}
                        {offer?.probationPeriod ?? "—"}
                      </p>
                      <p>
                        <strong>Offer expiry:</strong>{" "}
                        {formatDate(offer?.offerExpiryDate)}
                      </p>
                      {offer?.specialConditions ? (
                        <p className="whitespace-pre-wrap rounded-xl bg-white p-3">
                          <strong>Special conditions:</strong>{" "}
                          {offer.specialConditions}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <form
                    action={submitOfferDecision}
                    className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5"
                  >
                    <input type="hidden" name="session" value={session ?? ""} />
                    <h3 className="font-bold text-ink">Your decision</h3>
                    <label className="block text-sm font-semibold">
                      Optional decision note
                      <textarea
                        className="input mt-1 min-h-24"
                        name="candidateDecisionNote"
                      />
                    </label>
                    <label className="flex gap-2 text-sm font-semibold">
                      <input name="confirmation" type="checkbox" required /> I
                      confirm my selected offer decision.
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="btn btn-primary"
                        name="decision"
                        value="accept"
                        type="submit"
                      >
                        Accept Offer
                      </button>
                      <button
                        className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700"
                        name="decision"
                        value="decline"
                        type="submit"
                      >
                        Decline Offer
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Submitting...</p>
                  </form>
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Offer details will appear here when released by admin.
                </p>
              )
            ) : selectedStage?.order === 5 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Employment agreement stage is locked until the offer is
                  accepted.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Employment agreement stage is now available. The agreement
                  form will appear here when released.
                </p>
              )
            ) : (
              <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                This stage is available in your application tracker. Follow any
                instructions from the hiring team to continue.
              </p>
            )}
          </section>
        </div>
      </Section>
    </PageShell>
  );
}
