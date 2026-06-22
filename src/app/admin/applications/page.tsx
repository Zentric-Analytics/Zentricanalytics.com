import Link from 'next/link';
import type { Prisma } from '@prisma/client';

import { StatusBadge } from '@/components/StatusBadge';
import { stages } from '@/lib/hiring';
import { prisma, isDatabaseConfigured } from '@/lib/prisma';
import { getAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

import { adminStage1Action } from './actions';

type AdminApplicationListItem = Prisma.JobApplicationGetPayload<{
  include: {
    applicant: true;
    stages: {
      include: {
        submissions: {
          include: {
            signature: true;
            documents: {
              include: {
                uploadedDocument: true;
              };
            };
          };
        };
        approvals: true;
      };
    };
    emails: true;
    auditLogs: true;
  };
}>;

type ApplicationStage = AdminApplicationListItem['stages'][number];
type ApplicantDocument = ApplicationStage['submissions'][number]['documents'][number];
type EmailNotification = AdminApplicationListItem['emails'][number];
type AuditLog = AdminApplicationListItem['auditLogs'][number];

type SearchParams = Record<string, string | undefined>;

export default async function AdminApplications({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const adminSession = await getAdminSession();
  if (!adminSession) redirect('/admin/login');

  if (!isDatabaseConfigured()) {
    return <main>DATABASE_URL is required for admin records.</main>;
  }

  const query = params.q;
  const applications = await prisma.jobApplication.findMany({
    where: query
      ? {
          OR: [
            { applicationId: { contains: query, mode: 'insensitive' } },
            { roleAppliedFor: { contains: query, mode: 'insensitive' } },
            {
              applicant: {
                is: { fullName: { contains: query, mode: 'insensitive' } },
              },
            },
            {
              applicant: {
                is: { email: { contains: query, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {},
    include: {
      applicant: true,
      stages: {
        orderBy: { stageOrder: 'asc' },
        include: {
          submissions: {
            include: {
              signature: true,
              documents: { include: { uploadedDocument: true } },
            },
          },
          approvals: true,
        },
      },
      emails: true,
      auditLogs: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Hiring admin dashboard</h1>
      <p className="mt-2 text-slate-600">
        Protected by admin session. Records below are live database
        records.
      </p>

      <form className="my-6 grid gap-3 md:grid-cols-4">
        <input
          className="input"
          name="q"
          defaultValue={query}
          placeholder="Search name, email, role, ID"
        />
        <select className="input" name="stage">
          <option>All stages</option>
          {stages.map((stage) => (
            <option key={stage.key}>{stage.title}</option>
          ))}
        </select>
        <select className="input" name="status">
          <option>All statuses</option>
          <option>Under Review</option>
          <option>Correction Requested</option>
          <option>Approved</option>
        </select>
        <button className="btn btn-primary">Search</button>
      </form>

      <section className="space-y-6">
        {applications.map((application: AdminApplicationListItem) => {
          const stageOne = application.stages.find(
            (stage: ApplicationStage) => stage.stageOrder === 1,
          );
          const submission = stageOne?.submissions[0];
          const documents = submission?.documents ?? [];

          return (
            <article className="card p-5" key={application.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold">
                    <Link
                      href={`/admin/applications/${application.id}`}
                    >
                      {application.applicationId}
                    </Link>
                  </h2>
                  <p>
                    {application.applicant.fullName} · {application.applicant.email}
                  </p>
                  <p>{application.roleAppliedFor} · {application.experienceLevel ?? 'Experience not provided'}</p><p>{application.applicant.phoneCountryName ?? 'Country not captured'} · {application.applicant.phoneE164 ?? application.applicant.phone ?? 'No phone'}</p>
                </div>
                <StatusBadge status={stageOne?.status ?? application.status} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="font-semibold">Stage 1 answers</h3>
                  <p>{application.message}</p>
                  <p>Skills: {application.skills}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Uploaded document metadata</h3>
                  {documents.length > 0 ? (
                    documents.map((document: ApplicantDocument) => (
                      <p key={document.id}>
                        {document.uploadedDocument.fileName} (
                        {document.uploadedDocument.mimeType},{' '}
                        {document.uploadedDocument.sizeBytes} bytes)
                      </p>
                    ))
                  ) : (
                    <p>No uploaded documents found.</p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">Signature</h3>
                  <p>
                    {submission?.signature?.typedName ?? 'Missing signature'} ·{' '}
                    {submission?.signature?.confirmed ? 'Confirmed' : 'Missing'}
                  </p>
                </div>
              </div>

              <details className="mt-4">
                <summary>Email history and audit logs</summary>
                <ul>
                  {application.emails.map((email: EmailNotification) => (
                    <li key={email.id}>
                      {email.template}: {email.status}
                    </li>
                  ))}
                  {application.auditLogs.map((log: AuditLog) => (
                    <li key={log.id}>{log.action}</li>
                  ))}
                </ul>
              </details>

              <form action={adminStage1Action} className="mt-4 flex flex-wrap gap-2">
                <input
                  type="hidden"
                  name="applicationDbId"
                  value={application.id}
                />
                <input
                  className="input max-w-xs"
                  name="notes"
                  placeholder="Optional notes"
                />
                <button className="btn btn-secondary" name="action" value="approve">
                  Approve Stage 1
                </button>
                <button
                  className="btn btn-secondary"
                  name="action"
                  value="correction"
                >
                  Request correction
                </button>
                <button className="btn btn-secondary" name="action" value="reject">
                  Reject
                </button>
              </form>
            </article>
          );
        })}
      </section>
    </main>
  );
}
