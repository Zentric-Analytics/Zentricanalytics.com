import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/security';
import { canDownloadDocument, toStageStatus } from '@/lib/hiring';
import { renderSubmittedDocumentText } from '@/lib/pdf';

export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get('session');
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const access = await prisma.applicationAccessCode.findFirst({
    where: {
      verifiedSessionTokenHash: sha256(session),
      sessionExpiresAt: { gt: new Date() },
    },
    include: {
      application: {
        include: {
          applicant: true,
          documents: true,
          stages: {
            where: { stageOrder: 1 },
            include: { submissions: { include: { signature: true } } },
          },
        },
      },
    },
  });

  const app = access?.application;
  const stage = app?.stages[0];
  const submission = stage?.submissions[0];
  const signature = submission?.signature;
  if (!app || !stage || !submission || !canDownloadDocument(toStageStatus(stage.status), Boolean(signature?.confirmed), submission.submittedAt?.toISOString())) return new NextResponse('Document unavailable', { status: 403 });

  const payload = submission.payload as Record<string, string>;
  const text = renderSubmittedDocumentText({
    title: 'Stage 1 Initial Application Submitted Form',
    applicantName: app.applicant.fullName,
    applicationId: app.applicationId,
    role: app.roleAppliedFor,
    fields: [
      ['First name', 'firstName'],
      ['Initial / Middle Initial', 'middleInitial'],
      ['Last name', 'lastName'],
      ['Full legal name', 'fullName'],
      ['Email', 'email'],
      ['Country', 'phoneCountryName'],
      ['Phone number', 'phoneE164'],
      ['Location', 'location'],
      ['Role selected', 'role'],
      ['Role applied for', 'roleAppliedFor'],
      ['Work mode preference', 'workMode'],
      ['Experience level', 'experienceLevel'],
      ['Skills', 'skills'],
      ['Portfolio link', 'portfolioUrl'],
      ['Message', 'message'],
    ].map(([label, key]) => ({ label, value: payload[key] ?? '' })),
    documents: app.documents.map((document: { kind: string; fileName: string; mimeType: string; sizeBytes: number }) => ({
      label: document.kind,
      value: `${document.fileName} (${document.mimeType}, ${document.sizeBytes} bytes)`,
    })),
    signatureName: signature.typedName,
    submittedAt: submission.submittedAt!.toISOString(),
    signedAt: signature.signedAt.toISOString(),
    version: submission.version,
    status: submission.status,
  });
  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', actorRef: app.applicant.email, action: 'Document downloaded', metadata: { document: 'stage-1-submitted-form' } } });
  return new NextResponse(text, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="${app.applicationId}-stage-1-official.html"` } });
}
