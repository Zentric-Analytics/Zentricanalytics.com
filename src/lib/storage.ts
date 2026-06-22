import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomToken } from './security';

export const DEFAULT_UPLOAD_MAX_BYTES = 20_971_520;
const configuredUploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES);
export const MAX_CV_BYTES = Number.isFinite(configuredUploadMaxBytes) && configuredUploadMaxBytes > 0 ? configuredUploadMaxBytes : DEFAULT_UPLOAD_MAX_BYTES;
export const ALLOWED_CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/pjpeg',
  'image/jpg',
  'image/png',
  'image/x-png',
  'image/webp',
]);
export const ALLOWED_CV_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']);
const GENERIC_UPLOAD_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function validateCvFile(file: File | null | undefined) {
  if (!file || file.size === 0) return 'Upload your CV/resume or supporting document.';
  if (file.size > MAX_CV_BYTES) return 'Upload a file that is 20MB or smaller.';
  const extension = fileExtension(file.name);
  const extensionAllowed = ALLOWED_CV_EXTENSIONS.has(extension);
  const mimeAllowed = ALLOWED_CV_MIME_TYPES.has(file.type);
  const safeFallbackMime = GENERIC_UPLOAD_MIME_TYPES.has(file.type);
  if (mimeAllowed && extensionAllowed) return null;
  if (safeFallbackMime && extensionAllowed) return null;
  return 'Upload a PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP file.';
}

export async function savePrivateUpload(file: File, applicationId: string) {
  const root = process.env.PRIVATE_UPLOAD_ROOT ?? path.join(process.cwd(), '.private-uploads');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = path.join(applicationId, `${randomToken(12)}-${safeName}`);
  const fullPath = path.join(root, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  return { storageKey: key, provider: 'local-private' };
}
