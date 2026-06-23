import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { parseStage3Metadata, stages as stageDefs, toStageStatus, type StageStatus } from '@/lib/hiring';
import { submitOfferDecision, submitStage2, submitStage3 } from '../actions';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/security';

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

type PortalStage = PortalApplication['stages'][number];

function isComplete(status: StageStatus) {
  return status === 'Approved' || status === 'Completed';
}

const selectableStatuses: StageStatus[] = ['Available', 'In Progress', 'Correction Requested', 'Submitted', 'Under Review', 'Approved', 'Completed', 'Rejected'];
function isSelectable(status: StageStatus) { return selectableStatuses.includes(status); }
function stageHref(session: string | undefined, order: number) { const params = new URLSearchParams(); if (session) params.set('session', session); params.set('stage', String(order)); return `/track/portal?${params.toString()}`; }

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(value)
    : 'Not available';
}

export default async function Portal({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; stage?: string }>;
}) {
  const { session, stage } = await searchParams;
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
  const requestedStageOrder = Number(stage);
  const requestedStage = portalStages.find((candidate) => candidate.order === requestedStageOrder);
  const currentStage = portalStages.find((candidate) => candidate.isCurrent) ?? portalStages[0];
  const firstSelectableStage = portalStages.find((candidate) => isSelectable(candidate.status)) ?? portalStages[0];
  const defaultStage = currentStage && isSelectable(currentStage.status) ? currentStage : firstSelectableStage;
  const selectedStage = requestedStage ?? defaultStage;
  const selectedStageLocked = !isSelectable(selectedStage.status);
  const stage3Metadata = parseStage3Metadata(portalStages[2]?.stage?.metadata);
  const offer = application.offer;
  const offerExpired = Boolean(
    offer?.offerExpiryDate && offer.offerExpiryDate.getTime() < Date.now() && offer.status === 'Released',
  );
  const showOfferDecision = Boolean(
    offer && offer.status === 'Released' && !offerExpired && selectedStage?.order === 4,
  );
  const stageOneSignature = portalStages[0]?.stage?.submissions[0]?.signature;

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

          <aside className="card p-5 sm:p-6" aria-labelledby="portal-progress-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">Progress</p>
                <h2 id="portal-progress-title" className="mt-2 text-xl font-bold tracking-tight text-ink">
                  Application progress
                </h2>
              </div>
              <p className="text-sm font-bold text-slate-700">{progressPercent}%</p>
            </div>

            <div className="mt-5 space-y-3">
              {portalStages.map((definition) => {
                const selectable = isSelectable(definition.status);
                const active = selectedStage.order === definition.order;
                const cardClass = `flex items-start gap-3 rounded-2xl border p-3 transition ${active ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : selectable ? 'border-slate-200 bg-white hover:border-brand/50 hover:bg-slate-50' : 'border-slate-100 bg-slate-50 opacity-60'}`;
                const content = (
                  <>

                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isComplete(definition.status)
                        ? 'bg-emerald-600 text-white'
                        : definition.isCurrent
                          ? 'bg-brand text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {definition.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">{definition.title}</p>
                      {definition.isCurrent ? (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">Current</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{definition.status}</p>
                  </div>
                  </>
                );
                return selectable ? (
                  <Link aria-current={active ? 'page' : undefined} className={cardClass} href={stageHref(session, definition.order)} key={definition.key}>
                    {content}
                  </Link>
                ) : (
                  <div aria-disabled="true" className={cardClass} key={definition.key} title="This stage is not available yet.">
                    {content}
                    <p className="mt-2 text-xs font-semibold text-slate-500">This stage is not available yet.</p>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <section className="mt-8" aria-labelledby="selected-stage-workspace-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">Selected stage workspace</p>
                <h2 id="selected-stage-workspace-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">
                  Stage {selectedStage.order}: {selectedStage.title}
                </h2>
              </div>
              <StatusBadge status={selectedStage.status} />
            </div>

            {selectedStageLocked ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">
                {selectedStage.order === 4 ? 'Offer stage unlocks after screening approval.' : 'This stage is not available yet.'}
              </div>
            ) : selectedStage.order === 1 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                <p className="font-bold text-ink">Initial application summary</p>
                <p className="mt-2">Your first-stage application is recorded with status: {selectedStage.status}.</p>
              </div>
            ) : selectedStage.order === 2 ? (
              <form action={submitStage2} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                <input type="hidden" name="session" value={session ?? ''} />
                <p className="text-sm text-slate-600">Complete candidate information and upload identity verification documents. Uploaded files stay private and are not downloadable from this portal.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" name="fullLegalName" placeholder="Full legal name" required />
                  <input className="input" name="dateOfBirth" placeholder="Date of birth" required />
                  <select className="input" name="gender" required><option value="">Gender</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select>
                  <input className="input" name="nationality" placeholder="Nationality" required />
                  <input className="input" name="stateOfOrigin" placeholder="State of origin" required />
                  <input className="input" name="stateOfResidence" placeholder="State of residence" required />
                  <input className="input" name="lga" placeholder="LGA" required />
                  <input className="input" name="currentCity" placeholder="Current city/location" required />
                  <input className="input" name="phoneNumber" placeholder="Phone number" required />
                  <input className="input" name="email" placeholder="Email" type="email" required />
                  <select className="input" name="idType" required><option>National Identification Number / NIN</option><option>International Passport</option><option>Driver’s Licence</option><option>Voter’s Card</option><option>Other Government-issued ID</option></select>
                  <input className="input" name="idNumber" placeholder="ID number" required />
                </div>
                <textarea className="input" name="residentialAddress" placeholder="Residential address" required />
                <input className="input" name="emergencyContactName" placeholder="Emergency contact name" required />
                <input className="input" name="emergencyContactRelationship" placeholder="Emergency contact relationship" required />
                <input className="input" name="emergencyContactPhone" placeholder="Emergency contact phone" required />
                <input className="input" name="governmentIdDocument" type="file" required />
                <input className="input" name="passportPhoto" type="file" required />
                <input className="input" name="additionalIdentityDocument" type="file" />
                <input className="input" name="signatureName" placeholder="Typed signature" required />
                <label className="text-sm font-semibold"><input name="declarationAccuracy" type="checkbox" required /> I confirm this information is accurate.</label>
                <label className="text-sm font-semibold"><input name="identityProcessingConsent" type="checkbox" required /> I consent to identity processing.</label>
                <label className="text-sm font-semibold"><input name="signatureConsent" type="checkbox" required /> I agree to sign electronically.</label>
                <button className="btn btn-primary w-full sm:w-auto" type="submit">Submit Stage 2</button>
              </form>
            ) : selectedStage.order === 3 ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                  <p className="font-bold text-ink">{stage3Metadata.title ?? 'Stage 3 instructions'}</p>
                  <p className="mt-2 whitespace-pre-wrap">{stage3Metadata.instructions ?? 'Stage 3 instructions will appear here when released by admin.'}</p>
                </div>
                <form action={submitStage3} className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <input type="hidden" name="session" value={session ?? ''} />
                  <textarea className="input" name="availability" placeholder="Confirm your availability or response" required />
                  <textarea className="input" name="responseMessage" placeholder="Optional response message" />
                  <input className="input" name="assessmentFile" type="file" />
                  <label className="text-sm font-semibold"><input name="declarationAccuracy" type="checkbox" required /> I confirm this response is accurate.</label>
                  <button className="btn btn-primary w-full sm:w-auto" type="submit">Submit Stage 3</button>
                </form>
              </div>
            ) : selectedStage.order === 4 ? (
              <div className="mt-6">
                {!offer ? <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">Offer details will appear here when released by admin.</p> : offerExpired || offer.status === 'Expired' ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">This offer is no longer open.</p> : offer.status === 'Withdrawn' ? <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">This offer has been withdrawn.</p> : offer.status === 'Accepted' ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">Offer accepted. Employment agreement stage is now available.</p> : offer.status === 'Declined' ? <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">Offer declined. Stage 5 will not unlock after a declined offer.</p> : showOfferDecision ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h3 className="text-lg font-bold text-ink">Offer details</h3><div className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><p><strong>Role offered:</strong> {offer.roleOffered}</p><p><strong>Salary/compensation:</strong> {offer.salary}</p><p><strong>Start date:</strong> {formatDate(offer.startDate)}</p><p><strong>Work mode:</strong> {offer.workMode}</p><p><strong>Reporting manager:</strong> {offer.reportingManager ?? '—'}</p><p><strong>Probation period:</strong> {offer.probationPeriod ?? '—'}</p><p><strong>Offer expiry:</strong> {formatDate(offer.offerExpiryDate)}</p>{offer.specialConditions ? <p className="whitespace-pre-wrap rounded-xl bg-white p-3"><strong>Special conditions:</strong> {offer.specialConditions}</p> : null}</div></div>
                    <form action={submitOfferDecision} className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5"><input type="hidden" name="session" value={session ?? ''} /><h3 className="font-bold text-ink">Your decision</h3><label className="block text-sm font-semibold">Optional decision note<textarea className="input mt-1 min-h-24" name="candidateDecisionNote" /></label><label className="flex gap-2 text-sm font-semibold"><input name="confirmation" type="checkbox" required /> I confirm my selected offer decision.</label><div className="flex flex-wrap gap-3"><button className="btn btn-primary" name="decision" value="accept" type="submit">Accept Offer</button><button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700" name="decision" value="decline" type="submit">Decline Offer</button></div></form>
                  </div>
                ) : <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">Offer details will appear here when released by admin.</p>}
              </div>
            ) : selectedStage.order === 5 ? (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">Employment agreement stage is now available.</p>
            ) : (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-700">This stage workspace will appear here when available.</p>
            )}
          </div>
        </section>

      </Section>
    </PageShell>
  );
}
