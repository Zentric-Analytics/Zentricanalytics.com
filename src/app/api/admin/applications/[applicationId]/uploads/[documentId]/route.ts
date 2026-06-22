import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  privateUploadConfigurationStatus,
  readPrivateUpload,
  sanitizeDownloadFilename,
} from "@/lib/storage";

const PREVIEW_SAFE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const NO_STORE = { "Cache-Control": "no-store" };

type Diagnostic = {
  adminAuthenticated: boolean;
  applicationIdPresent: boolean;
  documentIdPresent: boolean;
  uploadedDocumentFound: boolean;
  provider: string;
  mimeType: string;
  wantsDownload: boolean;
  inlineRequested: boolean;
  privateUploadReadSucceeded: boolean;
  responseStatus: number;
  errorName?: string;
};

function logDiagnostic(diagnostic: Diagnostic) {
  console.info("adminUploadedDocumentRequest", diagnostic);
}

function safeResponse(
  message: string,
  status: number,
  diagnostic: Diagnostic,
  errorName?: string,
) {
  logDiagnostic({ ...diagnostic, responseStatus: status, errorName });
  return new NextResponse(message, { status, headers: NO_STORE });
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ applicationId: string; documentId: string }> },
) {
  const { applicationId = "", documentId = "" } = await params;
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const diagnostic: Diagnostic = {
    adminAuthenticated: false,
    applicationIdPresent: Boolean(applicationId),
    documentIdPresent: Boolean(documentId),
    uploadedDocumentFound: false,
    provider: "unknown",
    mimeType: "unknown",
    wantsDownload,
    inlineRequested: false,
    privateUploadReadSucceeded: false,
    responseStatus: 500,
  };

  let adminSession;
  try {
    adminSession = await requireAdminSession();
    diagnostic.adminAuthenticated = true;
  } catch (error) {
    return safeResponse(
      "Unauthorized",
      401,
      diagnostic,
      error instanceof Error ? error.name : "Unauthorized",
    );
  }

  const document = await prisma.uploadedDocument.findFirst({
    where: { id: documentId, applicationId },
  });
  diagnostic.uploadedDocumentFound = Boolean(document);
  if (!document) return safeResponse("Document not found", 404, diagnostic);

  diagnostic.provider = document.provider;
  diagnostic.mimeType = document.mimeType || "application/octet-stream";
  const inline =
    !wantsDownload && PREVIEW_SAFE_MIME_TYPES.has(document.mimeType);
  diagnostic.inlineRequested = inline;

  let file;
  try {
    file = await readPrivateUpload(document.storageKey, document.provider);
    diagnostic.privateUploadReadSucceeded = true;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Error";
    const storageStatus = privateUploadConfigurationStatus();
    console.warn("adminUploadedDocumentStorageUnavailable", {
      adminAuthenticated: diagnostic.adminAuthenticated,
      applicationIdPresent: diagnostic.applicationIdPresent,
      documentIdPresent: diagnostic.documentIdPresent,
      uploadedDocumentFound: diagnostic.uploadedDocumentFound,
      provider: storageStatus.provider,
      privateUploadRootConfigured: storageStatus.rootConfigured,
      localPrivateUsesDefaultEphemeralPath:
        storageStatus.localPrivateUsesDefaultEphemeralPath,
      privateUploadReadSucceeded: false,
      responseStatus: errorName === "ENOENT" ? 410 : 500,
      errorName,
    });
    const status = errorName === "ENOENT" ? 410 : 500;
    return safeResponse(
      status === 410
        ? "The file record exists, but the stored file could not be found. Re-upload may be required."
        : "Temporary document download error",
      status,
      diagnostic,
      errorName,
    );
  }

  const filename = sanitizeDownloadFilename(document.fileName);

  await prisma.auditLog.create({
    data: {
      applicationId,
      actorType: "admin",
      actorRef: adminSession.email,
      action: inline
        ? "Admin viewed uploaded document"
        : "Admin downloaded uploaded document",
      metadata: {
        documentId: document.id,
        disposition: inline ? "inline" : "attachment",
      },
    },
  });

  logDiagnostic({ ...diagnostic, responseStatus: 200 });
  return new NextResponse(file.buffer, {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
