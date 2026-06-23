import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import { StatusBadge } from '@/components/StatusBadge';
import { getAdminSession } from '@/lib/admin-auth';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { permanentlyDeleteApplicationAction, restoreApplicationAction } from '../actions';

type SearchParams = Record<string, string | undefined>;

function banner(params: SearchParams) {
  const messages: string[] = [];
  if (params.success === 'permanent_deleted') messages.push('Application permanently deleted.');
  if (params.success === 'restored') messages.push('Application restored.');
  if (params.error === 'invalid_confirmation') messages.push('Confirmation did not match. No records were deleted.');
  if (params.error === 'delete_failed') messages.push('Delete failed. Please refresh and try again.');
  if (params.error === 'file_delete_failed') messages.push('Private file deletion failed, so the application was not permanently deleted.');
  return messages;
}

function formatDate(value?: Date | null) { return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : 'Missing'; }

export default async function DeletedApplications({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, adminSession] = await Promise.all([searchParams, getAdminSession()]);
  console.info('adminSessionPresentOnPageLoad', { page: '/admin/applications/deleted', present: Boolean(adminSession) });
  if (!adminSession) redirect('/admin/login');
  if (!isDatabaseConfigured()) return <main>DATABASE_URL is required for admin records.</main>;

  const applications = await prisma.jobApplication.findMany({
    where: { deletedAt: { not: null } },
    include: { applicant: true, stages: { orderBy: { stageOrder: 'asc' } } },
    orderBy: { deletedAt: 'desc' },
    take: 100,
  });

  return <main className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Internal HR workspace</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Deleted applications</h1><p className="mt-2 max-w-3xl text-slate-600">Soft-deleted candidate records awaiting restore or permanent deletion.</p><div className="mt-4 flex gap-2"><Link className="btn btn-secondary" href="/admin/applications">Active applications</Link></div></div>
          <div className="flex flex-col gap-2 text-sm text-slate-600 lg:items-end"><span>Signed in as {adminSession.email}</span><AdminLogoutButton /></div>
        </div>
      </header>
      {banner(params).map((message) => <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900" key={message}>{message}</p>)}
      <section className="mt-6 space-y-4">
        {applications.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-950">No deleted applications</h2><p className="mt-2 text-slate-600">Soft-deleted applications will appear here for admin recovery or permanent deletion.</p></div> : applications.map((application) => {
          const currentStage = application.stages.find((stage) => stage.stageOrder === application.currentStageOrder) ?? application.stages[0];
          return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={application.id}>
            <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold text-slate-500"><Link className="underline-offset-4 hover:underline" href={`/admin/applications/${application.id}`}>{application.applicationId}</Link></p>
                <h2 className="mt-2 text-xl font-bold text-slate-950"><Link className="underline-offset-4 hover:underline" href={`/admin/applications/${application.id}`}>{application.applicant.fullName}</Link></h2>
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3"><div><dt className="font-semibold text-slate-500">Role</dt><dd>{application.roleAppliedFor}</dd></div><div><dt className="font-semibold text-slate-500">Status</dt><dd>{application.status}</dd></div><div><dt className="font-semibold text-slate-500">Deleted</dt><dd>{formatDate(application.deletedAt)}</dd></div><div><dt className="font-semibold text-slate-500">Deleted by</dt><dd>{application.deletedByAdminEmail ?? 'unknown admin'}</dd></div><div className="md:col-span-2"><dt className="font-semibold text-slate-500">Reason</dt><dd>{application.deleteReason || 'No reason provided'}</dd></div></dl>
              </div>
              <div className="flex flex-col gap-3 lg:items-end"><StatusBadge status={currentStage?.status ?? application.status} /><Link className="btn btn-primary" href={`/admin/applications/${application.id}`}>View full profile</Link></div>
            </div>
            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[auto_1fr]">
              <form action={restoreApplicationAction}><input type="hidden" name="applicationDbId" value={application.id} /><button className="btn btn-secondary">Restore application</button></form>
              <form action={permanentlyDeleteApplicationAction} className="flex flex-wrap items-end gap-2 rounded-2xl border border-red-200 bg-red-50 p-4">
                <input type="hidden" name="applicationDbId" value={application.id} />
                <label className="text-sm font-semibold text-red-800">Permanent delete confirmation<span className="block text-xs font-normal text-red-700">Type {application.applicationId} to permanently delete this application.</span><input className="input mt-1 max-w-xs" name="confirmationApplicationId" placeholder={application.applicationId} required /></label>
                <button className="rounded-full bg-red-700 px-5 py-2 font-semibold text-white hover:bg-red-800">Permanently delete</button>
              </form>
            </div>
          </article>;
        })}
      </section>
    </div>
  </main>;
}
