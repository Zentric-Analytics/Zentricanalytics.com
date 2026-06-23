import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import {
  parseStage3Metadata,
  stage2GenderOptions,
  stage2IdTypeOptions,
  stages as stageDefs,
  toStageStatus,
  type StageStatus,
} from '@/lib/hiring';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/security';
import { submitOfferDecision, submitStage2, submitStage3 } from '../actions';

const selectableStatuses: StageStatus[] = [
  'Available',
  'In Progress',
  'Approved',
  'Completed',
  'Rejected',
  'Submitted',
  'Under Review',
  'Correction Requested',
];

type PortalApplication = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    offer: true;
    stages: { include: { submissions: { include: { signature: true } } } };
  };
}>;

type PortalStage = PortalApplication['stages'][number];
type PortalStageCard = (typeof stageDefs)[number] & {
  stage?: PortalStage;
  status: StageStatus;
  href: string;
  locked: boolean;
  isSelected: boolean;
  isCurrent: boolean;
};

function isComplete(status: StageStatus) {
  return status === 'Approved' || status === 'Completed';
}

function isStageSelectable(status: StageStatus) {
  return selectableStatuses.includes(status);
}

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
    : 'Not available';
}

function portalHref(session: string, stageOrder: number) {
  const params = new URLSearchParams({ session, stage: String(stageOrder) });
  return `/track/portal?${params.toString()}`;
}

function field(name: string, label: string, type = 'text') {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input className="input mt-1" name={name} type={type} />
    </label>
  );
}

