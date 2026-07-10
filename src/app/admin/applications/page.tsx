import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';

import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import { StatusBadge } from '@/components/StatusBadge';
import { prisma, isDatabaseConfigured } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';

import { adminStage1Action } from './actions';

type AdminApplicationListItem = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    stages: { include: { submissions: { include: { documents: { include: { uploadedDocument: true } } } } } };
    offer: true;
  };
}>;

type SearchParams = Record<string, string | undefined>;

const statusOptions = ['Submitted', 'Under Review', 'Correction Requested', 'Approved', 'Rejected', 'Interview Scheduled', 'Assessment Required', 'Offer Pending', 'Agreement Pending'];
const stageOptions = [1, 2, 3, 4, 5];

function actionBanner(params: SearchParams) {
  const messages: string[] = [];
  if (params.success === 'approved') messages.push('Stage 1 was approved and Stage 2 is now available.');
  if (params.success === 'already_approved') messages.push('Stage 1 is already approved.');
  if (params.success === 'rejected') messages.push('Application was rejected.');
  if (params.success === 'correction') messages.push('Correction was requested.');
  if (params.success === 'soft_deleted') messages.push('Application moved to deleted records.');
  if (params.success === 'restored') messages.push('Application restored.');
  if (params.success === 'permanent_deleted') messages.push('Application permanently deleted.');
  if (params.warning === 'email_failed') messages.push('Stage action was saved, but the email could not be sent. Please retry email delivery or contact the candidate manually.');
  if (params.error === 'action_failed') messages.push('The admin action could not be completed. Please refresh and try again.');
  if (params.error === 'missing_stage') messages.push('Required hiring stage data is missing. Please contact an administrator.');
  if (params.error === 'invalid_action') messages.push('Invalid admin action.');
  if (params.error === 'invalid_confirmation') messages.push('Confirmation did not match. No records were deleted.');
  if (params.error === 'restore_before_stage_action') messages.push('Restore this application before taking stage actions.');
  if (params.error === 'delete_failed') messages.push('Delete failed. Please refresh and try again.');
  if (params.error === 'file_delete_failed') messages.push('Private file deletion failed, so the application was not permanently deleted.');
  return messages;
}

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(value) : 'Missing';
}

function currentStage(application: AdminApplicationListItem) {
  return application.stages.find((stage) => stage.stageOrder === application.currentStageOrder) ?? application.stages[0];
}

function uploadedCount(application: AdminApplicationListItem) {
  return application.stages.reduce((count, stage) => count + stage.submissions.reduce((stageCount, submission) => stageCount + submission.documents.length, 0), 0);
}

