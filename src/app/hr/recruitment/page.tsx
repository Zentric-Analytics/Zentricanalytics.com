import Link from 'next/link';
import { requireAuthenticatedUser } from '@/lib/hr/permissions/authorize';
import { prisma } from '@/lib/prisma';

export default async function RecruitmentWorkspace() {
  const auth = await requireAuthenticatedUser();
  const now = new Date();
  const oversight = auth.roles.some((role) => role === 'ADMIN' || role === 'HR_ADMIN');
  const vacancies = await prisma.hrVacancy.findMany({ where: {
    organizationId: auth.user.organizationId,
    ...(oversight ? {} : { OR: [
      { createdById: auth.user.id }, { responsibleHrUserId: auth.user.id },
      { hiringTeam: { status: 'ACTIVE' as const, members: { some: {
        userId: auth.user.id, status: 'ACTIVE' as const, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      } } } },
    ] }),
  }, select: { id: true } });
  const applications = await prisma.jobApplication.findMany({ where: {
    organizationId: auth.user.organizationId, deletedAt: null,
    ...(oversight ? {} : { vacancyId: { in: vacancies.map((v) => v.id) } }),
  }, include: { applicant: true }, orderBy: { createdAt: 'desc' } });
  return <main className="space-y-4 p-6"><h1 className="text-2xl font-bold">Recruitment stages</h1>
    <p>Review the preserved application stages. Actions are restricted to the assigned team, creator or delegate, and named HR person. Applications without a vacancy link cannot be changed.</p>
    {applications.map((app) => <article key={app.id} className="rounded border p-4"><Link href={`/hr/recruitment/${app.id}`}>{app.applicant.fullName} — {app.applicationId}</Link><p>Stage {app.currentStageOrder}: {app.status}</p></article>)}
  </main>;
}