function Stage2Workspace({ session, status }: { session: string; status: StageStatus }) {
  const canSubmit = ['Available', 'In Progress', 'Correction Requested'].includes(status);
  if (!canSubmit) {
    return <p className="text-sm leading-6 text-slate-600">Stage 2 status: {status}. We will update this workspace when action is needed.</p>;
  }

  return (
    <form action={submitStage2} className="mt-5 grid gap-4" encType="multipart/form-data">
      <input name="session" type="hidden" value={session} />
      <div className="grid gap-4 md:grid-cols-2">
        {field('fullLegalName', 'Full legal name')}
        {field('dateOfBirth', 'Date of birth', 'date')}
        <label className="block text-sm font-semibold text-slate-700">Gender<select className="input mt-1" name="gender">{stage2GenderOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        {field('nationality', 'Nationality')}
        {field('stateOfOrigin', 'State of origin')}
        {field('stateOfResidence', 'State of residence')}
        {field('lga', 'LGA')}
        {field('currentCity', 'Current city/location')}
        {field('phoneNumber', 'Phone number')}
        {field('email', 'Email', 'email')}
        <label className="block text-sm font-semibold text-slate-700">ID type<select className="input mt-1" name="idType">{stage2IdTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        {field('idNumber', 'ID number')}
        {field('idIssuingAuthority', 'ID issuing authority')}
        {field('idIssueDate', 'ID issue date', 'date')}
        {field('idExpiryDate', 'ID expiry date', 'date')}
        {field('nin', 'NIN (optional)')}
        {field('taxId', 'Tax ID (optional)')}
        {field('emergencyContactName', 'Emergency contact name')}
        {field('emergencyContactRelationship', 'Emergency contact relationship')}
        {field('emergencyContactPhone', 'Emergency contact phone')}
      </div>
      <label className="block text-sm font-semibold text-slate-700">Residential address<textarea className="input mt-1 min-h-24" name="residentialAddress" /></label>
      <label className="block text-sm font-semibold text-slate-700">Emergency contact address<textarea className="input mt-1 min-h-20" name="emergencyContactAddress" /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">Government ID document<input className="input mt-1" name="governmentIdDocument" type="file" /></label>
        <label className="text-sm font-semibold text-slate-700">Passport photo<input className="input mt-1" name="passportPhoto" type="file" /></label>
        <label className="text-sm font-semibold text-slate-700">Additional document<input className="input mt-1" name="additionalIdentityDocument" type="file" /></label>
      </div>
      {field('signatureName', 'Type your name as your electronic signature')}
      <label className="flex gap-2 text-sm font-semibold"><input name="declarationAccuracy" type="checkbox" /> I confirm these details are accurate.</label>
      <label className="flex gap-2 text-sm font-semibold"><input name="identityProcessingConsent" type="checkbox" /> I consent to identity processing.</label>
      <label className="flex gap-2 text-sm font-semibold"><input name="signatureConsent" type="checkbox" /> I consent to sign electronically.</label>
      <button className="btn btn-primary w-full sm:w-auto" type="submit">Submit Stage 2</button>
    </form>
  );
}

function Stage3Workspace({ session, stage, status }: { session: string; stage?: PortalStage; status: StageStatus }) {
  const metadata = parseStage3Metadata(stage?.metadata);
  const canSubmit = ['Available', 'In Progress', 'Correction Requested'].includes(status) && metadata.releasedAt;
  return (
    <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
      {metadata.releasedAt ? <p>{metadata.instructions ?? 'Review the screening instructions and respond below.'}</p> : <p>Screening details will appear here when released by admin.</p>}
      {canSubmit ? (
        <form action={submitStage3} className="grid gap-4" encType="multipart/form-data">
          <input name="session" type="hidden" value={session} />
          <label className="block font-semibold">Availability<input className="input mt-1" name="availability" /></label>
          <label className="block font-semibold">Response message<textarea className="input mt-1 min-h-24" name="responseMessage" /></label>
          <label className="block font-semibold">Assessment file<input className="input mt-1" name="assessmentFile" type="file" /></label>
          <label className="flex gap-2 font-semibold"><input name="declarationAccuracy" type="checkbox" /> I confirm this response is accurate.</label>
          <button className="btn btn-primary w-full sm:w-auto" type="submit">Submit Stage 3</button>
        </form>
      ) : null}
    </div>
  );
}

function Stage4Workspace({ application, session, status }: { application: PortalApplication; session: string; status: StageStatus }) {
  const offer = application.offer;
  const expired = Boolean(offer?.offerExpiryDate && offer.offerExpiryDate.getTime() < Date.now() && offer.status === 'Released');
  if (status === 'Locked') return <p className="mt-5 text-sm leading-6 text-slate-600">Offer stage unlocks after screening approval.</p>;
  if (!offer || offer.status === 'Draft') return <p className="mt-5 text-sm leading-6 text-slate-600">Offer details will appear here when released by admin.</p>;
  if (offer.status === 'Accepted') return <p className="mt-5 text-sm leading-6 text-emerald-700">Offer accepted. The employment agreement stage is now available.</p>;
  if (offer.status === 'Declined') return <p className="mt-5 text-sm leading-6 text-red-700">Offer declined. The employment agreement stage remains locked.</p>;
  if (offer.status === 'Withdrawn' || offer.status === 'Expired' || expired) return <p className="mt-5 text-sm leading-6 text-slate-600">This offer is closed and no longer available for candidate action.</p>;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 className="text-lg font-bold text-ink">Offer details</h3>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          <p><strong>Role offered:</strong> {offer.roleOffered}</p>
          <p><strong>Start date:</strong> {formatDate(offer.startDate)}</p>
          <p><strong>Work mode:</strong> {offer.workMode}</p>
          <p><strong>Reporting manager:</strong> {offer.reportingManager ?? '—'}</p>
          <p><strong>Probation period:</strong> {offer.probationPeriod ?? '—'}</p>
          <p><strong>Offer expiry:</strong> {formatDate(offer.offerExpiryDate)}</p>
          {offer.specialConditions ? <p className="whitespace-pre-wrap rounded-xl bg-white p-3"><strong>Special conditions:</strong> {offer.specialConditions}</p> : null}
        </div>
      </div>
      <form action={submitOfferDecision} className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
        <input name="session" type="hidden" value={session} />
        <h3 className="font-bold text-ink">Your decision</h3>
        <label className="block text-sm font-semibold">Optional decision note<textarea className="input mt-1 min-h-24" name="candidateDecisionNote" /></label>
        <label className="flex gap-2 text-sm font-semibold"><input name="confirmation" required type="checkbox" /> I confirm my selected offer decision.</label>
        <div className="flex flex-wrap gap-3"><button className="btn btn-primary" name="decision" type="submit" value="accept">Accept Offer</button><button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700" name="decision" type="submit" value="decline">Decline Offer</button></div>
      </form>
    </div>
  );
}

function Workspace({ application, selectedStage, session }: { application: PortalApplication; selectedStage: PortalStageCard; session: string }) {
  const stageOneSignature = application.stages.find((stage) => stage.stageOrder === 1)?.submissions[0]?.signature;
  return (
    <section className="card mt-8 p-5 sm:p-6" aria-labelledby="selected-stage-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-widest text-accent">Stage {selectedStage.order}</p><h2 id="selected-stage-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">{selectedStage.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{selectedStage.applicantAction}</p></div>
        <StatusBadge status={selectedStage.status} />
      </div>
      {selectedStage.locked ? <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{selectedStage.order === 4 ? 'Offer stage unlocks after screening approval.' : 'This stage is locked until previous approvals are completed.'}</p> : null}
      {!selectedStage.locked && selectedStage.order === 1 ? <p className="mt-5 text-sm leading-6 text-slate-600">Initial application status: {selectedStage.status}. Last signed: {formatDate(stageOneSignature?.signedAt)}.</p> : null}
      {!selectedStage.locked && selectedStage.order === 2 ? <Stage2Workspace session={session} status={selectedStage.status} /> : null}
      {!selectedStage.locked && selectedStage.order === 3 ? <Stage3Workspace session={session} stage={selectedStage.stage} status={selectedStage.status} /> : null}
      {selectedStage.order === 4 ? <Stage4Workspace application={application} session={session} status={selectedStage.status} /> : null}
      {!selectedStage.locked && selectedStage.order === 5 ? <p className="mt-5 text-sm leading-6 text-slate-600">Employment agreement details will appear here when prepared by HR.</p> : null}
      {!selectedStage.locked && selectedStage.order > 5 ? <p className="mt-5 text-sm leading-6 text-slate-600">This later-stage workspace will be opened by HR when it is ready.</p> : null}
    </section>
  );
}

export default async function Portal({ searchParams }: { searchParams: Promise<{ session?: string; stage?: string }> }) {
  const { session = '', stage } = await searchParams;
  const access = session
    ? await prisma.applicationAccessCode.findFirst({
        where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() }, application: { deletedAt: null } },
        include: { application: { include: { applicant: true, offer: true, stages: { orderBy: { stageOrder: 'asc' }, include: { submissions: { include: { signature: true } } } } } } },
      })
    : null;

  if (!access) {
    return <PageShell><Section eyebrow="Candidate portal" title="Session expired"><div className="card max-w-2xl p-5 sm:p-6"><h2 className="text-xl font-bold text-ink">Open your portal again</h2><p className="mt-3 text-sm leading-6 text-slate-600">Your secure session has expired. Request a new passcode to continue.</p><Link className="btn btn-primary mt-5" href="/track">Request passcode</Link></div></Section></PageShell>;
  }

  const application = access.application;
  const baseStages = stageDefs.map((definition) => {
    const candidateStage = application.stages.find((item) => item.stageKey === definition.key);
    const status = toStageStatus(candidateStage?.status);
    return { ...definition, stage: candidateStage, status, isCurrent: definition.order === application.currentStageOrder };
  });
  const defaultStage = baseStages.find((item) => item.isCurrent && isStageSelectable(item.status)) ?? baseStages.find((item) => isStageSelectable(item.status)) ?? baseStages[0];
  const requestedOrder = Number(stage);
  const selectedOrder = Number.isInteger(requestedOrder) && stageDefs.some((item) => item.order === requestedOrder) ? requestedOrder : defaultStage.order;
  const portalStages: PortalStageCard[] = baseStages.map((item) => ({ ...item, href: portalHref(session, item.order), locked: !isStageSelectable(item.status), isSelected: item.order === selectedOrder }));
  const selectedStage = portalStages.find((item) => item.order === selectedOrder) ?? portalStages[0];
  const completedStageCount = portalStages.filter((item) => isComplete(item.status)).length;
  const progressPercent = Math.round((completedStageCount / stageDefs.length) * 100);
  const stageOneSignature = portalStages[0]?.stage?.submissions[0]?.signature;

  return (
    <PageShell>
      <Section eyebrow="Candidate portal" title="Track your application">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-start">
          <section className="card overflow-hidden p-0" aria-labelledby="portal-overview-title"><div className="border-b border-slate-100 bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold uppercase tracking-widest text-accent">Application ID</p><h2 id="portal-overview-title" className="mt-2 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">{application.applicationId}</h2><p className="mt-2 text-sm text-slate-600">{application.applicant.fullName} · {application.roleAppliedFor}</p></div><StatusBadge status={application.status} /></div></div><div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Selected stage</p><p className="mt-2 text-base font-bold text-ink">{selectedStage.title}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Progress</p><p className="mt-2 text-base font-bold text-ink">{completedStageCount} of {stageDefs.length} completed</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Last signed</p><p className="mt-2 text-base font-bold text-ink">{formatDate(stageOneSignature?.signedAt)}</p></div></div><div className="px-5 pb-5 sm:px-6 sm:pb-6"><div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progressPercent}% complete`}><div className="h-full rounded-full bg-brand" style={{ width: `${progressPercent}%` }} /></div></div></section>
          <aside className="card p-5 sm:p-6" aria-labelledby="portal-progress-title"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-accent">Progress</p><h2 id="portal-progress-title" className="mt-2 text-xl font-bold tracking-tight text-ink">Application progress</h2></div><p className="text-sm font-bold text-slate-700">{progressPercent}%</p></div></aside>
        </div>

        <section className="mt-8" aria-labelledby="stage-selector-title"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-widest text-accent">Application stages</p><h2 id="stage-selector-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">Select a stage workspace</h2></div></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{portalStages.map((item) => {
          const cardClass = `block rounded-2xl border p-4 transition ${item.isSelected ? 'border-brand bg-brand/5 ring-2 ring-brand/30' : 'border-slate-200 bg-white'} ${item.locked ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-md'}`;
          const content = <><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{item.order}</div><StatusBadge status={item.status} /></div><h3 className="mt-4 text-base font-bold text-ink">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.locked && item.order === 4 ? 'Offer stage unlocks after screening approval.' : item.applicantAction}</p><p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">{item.isSelected ? 'Selected' : item.locked ? 'Locked' : 'Open workspace'}</p></>;
          return item.locked ? <div aria-disabled="true" className={cardClass} key={item.key}>{content}</div> : <Link className={cardClass} href={item.href} key={item.key}>{content}</Link>;
        })}</div></section>

        <Workspace application={application} selectedStage={selectedStage} session={session} />

        <section className="card mt-8 p-5 sm:p-6" aria-labelledby="application-documents-title"><h2 id="application-documents-title" className="text-xl font-bold tracking-tight text-ink">Application documents</h2><p className="mt-3 text-sm leading-6 text-slate-600">Submitted documents are available for admin review. You can track your application status here.</p></section>
      </Section>
    </PageShell>
  );
}
