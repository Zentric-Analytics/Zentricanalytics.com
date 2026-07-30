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
export const LOCAL_PRIVATE_PROVIDER = "local-private";
export class PrivateUploadStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateUploadStorageConfigurationError";
  }
}

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

export function validateOnboardingDocumentFile(file: File | null | undefined) {
  if (!file || file.size === 0) return null;
  return validateCvFile(file);
}

export function selectedStorageProvider() {
  return process.env.PRIVATE_OBJECT_STORAGE_PROVIDER || LOCAL_PRIVATE_PROVIDER;
}

function assertLocalPrivateProvider(provider: string, operation: string) {
  if (provider !== LOCAL_PRIVATE_PROVIDER)
    throw new Error(
      `${provider} storage is configured but no private ${operation} adapter is enabled in this build.`,
    );
}

function sanitizeStorageSegment(value: string) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^\.+$/, "_");
  return sanitized || "upload";
}

function isProductionLikeRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.APP_ENV === "production" ||
    process.env.APP_ENV === "staging"
  );
}

export function privateUploadRoot() {
  return path.resolve(
    process.env.PRIVATE_UPLOAD_ROOT ??
      path.join(process.cwd(), ".private-uploads"),
  );
}

export function assertPrivateUploadStorageConfigured() {
  const provider = selectedStorageProvider();
  assertLocalPrivateProvider(provider, "object storage");
  if (
    provider === LOCAL_PRIVATE_PROVIDER &&
    isProductionLikeRuntime() &&
    !process.env.PRIVATE_UPLOAD_ROOT
  ) {
    throw new PrivateUploadStorageConfigurationError(
      "PRIVATE_UPLOAD_ROOT must be configured for local-private uploads in production/staging. Local .private-uploads storage is not safe on ephemeral hosting.",
    );
  }
}

