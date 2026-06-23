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

function formatDate(value?: Date | null) { return value ? value.toISOString() : 'Missing'; }

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

  return <main className="mx-auto max-w-6xl px-4 py-10">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-3xl font-bold">Deleted applications</h1><p className="mt-2 text-slate-600">Trash view for soft-deleted candidate application records.</p><Link className="btn btn-secondary mt-4" href="/admin/applications">Active applications</Link></div>
      <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end"><span>Signed in as {adminSession.email}</span><AdminLogoutButton /></div>
    </header>
    {banner(params).map((message) => <p className="card mt-4 border border-amber-200 bg-amber-50 p-4 text-sm" key={message}>{message}</p>)}
    <section className="mt-6 space-y-5">
      {applications.length === 0 ? <p className="card p-5">No deleted applications.</p> : applications.map((application) => {
        const stageOne = application.stages.find((stage) => stage.stageOrder === 1);
        return <article className="card p-5" key={application.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold"><Link href={`/admin/applications/${application.id}`}>{application.applicationId}</Link></h2>
              <p>{application.applicant.fullName}</p>
              <p>{application.roleAppliedFor} · {application.status}</p>
              <p className="text-sm text-slate-600">Deleted {formatDate(application.deletedAt)} by {application.deletedByAdminEmail ?? 'unknown admin'}</p>
              <p className="text-sm text-slate-600">Reason: {application.deleteReason || 'No reason provided'}</p>
            </div>
            <StatusBadge status={stageOne?.status ?? application.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="btn btn-secondary" href={`/admin/applications/${application.id}`}>View full profile</Link>
            <form action={restoreApplicationAction}><input type="hidden" name="applicationDbId" value={application.id} /><button className="btn btn-secondary">Restore application</button></form>
            <form action={permanentlyDeleteApplicationAction} className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 p-3">
              <input type="hidden" name="applicationDbId" value={application.id} />
              <label className="text-sm font-semibold">Type {application.applicationId}</label>
              <input className="input max-w-xs" name="confirmationApplicationId" placeholder={application.applicationId} required />
              <button className="btn bg-red-700 text-white hover:bg-red-800">Permanently delete</button>
            </form>
          </div>
        </article>;
      })}
    </section>
  </main>;
}
