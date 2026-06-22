import { NextRequest, NextResponse } from 'next/server';

import { requireAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { readPrivateUpload, sanitizeDownloadFilename } from '@/lib/storage';

const PREVIEW_SAFE_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function GET(request: NextRequest, { params }: { params: Promise<{ applicationId: string; documentId: string }> }) {
  let adminSession;
  try {
    adminSession = await requireAdminSession();
  } catch {
    return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { applicationId, documentId } = await params;
  const document = await prisma.uploadedDocument.findFirst({ where: { id: documentId, applicationId } });
  if (!document) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const wantsDownload = request.nextUrl.searchParams.get('download') === '1';
  const inline = !wantsDownload && PREVIEW_SAFE_MIME_TYPES.has(document.mimeType);
  const file = await readPrivateUpload(document.storageKey, document.provider);
  const filename = sanitizeDownloadFilename(document.fileName);

  await prisma.auditLog.create({
    data: {
      applicationId,
      actorType: 'admin',
      actorRef: adminSession.email,
      action: inline ? 'Admin viewed uploaded document' : 'Admin downloaded uploaded document',
      metadata: { documentId: document.id, disposition: inline ? 'inline' : 'attachment' },
    },
  });

  return new NextResponse(file.buffer, {
    headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