export default async function AdminApplications({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const adminSession = await getAdminSession();
  console.info('adminSessionPresentOnPageLoad', { page: '/admin/applications', present: Boolean(adminSession) });
  if (!adminSession) redirect('/admin/login');
  if (!isDatabaseConfigured()) return <main>DATABASE_URL is required for admin records.</main>;

  const query = params.q?.trim();
  const stageFilter = params.stage && stageOptions.includes(Number(params.stage)) ? Number(params.stage) : undefined;
  const statusFilter = params.status && statusOptions.includes(params.status) ? params.status : undefined;

  const applications = await prisma.jobApplication.findMany({
    where: {
      deletedAt: null,
      ...(stageFilter ? { currentStageOrder: stageFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query ? { OR: [
        { applicationId: { contains: query, mode: 'insensitive' } },
        { roleAppliedFor: { contains: query, mode: 'insensitive' } },
        { applicant: { is: { fullName: { contains: query, mode: 'insensitive' } } } },
        { applicant: { is: { email: { contains: query, mode: 'insensitive' } } } },
      ] } : {}),
    },
    include: { applicant: true, stages: { orderBy: { stageOrder: 'asc' }, include: { submissions: { include: { documents: { include: { uploadedDocument: true } } } } } }, offer: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const underReview = applications.filter((app) => ['Submitted', 'Under Review'].includes(app.status) || currentStage(app)?.status === 'Under Review').length;
  const actionNeeded = applications.filter((app) => ['Correction Requested', 'Rejected'].includes(app.status) || app.stages.some((stage) => ['Correction Requested', 'Rejected'].includes(stage.status))).length;
  const offersPending = applications.filter((app) => app.offer && ['Released', 'Accepted'].includes(app.offer.status)).length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Internal HR workspace</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Hiring admin</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Live candidate and application workspace for reviewing submissions, moving candidates through stages, and managing hiring records.</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-600 lg:items-end"><span>Signed in as {adminSession.email}</span><AdminLogoutButton /></div>
          </div>
        </header>

        {actionBanner(params).map((message) => <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900" key={message}>{message}</p>)}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Total active applications</p><p className="mt-2 text-3xl font-bold text-slate-950">{applications.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Under review</p><p className="mt-2 text-3xl font-bold text-slate-950">{underReview}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Action needed</p><p className="mt-2 text-3xl font-bold text-slate-950">{actionNeeded}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Offers sent / agreement pending</p><p className="mt-2 text-3xl font-bold text-slate-950">{offersPending}</p></div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
            <input className="input" name="q" defaultValue={query} placeholder="Search candidate, email, role, or application ID" />
            <select className="input" name="stage" defaultValue={stageFilter ?? ''} aria-label="Filter by current stage">
              <option value="">All stages</option>{stageOptions.map((stage) => <option value={stage} key={stage}>Stage {stage}</option>)}
            </select>
            <select className="input" name="status" defaultValue={statusFilter ?? ''} aria-label="Filter by application status">
              <option value="">All statuses</option>{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
            <button className="btn btn-primary">Search</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-sm"><Link className="btn btn-secondary" href="/admin/applications">Active applications</Link><Link className="btn btn-secondary" href="/admin/applications/deleted">Deleted applications</Link></div>
        </section>

        <section className="mt-6 space-y-4">
          {applications.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-950">No applications match this view</h2><p className="mt-2 text-slate-600">Adjust the search or filters to review active candidate records.</p></div> : applications.map((application) => {
            const stage = currentStage(application);
            const stageOne = application.stages.find((item) => item.stageOrder === 1);
            return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={application.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link className="font-semibold text-slate-700 underline-offset-4 hover:underline" href={`/admin/applications/${application.id}`}>{application.applicationId}</Link><span>•</span><span>Submitted {formatDate(application.createdAt)}</span></div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate name</p>
                  <h2 className="text-xl font-bold text-slate-950"><Link className="underline-offset-4 hover:underline" href={`/admin/applications/${application.id}`}>{application.applicant.fullName}</Link></h2>
                  <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div><dt className="font-semibold text-slate-500">Role</dt><dd>{application.roleAppliedFor}</dd></div>
                    <div><dt className="font-semibold text-slate-500">Email</dt><dd className="break-all">{application.applicant.email}</dd></div>
                    <div><dt className="font-semibold text-slate-500">Phone</dt><dd>{application.applicant.phoneE164 ?? application.applicant.phone ?? 'No phone'}</dd></div>
                    <div><dt className="font-semibold text-slate-500">Current stage</dt><dd>{stage ? `Stage ${stage.stageOrder}: ${stage.title}` : `Stage ${application.currentStageOrder}`}</dd></div>
                    <div><dt className="font-semibold text-slate-500">Application status</dt><dd>{application.status}</dd></div>
                    <div><dt className="font-semibold text-slate-500">Documents / submissions</dt><dd>{uploadedCount(application)} uploaded · {application.stages.reduce((total, item) => total + item.submissions.length, 0)} submissions</dd></div>
                  </dl>
                </div>
                <div className="flex flex-col gap-3 lg:min-w-52 lg:items-end">
                  <StatusBadge status={stage?.status ?? application.status} />
                  <Link className="btn btn-primary w-full justify-center lg:w-auto" href={`/admin/applications/${application.id}`}>View full profile</Link>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-600">Stage action</p>
                <form action={adminStage1Action} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="applicationDbId" value={application.id} />
                  <input className="input max-w-xs" name="notes" placeholder="Optional notes" />
                  <button className="btn btn-secondary" name="action" value="approve">Approve Stage 1</button>
                  <button className="btn btn-secondary" name="action" value="correction">Request correction</button>
                  <button className="btn btn-secondary" name="action" value="reject">Reject Stage 1</button>
                </form>
                {!stageOne ? <p className="mt-2 text-sm text-amber-700">Stage 1 data is missing; open the profile for full diagnostics.</p> : null}
              </div>
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}
