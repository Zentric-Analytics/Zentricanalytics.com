import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageShell } from "@/components/PageShell";
import { Section } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import {
  isOfferExpired,
  stages as stageDefs,
  toStageStatus,
  type StageStatus,
} from "@/lib/hiring";
import { submitOfferDecision } from "../actions";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";

type PortalApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    stages: {
      include: {
        submissions: {
          include: {
            signature: true;
          };
        };
      };
    };
    offer: true;
  };
}>;

type PortalStage = PortalApplication["stages"][number];

function isComplete(status: StageStatus) {
  return status === "Approved" || status === "Completed";
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

function stageNote(status: StageStatus, fallback: string) {
  if (status === "Locked") return "Not released yet.";
  if (status === "Available") return fallback;
  if (status === "In Progress") return "Action is in progress.";
  if (status === "Submitted") return "Submitted. Review is pending.";
  if (status === "Under Review")
    return "Zentric Analytics is reviewing this step.";
  if (status === "Approved")
    return "Approved. You can continue when the next step is released.";
  if (status === "Completed") return "Completed.";
  if (status === "Correction Requested")
    return "Update requested. Please follow the instruction sent to you.";
  if (status === "Rejected") return "This step was not accepted.";
  return fallback;
}

export default async function Portal({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
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
              stages: {
                orderBy: { stageOrder: "asc" },
                include: { submissions: { include: { signature: true } } },
              },
              offer: true,
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
  const stageFourStatus = portalStages[3]?.status ?? "Locked";
  const stageFiveStatus = portalStages[4]?.status ?? "Locked";
  const stageOneSignature = portalStages[0]?.stage?.submissions[0]?.signature;
  const offer = application.offer;
  const offerExpired = isOfferExpired(offer);

  return (
    <PageShell>
      <Section eyebrow="Candidate portal" title="Track your application">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
          <section
            className="card overflow-hidden p-0"
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
            className="card p-5 sm:p-6"
            aria-labelledby="portal-progress-title"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:flex-col">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Progress
                </p>
                <h2
                  id="portal-progress-title"
                  className="mt-2 text-xl font-bold text-ink"
                >
                  Application progress
                </h2>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-ink">
                {completedStageCount} of {stageDefs.length} completed
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Current step
              </p>
              <p className="mt-2 text-base font-bold text-ink">
                {currentStage?.title ?? "Not available"}
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                <span>Overall progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                aria-label={`${progressPercent}% complete`}
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {portalStages.map((definition) => {
                const stageClass = definition.isCurrent
                  ? "border-brand bg-brand/5 shadow-sm"
                  : isComplete(definition.status)
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-white";

                return (
                  <article
                    className={`rounded-2xl border p-3 ${stageClass}`}
                    key={definition.key}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${definition.isCurrent ? "bg-brand text-white" : "bg-ink text-white"}`}
                      >
                        {definition.order}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between lg:flex-col xl:flex-row">
                          <h3 className="break-words text-sm font-bold leading-5 text-ink">
                            {definition.title}
                          </h3>
                          {definition.isCurrent ? (
                            <span className="w-fit rounded-full bg-brand px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={definition.status} />
                          {definition.stage?.approvedAt ? (
                            <span className="text-xs font-semibold text-emerald-700">
                              Approved {formatDate(definition.stage.approvedAt)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {stageNote(
                            definition.status,
                            definition.applicantAction,
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="stage4-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Stage 4
                </p>
                <h2
                  id="stage4-title"
                  className="mt-2 text-2xl font-bold tracking-tight text-ink"
                >
                  Offer Stage
                </h2>
              </div>
              <StatusBadge status={stageFourStatus} />
            </div>

            {stageFourStatus === "Locked" ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Offer stage unlocks after screening approval.
              </p>
            ) : !offer || offer.status === "Draft" ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Offer details will appear here when released by admin.
              </p>
            ) : offer.status === "Accepted" ? (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Offer accepted. Employment agreement stage is now available.
              </p>
            ) : offer.status === "Declined" ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                Offer declined.
              </p>
            ) : offer.status === "Withdrawn" ||
              offerExpired ||
              offer.status === "Expired" ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                This offer is no longer open for decision.
              </p>
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <h3 className="text-lg font-bold text-ink">Offer details</h3>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    <p>
                      <strong>Role offered:</strong> {offer.roleOffered}
                    </p>
                    <p>
                      <strong>Salary/compensation:</strong> {offer.salary}
                    </p>
                    <p>
                      <strong>Start date:</strong> {formatDate(offer.startDate)}
                    </p>
                    <p>
                      <strong>Work mode:</strong> {offer.workMode}
                    </p>
                    <p>
                      <strong>Reporting manager:</strong>{" "}
                      {offer.reportingManager ?? "—"}
                    </p>
                    <p>
                      <strong>Probation period:</strong>{" "}
                      {offer.probationPeriod ?? "—"}
                    </p>
                    <p>
                      <strong>Offer expiry:</strong>{" "}
                      {formatDate(offer.offerExpiryDate)}
                    </p>
                    {offer.specialConditions ? (
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
                    <input name="confirmation" type="checkbox" required />I
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
            )}

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Stage 5 status:{" "}
              {stageFiveStatus === "Available"
                ? "Available — employment agreement stage is now available."
                : stageFiveStatus}
            </p>
          </div>
        </section>
      </Section>
    </PageShell>
  );
}
