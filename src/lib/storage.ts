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
  'image/png',
  'image/webp',
]);

export function validateCvFile(file: File) {
  if (!file || file.size === 0) return 'CV/resume upload is required.';
  if (file.size > MAX_CV_BYTES) return 'CV/resume must be 20MB or smaller.';
  if (!ALLOWED_CV_MIME_TYPES.has(file.type)) return 'CV/resume must be a PDF, DOC, DOCX, JPG, PNG, or WEBP file.';
  return null;
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
