import { constants } from "node:fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./security";

export const DEFAULT_UPLOAD_MAX_BYTES = 20_971_520;
const configuredUploadMaxBytes = Number(process.env.UPLOAD_MAX_BYTES);
export const MAX_CV_BYTES =
  Number.isFinite(configuredUploadMaxBytes) && configuredUploadMaxBytes > 0
    ? configuredUploadMaxBytes
    : DEFAULT_UPLOAD_MAX_BYTES;
export const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/pjpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
  "image/webp",
]);
export const ALLOWED_CV_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);
const GENERIC_UPLOAD_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateCvFile(file: File | null | undefined) {
  if (!file || file.size === 0)
    return "Upload your CV/resume or supporting document.";
  if (file.size > MAX_CV_BYTES) return "Upload a file that is 20MB or smaller.";
  const extension = fileExtension(file.name);
  const extensionAllowed = ALLOWED_CV_EXTENSIONS.has(extension);
  const mimeAllowed = ALLOWED_CV_MIME_TYPES.has(file.type);
  const safeFallbackMime = GENERIC_UPLOAD_MIME_TYPES.has(file.type);
  if (mimeAllowed && extensionAllowed) return null;
  if (safeFallbackMime && extensionAllowed) return null;
  return "Upload a PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP file.";
}

export function selectedStorageProvider() {
  return process.env.PRIVATE_OBJECT_STORAGE_PROVIDER || "local-private";
}

export async function savePrivateUpload(file: File, applicationId: string) {
  const provider = selectedStorageProvider();
  if (provider !== "local-private")
    throw new Error(
      `${provider} storage is configured but no private object storage adapter is enabled in this build.`,
    );
  const root =
    process.env.PRIVATE_UPLOAD_ROOT ??
    path.join(process.cwd(), ".private-uploads");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = path.join(applicationId, `${randomToken(12)}-${safeName}`);
  const fullPath = path.join(root, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
  return { storageKey: key, provider: "local-private", restricted: true };
}

export async function deletePrivateUpload(
  storageKey: string,
  provider = "local-private",
) {
  if (provider !== "local-private") return;
  await rm(resolvePrivateUploadPath(storageKey), { force: true });
}

export function privateUploadRoot() {
  return path.resolve(
    process.env.PRIVATE_UPLOAD_ROOT ??
      path.join(process.cwd(), ".private-uploads"),
  );
}

export function resolvePrivateUploadPath(storageKey: string) {
  if (!storageKey || path.isAbsolute(storageKey))
    throw new Error("Invalid private upload key.");
  const root = privateUploadRoot();
  const resolved = path.resolve(root, storageKey);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Invalid private upload key.");
  return resolved;
}

export async function readPrivateUpload(
  storageKey: string,
  provider = "local-private",
) {
  if (provider !== "local-private")
    throw new Error(
      `${provider} storage is configured but no private read adapter is enabled in this build.`,
    );
  const fullPath = resolvePrivateUploadPath(storageKey);
  const [buffer, metadata] = await Promise.all([
    readFile(fullPath),
    stat(fullPath),
  ]);
  return { buffer, metadata, sizeBytes: metadata.size };
}

export function sanitizeDownloadFilename(name: string) {
  const sanitized = name
    .replace(/[\/\r\n\0]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .trim();
  return sanitized || "document";
}

export async function privateUploadExists(
  storageKey: string,
  provider = "local-private",
) {
  if (provider !== "local-private") return false;
  try {
    await access(resolvePrivateUploadPath(storageKey), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function privateUploadConfigurationStatus() {
  const rootConfigured = Boolean(process.env.PRIVATE_UPLOAD_ROOT);
  return {
    rootConfigured,
    provider: selectedStorageProvider(),
  };
}

export const ALLOWED_ID_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/pjpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
  "image/webp",
]);
export const ALLOWED_ID_DOCUMENT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export function validateIdentityDocumentFile(file: File | null | undefined, requiredMessage: string) {
  if (!file || file.size === 0) return requiredMessage;
  if (file.size > MAX_CV_BYTES) return "Upload a file that is 20MB or smaller.";
  const extension = fileExtension(file.name);
  const extensionAllowed = ALLOWED_ID_DOCUMENT_EXTENSIONS.has(extension);
  const mimeAllowed = ALLOWED_ID_DOCUMENT_MIME_TYPES.has(file.type);
  const safeFallbackMime = GENERIC_UPLOAD_MIME_TYPES.has(file.type);
  if ((mimeAllowed || safeFallbackMime) && extensionAllowed) return null;
  return "Upload a PDF, JPG, JPEG, PNG, or WEBP file.";
}
