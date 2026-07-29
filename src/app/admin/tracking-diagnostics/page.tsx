import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import { getAdminSession } from '@/lib/admin-auth';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { maskEmail, maskGeneric } from '@/lib/security';

export default async function TrackingDiagnosticsPage() {
  const adminSession = await getAdminSession();
  console.info('adminSessionPresentOnPageLoad', { page: '/admin/tracking-diagnostics', present: Boolean(adminSession) });
  if (!adminSession) redirect('/admin/login');

  if (!isDatabaseConfigured()) {
    return <main>DATABASE_URL is required for tracking diagnostics.</main>;
  }

  const [emails, rateLimitEvents, stageEmails, stageAuditLogs] = await Promise.all([
    prisma.emailNotification.findMany({
      where: { template: 'access-code' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, applicationId: true, toEmail: true, template: true, subject: true, status: true, providerMessageId: true, failureReason: true, createdAt: true },
    }),
    prisma.rateLimitEvent.findMany({
      where: { scope: { in: ['access-code-request', 'access-code-verify'] } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.emailNotification.findMany({
      where: { template: { in: ['stage-2-unlocked', 'application-rejected', 'correction-requested'] } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, applicationId: true, toEmail: true, template: true, status: true, providerMessageId: true, failureReason: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ['Admin approved Stage 1', 'Admin rejected Stage 1', 'Admin requested correction', 'Admin approval skipped; Stage 1 already approved'] } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, applicationId: true, actorType: true, action: true, createdAt: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tracking diagnostics</h1>
          <p className="mt-2 text-slate-600">Admin-only staging view for access-code email attempts and rate limiting. OTP codes, secrets, candidate session tokens, and private applicant details are not shown.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:items-end">
          <span>Signed in as {adminSession.email}</span>
          <Link className="btn btn-secondary" href="/admin/applications">Applications</Link>
          <AdminLogoutButton />
        </div>
      </header>

      <section className="mt-8 card overflow-x-auto p-5">
        <h2 className="text-xl font-bold">Recent access-code emails</h2>
        <table className="mt-4 min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Created</th><th className="p-2">Application</th><th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Provider ID</th><th className="p-2">Failure</th></tr></thead>
          <tbody>
            {emails.map((email) => (
              <tr className="border-t" key={email.id}>
                <td className="p-2">{email.createdAt.toISOString()}</td>
                <td className="p-2">{maskGeneric(email.applicationId)}</td>
                <td className="p-2">{maskEmail(email.toEmail)}</td>
                <td className="p-2 font-semibold">{email.status}</td>
                <td className="p-2">{email.providerMessageId ?? 'Not provided'}</td>
                <td className="p-2">{email.failureReason ?? 'Not provided'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 card overflow-x-auto p-5">
        <h2 className="text-xl font-bold">Recent stage-action emails</h2>
        <table className="mt-4 min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Created</th><th className="p-2">Application</th><th className="p-2">Email</th><th className="p-2">Template</th><th className="p-2">Status</th><th className="p-2">Failure</th></tr></thead>
          <tbody>{stageEmails.map((email) => (<tr className="border-t" key={email.id}><td className="p-2">{email.createdAt.toISOString()}</td><td className="p-2">{maskGeneric(email.applicationId)}</td><td className="p-2">{maskEmail(email.toEmail)}</td><td className="p-2">{email.template}</td><td className="p-2 font-semibold">{email.status}</td><td className="p-2">{email.failureReason ?? 'Not provided'}</td></tr>))}</tbody>
        </table>
      </section>

      <section className="mt-8 card overflow-x-auto p-5">
        <h2 className="text-xl font-bold">Recent stage-action audit logs</h2>
        <table className="mt-4 min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Created</th><th className="p-2">Application</th><th className="p-2">Actor</th><th className="p-2">Action</th></tr></thead>
          <tbody>{stageAuditLogs.map((log) => (<tr className="border-t" key={log.id}><td className="p-2">{log.createdAt.toISOString()}</td><td className="p-2">{log.applicationId ? maskGeneric(log.applicationId) : 'Not provided'}</td><td className="p-2">{log.actorType}</td><td className="p-2">{log.action}</td></tr>))}</tbody>
        </table>
      </section>

      <section className="mt-8 card overflow-x-auto p-5">
        <h2 className="text-xl font-bold">Recent rate-limit events</h2>
        <table className="mt-4 min-w-full text-left text-sm">
          <thead><tr><th className="p-2">Created</th><th className="p-2">Scope</th><th className="p-2">Key hash prefix</th></tr></thead>
          <tbody>
            {rateLimitEvents.map((event) => (
              <tr className="border-t" key={event.id}>
                <td className="p-2">{event.createdAt.toISOString()}</td>
                <td className="p-2">{event.scope}</td>
                <td className="p-2">{event.keyHash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