export async function ensurePrivateUploadStorageWritable() {
  assertPrivateUploadStorageConfigured();
  const provider = selectedStorageProvider();
  assertLocalPrivateProvider(provider, "write");
  const root = privateUploadRoot();
  try {
    await mkdir(root, { recursive: true });
    await access(root, constants.R_OK | constants.W_OK);
    const metadata = await stat(root);
    if (!metadata.isDirectory()) {
      throw new PrivateUploadStorageConfigurationError(
        "PRIVATE_UPLOAD_ROOT must point to a writable private directory.",
      );
    }
  } catch (error) {
    if (error instanceof PrivateUploadStorageConfigurationError) throw error;
    throw new PrivateUploadStorageConfigurationError(
      `PRIVATE_UPLOAD_ROOT is not writable by the app: ${root}`,
    );
  }
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

export async function savePrivateUpload(file: File, applicationId: string) {
  const provider = selectedStorageProvider();
  await ensurePrivateUploadStorageWritable();
  const safeApplicationId = sanitizeStorageSegment(applicationId);
  const safeName = sanitizeStorageSegment(file.name);
  const key = path.join(safeApplicationId, `${randomToken(12)}-${safeName}`);
  const fullPath = resolvePrivateUploadPath(key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, bytes, { flag: "wx" });
  const verified = await privateUploadExists(key, provider);
  const metadata = verified ? await stat(fullPath) : null;
  console.info("privateUploadSaveDiagnostic", {
    applicationId,
    provider,
    storageKeyPresent: Boolean(key),
    privateUploadRootConfigured: Boolean(process.env.PRIVATE_UPLOAD_ROOT),
    fileExistsAfterSave: verified,
    diskSizeBytes: metadata?.size ?? null,
    databaseMetadataSizeBytes: file.size,
  });
  if (!verified || metadata?.size !== bytes.length) {
    await rm(fullPath, { force: true });
    throw new Error("Private upload write verification failed.");
  }
  return {
    storageKey: key,
    provider: LOCAL_PRIVATE_PROVIDER,
    restricted: true,
  };
}

export async function deletePrivateUpload(
  storageKey: string,
  provider = LOCAL_PRIVATE_PROVIDER,
) {
  if (provider !== LOCAL_PRIVATE_PROVIDER) return;
  await rm(resolvePrivateUploadPath(storageKey), { force: true });
}

export async function readPrivateUpload(
  storageKey: string,
  provider = LOCAL_PRIVATE_PROVIDER,
) {
  assertLocalPrivateProvider(provider, "read");
  const fullPath = resolvePrivateUploadPath(storageKey);
  const [buffer, metadata] = await Promise.all([
    readFile(fullPath),
    stat(fullPath),
  ]);
  return { buffer, metadata, sizeBytes: metadata.size };
}

export function sanitizeDownloadFilename(name: string) {
  const sanitized = name
    .replace(/[/\r\n\0]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .trim();
  return sanitized || "document";
}

export async function privateUploadExists(
  storageKey: string,
  provider = LOCAL_PRIVATE_PROVIDER,
) {
  if (provider !== LOCAL_PRIVATE_PROVIDER) return false;
  try {
    await access(resolvePrivateUploadPath(storageKey), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(target: string) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathWritable(target: string) {
  try {
    await access(target, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function privateUploadDiagnostic(
  storageKey?: string | null,
  provider = selectedStorageProvider(),
) {
  const root = privateUploadRoot();
  const rootExists = await pathExists(root);
  const rootWritable = rootExists ? await pathWritable(root) : false;
  const rootConfigured = Boolean(process.env.PRIVATE_UPLOAD_ROOT);
  const storageKeyPresent = Boolean(storageKey);
  const localPrivateStorageAvailable = provider === LOCAL_PRIVATE_PROVIDER;
  let expectedResolvedFilePath: string | null = null;
  let fileExists = false;
  let fileSizeOnDisk: number | null = null;
  if (storageKeyPresent && localPrivateStorageAvailable) {
    try {
      expectedResolvedFilePath = resolvePrivateUploadPath(storageKey!);
      const metadata = await stat(expectedResolvedFilePath);
      fileExists = metadata.isFile();
      fileSizeOnDisk = fileExists ? metadata.size : null;
    } catch {
      fileExists = false;
    }
  }
  return {
    provider,
    storageKeyPresent,
    privateUploadRootConfigured: rootConfigured,
    resolvedPrivateUploadRoot: root,
    localPrivateStorageAvailable,
    fileExists,
    rootExists,
    rootWritable,
    expectedResolvedFilePath,
    fileSizeOnDisk,
  };
}

export async function privateUploadConfigurationStatus() {
  const rootConfigured = Boolean(process.env.PRIVATE_UPLOAD_ROOT);
  const root = privateUploadRoot();
  const rootExists = await pathExists(root);
  const rootWritable = rootExists ? await pathWritable(root) : false;
  return {
    provider: selectedStorageProvider(),
    appEnv: process.env.APP_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    rootConfigured,
    resolvedPrivateUploadRoot: root,
    rootExists,
    rootWritable,
    localPrivateStorageAvailable:
      selectedStorageProvider() === LOCAL_PRIVATE_PROVIDER,
    localPrivateUsesDefaultEphemeralPath: !rootConfigured,
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
export const ALLOWED_ID_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

export function validateIdentityDocumentFile(
  file: File | null | undefined,
  requiredMessage: string,
) {
  if (!file || file.size === 0) return requiredMessage;
  if (file.size > MAX_CV_BYTES) return "Upload a file that is 20MB or smaller.";
  const extension = fileExtension(file.name);
  const extensionAllowed = ALLOWED_ID_DOCUMENT_EXTENSIONS.has(extension);
  const mimeAllowed = ALLOWED_ID_DOCUMENT_MIME_TYPES.has(file.type);
  const safeFallbackMime = GENERIC_UPLOAD_MIME_TYPES.has(file.type);
  if ((mimeAllowed || safeFallbackMime) && extensionAllowed) return null;
  return "Upload a PDF, JPG, JPEG, PNG, or WEBP file.";
}
