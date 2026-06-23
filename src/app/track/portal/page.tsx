import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { idTypes, parseStage3Metadata, stages as stageDefs, toStageStatus, type StageStatus } from '@/lib/hiring';
import { submitOfferDecision, submitStage2, submitStage3 } from '../actions';
import { Stage2SubmitButton } from './Stage2SubmitButton';
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
  const currentStage = portalStages.find((stage) => stage.isCurrent) ?? portalStages[0];
  const stageOne = portalStages[0]?.stage;
  const stageTwoStatus = portalStages[1]?.status ?? 'Locked';
  const stageThree = portalStages[2]?.stage;
  const stageThreeStatus = portalStages[2]?.status ?? 'Locked';
  const stageThreeMetadata = parseStage3Metadata(stageThree?.metadata);
  const stageThreeReleased = Boolean(stageThreeMetadata.releasedAt);
  const stageFourStatus = portalStages[3]?.status ?? 'Locked';
  const stageFiveStatus = portalStages[4]?.status ?? 'Locked';
  const offer = application.offer;
  const offerExpired = Boolean(offer?.offerExpiryDate && offer.offerExpiryDate.getTime() < Date.now() && offer.status === 'Released');
  const stageOneApproved = portalStages[0]?.status === 'Approved';
  const stageOnePayload = (stageOne?.submissions[0]?.payload ?? {}) as Record<string, string>;
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
        </div>


        <section className="mt-8" aria-labelledby="stage2-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">Stage 2</p>
                <h2 id="stage2-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">Candidate Information / Identity Verification</h2>
              </div>
              <StatusBadge status={stageTwoStatus} />
            </div>
            {!stageOneApproved || stageTwoStatus === 'Locked' ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Stage 2 unlocks after Stage 1 approval.</p>
            ) : ['Submitted', 'Under Review'].includes(stageTwoStatus) ? (
              <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">Stage 2 submitted and under review.</p>
            ) : stageTwoStatus === 'Approved' ? (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Stage 2 approved. Continue to the next unlocked stage.</p>
            ) : ['Available', 'Correction Requested'].includes(stageTwoStatus) ? (
              <form action={submitStage2} className="mt-6 space-y-6">
                <input type="hidden" name="session" value={session ?? ''} />
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="font-bold text-ink">Personal Identity Details</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">Full legal name<input className="input mt-1" name="fullLegalName" defaultValue={application.applicant.fullName} required /></label>
                  <label className="text-sm font-semibold">Date of birth<input className="input mt-1" name="dateOfBirth" type="date" required /></label>
                  <label className="text-sm font-semibold">Gender<select className="input mt-1" name="gender" required><option value="">Select</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select></label>
                  <label className="text-sm font-semibold">Nationality<input className="input mt-1" name="nationality" defaultValue={stageOnePayload.nationality ?? ''} required /></label>
                  <label className="text-sm font-semibold">State of origin<input className="input mt-1" name="stateOfOrigin" required /></label>
                  <label className="text-sm font-semibold">State of residence<input className="input mt-1" name="stateOfResidence" defaultValue={stageOnePayload.stateOfResidence ?? ''} required /></label>
                  <label className="text-sm font-semibold">LGA<input className="input mt-1" name="lga" defaultValue={stageOnePayload.lgaOfResidence ?? ''} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Residential address<input className="input mt-1" name="residentialAddress" defaultValue={stageOnePayload.residentialAddress ?? ''} required /></label>
                  <label className="text-sm font-semibold">Current city/location<input className="input mt-1" name="currentCity" defaultValue={application.applicant.location ?? ''} required /></label>
                  <label className="text-sm font-semibold">Phone number<input className="input mt-1" name="phoneNumber" defaultValue={application.applicant.phoneE164 ?? application.applicant.phone ?? ''} required /></label>
                  <label className="text-sm font-semibold md:col-span-2">Email<input className="input mt-1" name="email" type="email" defaultValue={application.applicant.email} required /></label>
                </div></div>
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="font-bold text-ink">Government ID Details</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">ID type<select className="input mt-1" name="idType" required><option value="">Select</option>{idTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label className="text-sm font-semibold">ID number<input className="input mt-1" name="idNumber" required /></label>
                  <label className="text-sm font-semibold">Issuing authority (optional)<input className="input mt-1" name="idIssuingAuthority" /></label>
                  <label className="text-sm font-semibold">Issue date (optional)<input className="input mt-1" name="idIssueDate" type="date" /></label>
                  <label className="text-sm font-semibold">Expiry date (optional)<input className="input mt-1" name="idExpiryDate" type="date" /></label>
                  <label className="text-sm font-semibold">NIN, if separate<input className="input mt-1" name="nin" /></label>
                  <label className="text-sm font-semibold">Tax ID (optional)<input className="input mt-1" name="taxId" /></label>
                </div></div>
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="font-bold text-ink">Identity Document Uploads</h3><div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold">Government ID document<input className="mt-3 block w-full text-sm" name="governmentIdDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" required /></label>
                  <label className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold">Passport/profile photo<input className="mt-3 block w-full text-sm" name="passportPhoto" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" required /></label>
                  <label className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold">Additional support (optional)<input className="mt-3 block w-full text-sm" name="additionalIdentityDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" /></label>
                </div><p className="mt-3 text-xs text-slate-500">Accepted formats: PDF, JPG, JPEG, PNG, WEBP. Max size 20MB each. Files are stored privately.</p></div>
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="font-bold text-ink">Emergency / Contact Confirmation</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">Emergency contact name<input className="input mt-1" name="emergencyContactName" required /></label><label className="text-sm font-semibold">Relationship<input className="input mt-1" name="emergencyContactRelationship" required /></label><label className="text-sm font-semibold">Emergency contact phone<input className="input mt-1" name="emergencyContactPhone" required /></label><label className="text-sm font-semibold">Address (optional)<input className="input mt-1" name="emergencyContactAddress" /></label>
                </div></div>
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="font-bold text-ink">Declaration and Consent</h3><div className="mt-4 space-y-3 text-sm"><label className="flex gap-2"><input name="declarationAccuracy" type="checkbox" required /> I confirm my ID information is accurate.</label><label className="flex gap-2"><input name="identityProcessingConsent" type="checkbox" required /> I consent to Zentric Analytics Ltd processing identity data for recruitment verification.</label><label className="block font-semibold">Typed electronic signature<input className="input mt-1" name="signatureName" defaultValue={application.applicant.fullName} required /></label><label className="flex gap-2"><input name="signatureConsent" type="checkbox" required /> I confirm this typed name is my electronic signature.</label></div></div>
                <Stage2SubmitButton />
              </form>
            ) : null}
          </div>
        </section>


        <section className="mt-8" aria-labelledby="stage3-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-widest text-accent">Stage 3</p><h2 id="stage3-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">Screening / Interview / Assessment</h2></div>
              <StatusBadge status={stageThreeStatus} />
            </div>
            {stageTwoStatus !== 'Approved' && stageThreeStatus === 'Locked' ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Stage 3 unlocks after Stage 2 approval.</p>
            ) : !stageThreeReleased ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Screening details will be shared by the admin.</p>
            ) : ['Submitted','Under Review'].includes(stageThreeStatus) ? (
              <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">Stage 3 submitted and under review.</p>
            ) : stageThreeStatus === 'Approved' ? (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Stage 3 approved. Offer stage is now available.</p>
            ) : stageThreeStatus === 'Rejected' ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Stage 3 was not accepted. Please check your email for a safe application update.</p>
            ) : ['Available','In Progress','Correction Requested'].includes(stageThreeStatus) ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h3 className="text-lg font-bold text-ink">{stageThreeMetadata.title ?? 'Stage 3 instructions'}</h3><div className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><p><strong>Type:</strong> {stageThreeMetadata.screeningType ?? 'Screening'}</p><p><strong>Interview mode:</strong> {stageThreeMetadata.interviewMode ?? 'Not applicable'}</p>{stageThreeMetadata.meetingLink ? <p><strong>Meeting link:</strong> <a className="text-accent underline" href={stageThreeMetadata.meetingLink}>Open meeting link</a></p> : null}{stageThreeMetadata.location ? <p><strong>Location:</strong> {stageThreeMetadata.location}</p> : null}{stageThreeMetadata.scheduledAt ? <p><strong>Scheduled:</strong> {stageThreeMetadata.scheduledAt}</p> : null}{stageThreeMetadata.deadlineAt ? <p><strong>Deadline:</strong> {stageThreeMetadata.deadlineAt}</p> : null}<p className="whitespace-pre-wrap rounded-xl bg-white p-3">{stageThreeMetadata.instructions}</p></div></div>
                <form action={submitStage3} className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4"><input type="hidden" name="session" value={session ?? ''} /><h3 className="font-bold text-ink">Your response</h3>{stageThreeStatus === 'Correction Requested' ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Correction requested. Please resubmit your Stage 3 response.</p> : null}<label className="block text-sm font-semibold">Availability / confirmation<input className="input mt-1" name="availability" required placeholder="Example: I am available and confirm." /></label><label className="block text-sm font-semibold">Response message<textarea className="input mt-1 min-h-28" name="responseMessage" /></label>{stageThreeMetadata.requiresUpload ? <label className="block rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold">Assessment upload<input className="mt-3 block w-full text-sm" name="assessmentFile" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" required /><span className="mt-2 block text-xs text-slate-500">{stageThreeMetadata.allowedUploadNote || 'Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP. Max 20MB. Files are stored privately.'}</span></label> : null}<label className="flex gap-2 text-sm font-semibold"><input name="declarationAccuracy" type="checkbox" required /> I confirm this Stage 3 response is accurate.</label><button className="btn btn-primary" type="submit">Submit Stage 3</button><p className="text-xs text-slate-500">Submitting...</p></form>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="stage4-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-widest text-accent">Stage 4</p><h2 id="stage4-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">Offer Stage</h2></div><StatusBadge status={stageFourStatus} /></div>
            {stageFourStatus === 'Locked' ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Offer stage unlocks after screening approval.</p> : !offer || offer.status === 'Draft' ? <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Offer details will appear here when released by admin.</p> : offer.status === 'Accepted' ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Offer accepted. Employment agreement stage is now available.</p> : offer.status === 'Declined' ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Offer declined.</p> : offer.status === 'Withdrawn' || offerExpired || offer.status === 'Expired' ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">This offer is no longer open for decision.</p> : <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h3 className="text-lg font-bold text-ink">Offer details</h3><div className="mt-3 space-y-2 text-sm leading-6 text-slate-700"><p><strong>Role offered:</strong> {offer.roleOffered}</p><p><strong>Salary/compensation:</strong> {offer.salary}</p><p><strong>Start date:</strong> {formatDate(offer.startDate)}</p><p><strong>Work mode:</strong> {offer.workMode}</p><p><strong>Reporting manager:</strong> {offer.reportingManager ?? '—'}</p><p><strong>Probation period:</strong> {offer.probationPeriod ?? '—'}</p><p><strong>Offer expiry:</strong> {formatDate(offer.offerExpiryDate)}</p>{offer.specialConditions ? <p className="whitespace-pre-wrap rounded-xl bg-white p-3"><strong>Special conditions:</strong> {offer.specialConditions}</p> : null}</div></div><form action={submitOfferDecision} className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4"><input type="hidden" name="session" value={session ?? ''} /><h3 className="font-bold text-ink">Your decision</h3><label className="block text-sm font-semibold">Optional decision note<textarea className="input mt-1 min-h-24" name="candidateDecisionNote" /></label><label className="flex gap-2 text-sm font-semibold"><input name="confirmation" type="checkbox" required /> I confirm my selected offer decision.</label><div className="flex flex-wrap gap-3"><button className="btn btn-primary" name="decision" value="accept" type="submit">Accept Offer</button><button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700" name="decision" value="decline" type="submit">Decline Offer</button></div><p className="text-xs text-slate-500">Submitting...</p></form></div>}
            <p className="mt-4 text-sm font-semibold text-slate-700">Stage 5 status: {stageFiveStatus === 'Available' ? 'Available — employment agreement stage is now available.' : stageFiveStatus}</p>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="portal-documents-title">
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Documents
                </p>
                <h2
                  id="portal-documents-title"
                  className="mt-2 text-2xl font-bold tracking-tight text-ink"
                >
                  Application documents
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-ink">Submitted documents</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Submitted documents are available for admin review. You can
                track your application status here.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="portal-progress-title">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">Progress</p>
              <h2 id="portal-progress-title" className="mt-2 text-2xl font-bold tracking-tight text-ink">
                Application stages
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Check each step and see what is pending as your application progresses.
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
