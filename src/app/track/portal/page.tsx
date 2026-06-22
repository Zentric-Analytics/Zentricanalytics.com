import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import {
  isStage1DownloadEligible,
  stages as stageDefs,
  toStageStatus,
  type StageStatus,
} from '@/lib/hiring';
import { Stage1DownloadButton } from './Stage1DownloadButton';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/security';

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
  };
}>;

type PortalStage = PortalApplication['stages'][number];

function isComplete(status: StageStatus) {
  return status === 'Approved' || status === 'Completed';
}

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(value)
    : 'Not available';
}

function stageNote(status: StageStatus, fallback: string) {
  if (status === 'Locked') return 'Not released yet.';
  if (status === 'Available') return fallback;
  if (status === 'In Progress') return 'Action is in progress.';
  if (status === 'Submitted') return 'Submitted. Review is pending.';
  if (status === 'Under Review') return 'Zentric Analytics is reviewing this step.';
  if (status === 'Approved') return 'Approved. You can continue when the next step is released.';
  if (status === 'Completed') return 'Completed.';
  if (status === 'Correction Requested') return 'Update requested. Please follow the instruction sent to you.';
  if (status === 'Rejected') return 'This step was not accepted.';
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
        },
        include: {
          application: {
            include: {
              applicant: true,
              stages: {
                orderBy: { stageOrder: 'asc' },
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
            <h2 className="text-xl font-bold text-ink">Open your portal again</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your secure session has expired. Request a new passcode to continue.
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
      (candidateStage: PortalStage) => candidateStage.stageKey === definition.key,
    );
    const status = toStageStatus(stage?.status);

    return {
      ...definition,
      stage,
      status,
      isCurrent: definition.order === application.currentStageOrder,
    };
  });

  const completedStageCount = portalStages.filter((stage) => isComplete(stage.status)).length;
  const progressPercent = Math.round((completedStageCount / stageDefs.length) * 100);
  const currentStage = portalStages.find((stage) => stage.isCurrent) ?? portalStages[0];
  const stageOne = portalStages[0]?.stage;
  const stageOneStatus = portalStages[0]?.status ?? 'Locked';
  const stageOneSubmission = stageOne?.submissions[0];
  const stageOneSignature = stageOneSubmission?.signature;
  const stageOneSigned = Boolean(stageOneSignature?.confirmed);
  const stageOneDownloadEligible = isStage1DownloadEligible({
    stagePresent: Boolean(stageOne),
    submissionPresent: Boolean(stageOneSubmission),
    submissionSubmitted: Boolean(stageOneSubmission?.submittedAt),
    signaturePresent: Boolean(stageOneSignature),
    signatureConfirmed: Boolean(stageOneSignature?.confirmed),
    signedAtPresent: Boolean(stageOneSignature?.signedAt),
    stageStatus: stageOneStatus,
  });

  return (
    <PageShell>
      <Section eyebrow="Candidate portal" title="Track your application">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
          <section className="card overflow-hidden p-0" aria-labelledby="portal-overview-title">
            <div className="border-b border-slate-100 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                    Application ID
                  </p>
                  <h2 id="portal-overview-title" className="mt-2 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {application.applicationId}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {application.applicant.fullName} · {application.roleAppliedFor}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Current step</p>
                <p className="mt-2 text-base font-bold text-ink">{currentStage?.title ?? 'Not available'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Progress</p>
                <p className="mt-2 text-base font-bold text-ink">
                  {completedStageCount} of {stageDefs.length} completed
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Last signed</p>
                <p className="mt-2 text-base font-bold text-ink">{formatDate(stageOneSignature?.signedAt)}</p>
              </div>
            </div>

            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progressPercent}% complete`}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </section>

          <aside className="card p-5 sm:p-6" aria-labelledby="portal-download-title">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">PDF downloads</p>
                <h2 id="portal-download-title" className="mt-2 text-xl font-bold text-ink">Approved forms</h2>
              </div>
              <StatusBadge status={stageOneDownloadEligible ? 'Download Available' : stageOneStatus} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-ink">Initial application form</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {stageOneDownloadEligible
                  ? 'Approved and ready to download.'
                  : stageOneSigned
                    ? 'Signed. Waiting for review approval.'
                    : 'Available after this form is signed and approved.'}
              </p>
              <div className="mt-4">
                {stageOneDownloadEligible ? (
                  <Stage1DownloadButton session={session!} label="Download PDF" />
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    Download locked
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              More PDFs will appear here after each stage is approved.
            </p>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="portal-progress-title">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">Progress</p>
              <h2 id="portal-progress-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">
                Application stages
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Check each step, see what is pending, and download approved PDFs from the download panel.
            </p>
          </div>

          <div className="grid gap-3">
            {portalStages.map((definition) => {
              const stageClass = definition.isCurrent
                ? 'border-brand bg-white shadow-lg shadow-slate-200/70'
                : isComplete(definition.status)
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-slate-200 bg-white';

              return (
                <article className={`rounded-2xl border p-4 ${stageClass}`} key={definition.key}>
                  <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                      {definition.order}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <h3 className="break-words font-bold text-ink">{definition.title}</h3>
                        {definition.isCurrent ? (
                          <span className="w-fit rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {stageNote(definition.status, definition.applicantAction)}
                      </p>
                      {definition.stage?.approvedAt ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          Approved {formatDate(definition.stage.approvedAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="md:justify-self-end">
                      <StatusBadge status={definition.status} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </Section>
    </PageShell>
  );
}
