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
  stage2IdTypeOptions,
  parseStage5RoleSchedule,
} from "@/lib/hiring";
import { submitOfferDecision, submitStage2, submitStage3, submitStage5, submitStage6, submitStage7 } from "../actions";
// Backward-compatible source check: import { submitOfferDecision, submitStage2, submitStage3 }
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { countryPhoneOptions } from "@/lib/phone";

type PortalApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    offer: true;
    employmentAgreement: true;
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

function isActionableStageStatus(status: StageStatus) {
  return (
    status === "Available" ||
    status === "In Progress" ||
    status === "Correction Requested"
  );
}

function isReviewStageStatus(status: StageStatus) {
  return status === "Submitted" || status === "Under Review";
}

function isCompletedStageStatus(status: StageStatus) {
  return status === "Approved" || status === "Completed";
}

function isRejectedStageStatus(status: StageStatus) {
  return status === "Rejected";
}

function isComplete(status: StageStatus) {
  return isCompletedStageStatus(status);
}

function isCandidateActionable(status: StageStatus) {
  return isActionableStageStatus(status);
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
  if (isReviewStageStatus(status)) return "Under review";
  if (isCompletedStageStatus(status)) return "Completed";
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
              employmentAgreement: true,
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
  // Backward-compatible selection path: requestedStage && isSelectable(requestedStage.status)
  const selectedStage =
    requestedStage && (isSelectable(requestedStage.status) || requestedStage.order === 8)
      ? requestedStage
      : defaultSelectedStage;
  const selectedStageStatus = selectedStage?.status ?? "Locked";
  const selectedStageIsLocked =
    !selectedStage || !isSelectable(selectedStage.status);
  const selectedStageIsActionable =
    isActionableStageStatus(selectedStageStatus);
  const selectedStageIsReview = isReviewStageStatus(selectedStageStatus);
  const selectedStageIsComplete = isCompletedStageStatus(selectedStageStatus);
  const selectedStageIsRejected = isRejectedStageStatus(selectedStageStatus);
  const offer = application.offer;
  const agreement = application.employmentAgreement;
  const roleSchedule = parseStage5RoleSchedule(agreement?.roleSchedule);
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
              selectedStageIsReview ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Your initial application is under review. The next step will
                  appear here after admin approval.
                </p>
              ) : selectedStageIsComplete ? (
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
              ) : selectedStageIsActionable ? (
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
                    <div className="block text-sm font-semibold md:col-span-2">
                      <span>Applicant phone</span>
                      <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                        <select
                          className="input"
                          name="applicantPhoneCountryIso"
                          aria-label="Applicant phone country"
                          required
                          defaultValue="NG"
                        >
                          {countryPhoneOptions.map((country) => (
                            <option key={country.iso} value={country.iso}>
                              {country.name} {country.dialCode}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          name="applicantPhoneNational"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-label="Applicant national phone number"
                          required
                        />
                      </div>
                    </div>
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
                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                      <div className="mb-4">
                        <h4 className="font-bold text-ink">
                          Primary ID{" "}
                          <span className="text-red-600">required</span>
                        </h4>
                        <p className="mt-1 text-sm font-normal text-slate-600">
                          Only your Primary ID is required. Add a Secondary ID
                          only if you choose to provide one.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-semibold">
                          Primary ID type
                          <select
                            className="input mt-1"
                            name="primaryIdType"
                            required
                          >
                            <option value="">Select</option>
                            {stage2IdTypeOptions.map((type) => (
                              <option key={type}>{type}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold">
                          Primary ID number
                          <input
                            className="input mt-1"
                            name="primaryIdNumber"
                            required
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Issuing authority
                          <input
                            className="input mt-1"
                            name="primaryIdIssuingAuthority"
                            required
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Issue date{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="primaryIdIssueDate"
                            type="date"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Expiry date{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="primaryIdExpiryDate"
                            type="date"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Primary ID document upload
                          <input
                            className="input mt-1"
                            name="primaryIdDocument"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            required
                          />
                        </label>
                      </div>
                    </section>
                    <section className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
                      <h4 className="font-bold text-ink">
                        Secondary ID{" "}
                        <span className="font-normal text-slate-500">
                          optional
                        </span>
                      </h4>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-semibold">
                          Secondary ID type{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <select className="input mt-1" name="secondaryIdType">
                            <option value="">Not provided</option>
                            {stage2IdTypeOptions.map((type) => (
                              <option key={type}>{type}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold">
                          Secondary ID number{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="secondaryIdNumber"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Secondary issuing authority{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="secondaryIdIssuingAuthority"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Secondary issue date{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="secondaryIdIssueDate"
                            type="date"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Secondary expiry date{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="secondaryIdExpiryDate"
                            type="date"
                          />
                        </label>
                        <label className="block text-sm font-semibold">
                          Secondary ID document upload{" "}
                          <span className="font-normal text-slate-500">
                            optional
                          </span>
                          <input
                            className="input mt-1"
                            name="secondaryIdDocument"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                          />
                        </label>
                      </div>
                    </section>
                    <label className="block text-sm font-semibold md:col-span-2">
                      Passport/profile photo, optional
                      <input
                        className="input mt-1"
                        name="passportPhoto"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
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
                    <div className="block text-sm font-semibold md:col-span-2">
                      <span>Emergency contact phone</span>
                      <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                        <select
                          className="input"
                          name="emergencyContactPhoneCountryIso"
                          aria-label="Emergency contact phone country"
                          required
                          defaultValue="NG"
                        >
                          {countryPhoneOptions.map((country) => (
                            <option key={country.iso} value={country.iso}>
                              {country.name} {country.dialCode}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          name="emergencyContactPhoneNational"
                          inputMode="tel"
                          autoComplete="tel"
                          aria-label="Emergency contact national phone number"
                          required
                        />
                      </div>
                    </div>
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
              ) : selectedStageIsActionable ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Stage 2 details will be shared by the admin.
                </p>
              ) : selectedStageIsReview ? (
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
              ) : selectedStageIsActionable && stage3Metadata.releasedAt ? (
                <form
                  action={submitStage3}
                  className="mt-6 space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
                >
                  <input type="hidden" name="session" value={session ?? ""} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                      Stage 3 workspace
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-ink">
                      {stage3Metadata.title ??
                        "Screening / Interview / Assessment"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Screening type:{" "}
                      {stage3Metadata.screeningType ?? "Screening"}
                    </p>
                  </div>
                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <p className="whitespace-pre-wrap">
                      <strong>Candidate instructions:</strong>{" "}
                      {stage3Metadata.instructions}
                    </p>
                    <p>
                      <strong>Interview mode:</strong>{" "}
                      {stage3Metadata.interviewMode ?? "Not specified"}
                    </p>
                    {stage3Metadata.meetingLink ? (
                      <p>
                        <strong>Meeting link:</strong>{" "}
                        <a
                          className="text-brand underline"
                          href={stage3Metadata.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {stage3Metadata.meetingLink}
                        </a>
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
                    {stage3Metadata.requiresUpload ? (
                      <p>
                        <strong>Upload instructions:</strong>{" "}
                        {stage3Metadata.allowedUploadNote ??
                          "Upload the requested assessment file before submitting."}
                      </p>
                    ) : null}
                  </div>
                  <label className="block text-sm font-semibold">
                    Availability / confirmation{" "}
                    {stage3Metadata.requiresCandidateResponse ? (
                      <span className="text-red-600">(required)</span>
                    ) : (
                      <span className="text-slate-500">(optional)</span>
                    )}
                    <input
                      className="input mt-1"
                      name="availability"
                      required={Boolean(
                        stage3Metadata.requiresCandidateResponse,
                      )}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Response message{" "}
                    <span className="text-slate-500">(optional)</span>
                    <textarea
                      className="input mt-1 min-h-28"
                      name="responseMessage"
                    />
                  </label>
                  {stage3Metadata.requiresUpload ? (
                    <label className="block text-sm font-semibold">
                      Assessment upload{" "}
                      <span className="text-red-600">(required)</span>
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
              ) : selectedStageIsActionable ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  Screening details will be shared by the admin.
                </p>
              ) : selectedStageIsReview ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Stage 3 submitted and under review.
                </p>
              ) : selectedStageIsComplete ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  Stage 3 is complete and approved.
                </p>
              ) : selectedStageIsRejected ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                  Stage 3 was rejected.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  Stage 3 is locked.
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
                  Employment agreement unlocks after offer acceptance.
                </p>
              ) : selectedStageIsReview ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Stage 5 submitted and under review.</p>
              ) : selectedStageIsComplete ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Employment agreement completed. Continue to the next available stage.</p>
              ) : selectedStageIsRejected ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Stage 5 was not approved and further action depends on Zentric Analytics LTD.</p>
              ) : !agreement || !["Released", "Submitted"].includes(agreement.status) ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Your employment agreement is being prepared. You will be notified when it is ready. Employment agreement stage is now available.</p>
              ) : (
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <article className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div><h3 className="text-lg font-bold text-ink">{agreement.title}</h3><p className="text-sm text-slate-600">Version {agreement.version} · Released {formatDate(agreement.releasedAt)}</p></div>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      {[ ["Role offered", roleSchedule.roleOffered], ["Department/team", roleSchedule.departmentTeam], ["Reporting manager", roleSchedule.reportingManager], ["Start date", roleSchedule.startDate], ["Work mode", roleSchedule.workMode], ["Compensation/salary", roleSchedule.compensationSalary], ["Probation period", roleSchedule.probationPeriod], ["Working hours/schedule", roleSchedule.workingHours], ["Duties and responsibilities", roleSchedule.dutiesAndResponsibilities], ["Confidentiality/data protection", roleSchedule.confidentialityAndDataProtection], ["Equipment/system access", roleSchedule.equipmentAndSystemAccess], ["Special conditions", roleSchedule.specialConditions], ["Agreement expiry date", roleSchedule.agreementExpiryDate] ].map(([label, value]) => value ? <p className="whitespace-pre-wrap" key={label as string}><strong>{label as string}:</strong> {String(value)}</p> : null)}
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700"><h4 className="font-bold text-ink">Employment agreement text</h4><p className="mt-2 whitespace-pre-wrap">{agreement.agreementText}</p></div>
                  </article>
                  <form action={submitStage5} className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <input type="hidden" name="session" value={session ?? ""} />
                    {selectedStageStatus === "Correction Requested" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Correction requested. Please review and resubmit Stage 5.</p> : null}
                    {[ ["agreementRead", "I have read the employment agreement and role schedule."], ["understanding", "I understand this agreement forms part of the employment process with Zentric Analytics LTD."], ["onboardingStillRequired", "I understand that employment remains subject to completion of required onboarding, policy acknowledgements, and final HR approval."], ["accuracy", "I confirm the information I submit is accurate to the best of my knowledge."], ["electronicSignatureConsent", "I consent to sign electronically."] ].map(([name, label]) => <label className="flex gap-2 text-sm font-semibold" key={name}><input name={name} type="checkbox" required /> {label}</label>)}
                    <label className="block text-sm font-semibold">Type full legal name as electronic signature<input className="input mt-1" name="signatureName" required /></label>
                    <button className="btn btn-primary" type="submit">Submit signed agreement</button>
                  </form>
                </div>
              )
            ) : selectedStage?.order === 6 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Onboarding unlocks after employment agreement approval.</p>
              ) : selectedStageIsReview ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Onboarding submitted and under HR review.</p>
              ) : selectedStageIsComplete ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Onboarding completed. Continue to the next available stage.</p>
              ) : selectedStageIsRejected ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Onboarding was not approved. Follow instructions from Zentric Analytics LTD.</p>
              ) : (
                <form action={submitStage6} className="mt-6 space-y-6 rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <input type="hidden" name="session" value={session ?? ""} />
                  {selectedStageStatus === "Correction Requested" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Correction requested. Please review HR notes and resubmit onboarding.</p> : null}
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">Final HR approval and policy acknowledgements are still required. Payroll/statutory details are collected only for employment administration and are not shown in public summaries.</p>
                  {[
                    ["Personal confirmation", [["fullLegalName","Full legal name", application.applicant.fullName, "text"],["preferredName","Preferred name", "", "text"],["dateOfBirth","Date of birth", "", "date"],["residentialAddress","Residential address", "", "textarea"],["currentCity","Current city", application.applicant.location ?? "", "text"],["stateOfResidence","State of residence", "", "text"],["nationality","Nationality", "", "text"],["phoneNumber","Phone number", application.applicant.phone ?? "", "tel"],["email","Email", application.applicant.email, "email"]]],
                    ["Employment readiness", [["confirmedStartDate","Confirmed start date", roleSchedule.startDate ?? "", "date"],["preferredStartDateNotes","Preferred start-date notes (optional)", "", "textarea"],["workModeReadiness","Work mode readiness", "", "textarea"],["equipmentNeeds","Equipment needs", "", "textarea"],["internetPowerReadiness","Internet/power readiness", "", "textarea"],["availabilityForOrientation","Availability for orientation", "", "textarea"],["emergencyStartConstraints","Emergency start constraints (optional)", "", "textarea"]]],
                    ["Next of kin / emergency contact", [["nextOfKinName","Next of kin name", "", "text"],["nextOfKinRelationship","Next of kin relationship", "", "text"],["nextOfKinPhone","Next of kin phone", "", "tel"],["nextOfKinEmail","Next of kin email (optional)", "", "email"],["nextOfKinAddress","Next of kin address (optional)", "", "textarea"],["emergencyContactName","Emergency contact name", "", "text"],["emergencyContactRelationship","Emergency contact relationship", "", "text"],["emergencyContactPhone","Emergency contact phone", "", "tel"],["emergencyContactAddress","Emergency contact address (optional)", "", "textarea"]]],
                    ["Payroll / statutory details", [["bankName","Bank name", "", "text"],["accountName","Account name", "", "text"],["accountNumber","Account number", "", "text"],["taxIdentificationNumber","Tax identification number (optional)", "", "text"],["pensionProvider","Pension provider (optional)", "", "text"],["pensionAccountNumber","Pension account number (optional)", "", "text"],["nationalIdentificationNumber","National identification number (optional)", "", "text"],["statutoryContributionNotes","Statutory contribution notes (optional)", "", "textarea"]]],
                  ].map(([title, fields]) => <section className="rounded-2xl border border-slate-200 p-4" key={title as string}><h3 className="font-bold text-ink">{title as string}</h3><div className="mt-4 grid gap-4 md:grid-cols-2">{(fields as string[][]).map(([name,label,defaultValue,type]) => <label className="block text-sm font-semibold" key={name}>{label}{type === "textarea" ? <textarea className="input mt-1 min-h-24" name={name} defaultValue={defaultValue} required={!label.includes("optional")} /> : <input className="input mt-1" name={name} type={type} defaultValue={defaultValue} required={!label.includes("optional")} />}</label>)}</div></section>)}
                  <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-ink">Uploads</h3><div className="mt-4 grid gap-4 md:grid-cols-3">{[["bankProof","Bank proof (optional)"],["statutoryDocument","Tax/statutory document (optional)"],["additionalDocument","Additional onboarding document (optional)"]].map(([name,label]) => <label className="block text-sm font-semibold" key={name}>{label}<input className="input mt-1" name={name} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" /></label>)}</div></section>
                  <section className="space-y-3 rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-ink">Declarations and e-signature</h3>{[["declarationAccuracy","I confirm the information is accurate."],["payrollProcessingConsent","I submit payroll/statutory details for HR onboarding purposes."],["employmentAdministrationConsent","I consent to Zentric Analytics LTD processing this information for employment administration."],["finalApprovalAcknowledgement","I understand onboarding remains subject to policy acknowledgements and final HR approval."],["changeNotificationAgreement","I agree to notify HR if onboarding information changes."],["electronicSignatureConsent","I consent to sign electronically."]].map(([name,label]) => <label className="flex gap-2 text-sm font-semibold" key={name}><input name={name} type="checkbox" required /> {label}</label>)}<label className="block text-sm font-semibold">Type full legal name as electronic signature<input className="input mt-1" name="signatureName" required /></label></section>
                  <button className="btn btn-primary" type="submit">Submit onboarding for HR review</button>
                </form>
              )
            ) : selectedStage?.order === 7 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Policy and access acknowledgements unlock after onboarding approval.</p>
              ) : selectedStageIsReview ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Your acknowledgements were submitted and are under HR review.</p>
              ) : selectedStageIsComplete ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Acknowledgements completed. Continue to the final HR approval stage when available.</p>
              ) : selectedStageIsRejected ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Acknowledgements were not approved. Follow instructions from Zentric Analytics LTD.</p>
              ) : (
                <form action={submitStage7} className="mt-6 space-y-6 rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <input type="hidden" name="session" value={session ?? ""} />
                  {selectedStageStatus === "Correction Requested" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Correction requested. Please review HR instructions and resubmit your acknowledgements.</p> : null}
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">Review each acknowledgement carefully. This stage is not final hiring completion; Stage 8 final HR approval is still required before the workflow is complete.</p>
                  {[
                    ["Data Privacy Acknowledgement", "privacyAcknowledgement", ["I understand Zentric Analytics LTD may process my personal information for employment administration, HR records, payroll/onboarding support, security, compliance, communication, and lawful business purposes.", "I will provide accurate information and update HR if information changes.", "I understand company records may be retained according to legal, HR, and business requirements."]],
                    ["Company Policy Acknowledgement", "policyAcknowledgement", ["I have reviewed and agree to follow company policies and procedures.", "I understand policies may be updated and I may be required to acknowledge updated versions.", "I understand policy violations may lead to disciplinary action, access restriction, or termination depending on severity and applicable law."]],
                    ["Confidentiality Acknowledgement", "confidentialityAcknowledgement", ["I will keep confidential all company, client, customer, partner, employee, candidate, financial, technical, operational, business, source-code, system, credential, provider, payment, and internal process information.", "I will not share confidential information with unauthorized persons.", "I will not copy, export, retrieve, or misuse company data except as authorized for assigned work.", "Confidentiality duties continue after employment or engagement ends where applicable."]],
                    ["System Access and Company Property Acknowledgement", "systemAccessAcknowledgement", ["Company system access, credentials, tokens, devices, documents, files, software, dashboards, internal tools, or property remain company-controlled.", "I will use access only for approved work purposes and will not share passwords, tokens, API keys, SSH keys, admin access, source code, customer/provider data, or internal documents.", "I will immediately report suspected compromise, lost devices, accidental disclosure, or unauthorized access and return or delete company property/data when requested."]],
                    ["Communication and Professional Conduct Acknowledgement", "communicationAcknowledgement", ["I will use approved communication channels professionally.", "I will not misrepresent Zentric Analytics LTD or contact clients, partners, vendors, or applicants outside authorized duties.", "I will maintain respectful and lawful conduct in workplace communications."]],
                  ].map(([title, name, items]) => <section className="rounded-2xl border border-slate-200 p-4" key={name as string}><h3 className="font-bold text-ink">{title as string}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul><label className="mt-4 flex gap-2 text-sm font-semibold"><input name={name as string} type="checkbox" required /> I acknowledge this section.</label></section>)}
                  <section className="space-y-3 rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-ink">Final Declaration and E-Signature</h3>{[["finalDeclaration","I have read and understood these acknowledgements, and my acknowledgements are truthful."],["finalHrApprovalUnderstanding","I understand this stage is not final hiring completion and Stage 8 final HR approval is still required."],["electronicSignatureConsent","I consent to sign electronically."]].map(([name,label]) => <label className="flex gap-2 text-sm font-semibold" key={name}><input name={name} type="checkbox" required /> {label}</label>)}<label className="block text-sm font-semibold">Optional note to HR<textarea className="input mt-1 min-h-20" name="candidateNote" maxLength={1000} /></label><label className="block text-sm font-semibold">Type full legal name as electronic signature<input className="input mt-1" name="signatureName" required /></label></section>
                  <button className="btn btn-primary" type="submit">Submit acknowledgements for HR review</button>
                </form>
              )
            ) : selectedStage?.order === 8 ? (
              selectedStageIsLocked ? (
                <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Final HR approval unlocks after policy and access acknowledgements are approved.</p>
              ) : selectedStageStatus === "Correction Requested" ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">A final HR review item needs attention. Follow safe instructions from Zentric Analytics LTD; private HR notes are not shown here.</p>
              ) : selectedStageIsComplete ? (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Final HR approval completed. Your hiring workflow is complete. HR will contact you with next operational steps.</p>
              ) : selectedStageIsRejected ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Final HR approval was not completed. Follow instructions from Zentric Analytics LTD.</p>
              ) : (
                <p className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">Your application is in final HR review. Zentric Analytics LTD is reviewing your completed employee file.</p>
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
