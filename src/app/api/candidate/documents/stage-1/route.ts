import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/security';
import { isStage1DownloadEligible, sanitizeDownloadFilenamePart, toStageStatus } from '@/lib/hiring';
import { renderSubmittedDocumentPdf } from '@/lib/pdf';

function logDownloadDiagnostics(diagnostics: Record<string, unknown>) {
  console.info('candidateDocumentDownloadDiagnostics', diagnostics);
}

export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get('session');
  const diagnostics: Record<string, unknown> = {
    documentDownloadRequested: true,
    sessionPresent: Boolean(session),
    sessionValid: false,
    applicationFound: false,
    stageFound: false,
    submissionFound: false,
    submissionSubmitted: false,
    signatureFound: false,
    signatureConfirmed: false,
    signedAtPresent: false,
    stageStatus: null,
    documentEligible: false,
    pdfGenerated: false,
    responseStatus: 401,
  };

  if (!session) {
    logDownloadDiagnostics(diagnostics);
    return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const access = await prisma.applicationAccessCode.findFirst({
      where: { verifiedSessionTokenHash: sha256(session), sessionExpiresAt: { gt: new Date() } },
      include: {
        application: {
          include: {
            applicant: true,
            documents: true,
            stages: { where: { stageOrder: 1 }, include: { submissions: { include: { signature: true } } } },
          },
        },
      },
    });

    diagnostics.sessionValid = Boolean(access);
    const app = access?.application;
    diagnostics.applicationFound = Boolean(app);
    const stage = app?.stages[0];
    diagnostics.stageFound = Boolean(stage);
    diagnostics.stageStatus = stage?.status ?? null;
    const submission = stage?.submissions[0];
    diagnostics.submissionFound = Boolean(submission);
    diagnostics.submissionSubmitted = Boolean(submission?.submittedAt);
    const signature = submission?.signature;
    diagnostics.signatureFound = Boolean(signature);
    diagnostics.signatureConfirmed = Boolean(signature?.confirmed);
    diagnostics.signedAtPresent = Boolean(signature?.signedAt);

    const documentEligible = isStage1DownloadEligible({
      stagePresent: Boolean(stage),
      submissionPresent: Boolean(submission),
      submissionSubmitted: Boolean(submission?.submittedAt),
      signaturePresent: Boolean(signature),
      signatureConfirmed: Boolean(signature?.confirmed),
      signedAtPresent: Boolean(signature?.signedAt),
      stageStatus: toStageStatus(stage?.status),
    });
    diagnostics.documentEligible = documentEligible;

    if (!app || !stage || !submission?.submittedAt || !signature?.signedAt || !documentEligible) {
      diagnostics.responseStatus = 403;
      logDownloadDiagnostics(diagnostics);
      return new NextResponse('Document unavailable', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const payload = submission.payload as Record<string, string>;
    const pdf = await renderSubmittedDocumentPdf({
      title: 'Stage 1 Initial Application Submitted Form',
      applicantName: app.applicant.fullName,
      applicationId: app.applicationId,
      role: app.roleAppliedFor,
      fields: [
        ['First name', 'firstName'], ['Initial / Middle Initial', 'middleInitial'], ['Last name', 'lastName'], ['Full legal name', 'fullName'], ['Email', 'email'], ['Country', 'phoneCountryName'], ['Phone number', 'phoneE164'], ['Location', 'location'], ['Role selected', 'role'], ['Role applied for', 'roleAppliedFor'], ['Work mode preference', 'workMode'], ['Experience level', 'experienceLevel'], ['Skills', 'skills'], ['Portfolio link', 'portfolioUrl'], ['Message', 'message'],
      ].map(([label, key]) => ({ label, value: payload[key] ?? '' })),
      documents: app.documents.map((document) => ({ label: document.kind, value: `${document.fileName} (${document.mimeType}, ${document.sizeBytes} bytes)` })),
      signatureName: signature.typedName,
      submittedAt: submission.submittedAt.toISOString(),
      signedAt: signature.signedAt.toISOString(),
      version: submission.version,
      status: submission.status,
    });
    diagnostics.pdfGenerated = true;

    await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'applicant', action: 'Document downloaded', metadata: { document: 'stage-1-submitted-form' } } });
    diagnostics.responseStatus = 200;
    logDownloadDiagnostics(diagnostics);
    const filename = `${sanitizeDownloadFilenamePart(app.applicationId)}-stage-1-official.pdf`;
    return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    diagnostics.responseStatus = 500;
    diagnostics.errorName = error instanceof Error ? error.name : 'UnknownError';
    logDownloadDiagnostics(diagnostics);
    return new NextResponse('Document unavailable', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
