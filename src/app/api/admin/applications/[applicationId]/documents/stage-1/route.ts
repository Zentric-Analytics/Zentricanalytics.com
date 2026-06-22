import { NextResponse } from 'next/server';

import { requireAdminSession } from '@/lib/admin-auth';
import { sanitizeDownloadFilenamePart } from '@/lib/hiring';
import { renderSubmittedDocumentPdf } from '@/lib/pdf';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  let adminSession;
  try {
    adminSession = await requireAdminSession();
  } catch {
    return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { applicationId } = await params;
  const app = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: true,
      documents: true,
      stages: { where: { stageOrder: 1 }, include: { submissions: { include: { signature: true } } } },
    },
  });
  if (!app) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const stage = app.stages[0];
  const submission = stage?.submissions[0];
  const signature = submission?.signature;
  if (!submission?.submittedAt || !signature?.confirmed || !signature.signedAt) {
    return new NextResponse('Stage 1 PDF is not available yet.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const payload = submission.payload as Record<string, string>;
  const fieldValue = (key: string, fallback = '') => payload[key] ?? fallback;
  const pdf = await renderSubmittedDocumentPdf({
    title: 'Stage 1 Initial Application Submitted Form',
    applicantName: app.applicant.fullName,
    applicationId: app.applicationId,
    role: app.roleAppliedFor,
    fields: [
      { label: 'First name', value: fieldValue('firstName', app.applicant.firstName ?? '') },
      { label: 'Middle initial', value: fieldValue('middleInitial', app.applicant.middleInitial ?? '') },
      { label: 'Last name', value: fieldValue('lastName', app.applicant.lastName ?? '') },
      { label: 'Full legal name', value: fieldValue('fullName', app.applicant.fullName) },
      { label: 'Email', value: fieldValue('email', app.applicant.email) },
      { label: 'Phone display', value: [fieldValue('phoneCountryName', app.applicant.phoneCountryName ?? ''), fieldValue('phoneE164', app.applicant.phoneE164 ?? app.applicant.phone ?? '')].filter(Boolean).join(' ') },
      { label: 'Location', value: fieldValue('location', app.applicant.location ?? '') },
      { label: 'Role applied for', value: fieldValue('roleAppliedFor', app.roleAppliedFor) },
      { label: 'Work mode', value: fieldValue('workMode', app.workModePreference ?? '') },
      { label: 'Skills', value: fieldValue('skills', app.skills ?? '') },
      { label: 'Portfolio URL', value: fieldValue('portfolioUrl', app.portfolioUrl ?? '') },
      { label: 'Message', value: fieldValue('message', app.message ?? '') },
      { label: 'Declaration accuracy', value: fieldValue('declarationAccuracy') },
      { label: 'Privacy consent', value: app.privacyConsent ? 'true' : '' },
    ],
    documents: app.documents.map((document: { kind: string; fileName: string; mimeType: string; sizeBytes: number }) => ({ label: document.kind, value: `${document.fileName} (${document.mimeType}, ${document.sizeBytes} bytes)` })),
    signatureName: signature.typedName,
    submittedAt: submission.submittedAt.toISOString(),
    signedAt: signature.signedAt.toISOString(),
    version: submission.version,
    status: submission.status,
  });

  await prisma.auditLog.create({ data: { applicationId: app.id, actorType: 'admin', actorRef: adminSession.email, action: 'Admin downloaded Stage 1 PDF', metadata: { document: 'stage-1-official' } } });
  const filename = `${sanitizeDownloadFilenamePart(app.applicationId)}-stage-1-official.pdf`;
  return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
