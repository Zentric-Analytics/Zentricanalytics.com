import type { Prisma } from '@prisma/client';

import { DocumentCard } from '@/components/DocumentCard';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { stages as stageDefs, toStageStatus } from '@/lib/hiring';
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
        <Section title="Candidate portal">
          <p className="card p-6">
            Your secure session is invalid or expired. Please request a new access
            code.
          </p>
        </Section>
      </PageShell>
    );
  }

  const application = access.application;
  const stageOne = application.stages.find(
    (stage: PortalStage) => stage.stageOrder === 1,
  );
  const signed = Boolean(stageOne?.submissions[0]?.signature?.confirmed);

  return (
    <PageShell>
      <Section eyebrow="Candidate portal" title={application.applicationId}>
        <div className="card p-6">
          <p>
            <strong>Applicant:</strong> {application.applicant.fullName}
          </p>
          <p>
            <strong>Status:</strong> {application.status}
          </p>
          <p>
            <strong>Current stage:</strong> {application.currentStageOrder}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {stageDefs.map((definition) => {
            const stage = application.stages.find(
              (candidateStage: PortalStage) =>
                candidateStage.stageKey === definition.key,
            );

            return (
              <div
                className="flex items-center justify-between rounded-xl border p-3"
                key={definition.key}
              >
                <span>
                  {definition.order}. {definition.title}
                </span>
                <StatusBadge status={toStageStatus(stage?.status)} />
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <DocumentCard
            title="Signed Stage 1 Submitted Form"
            status={toStageStatus(stageOne?.status)}
            signed={signed}
            submittedAt={stageOne?.submittedAt?.toISOString()}
          />
          {signed && stageOne?.submittedAt ? (
            <a
              className="btn btn-primary"
              href={`/api/candidate/documents/stage-1?session=${encodeURIComponent(
                session!,
              )}`}
            >
              Download signed Stage 1 document
            </a>
          ) : (
            <p className="text-sm text-slate-600">
              Stage 1 download is available only after signature and submission.
            </p>
          )}
          <DocumentCard
            title="Uploaded CV/resume"
            status="Locked"
            signed={false}
          />
        </div>
      </Section>
    </PageShell>
  );
}
