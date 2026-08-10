import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, GetObjectTaggingCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type PrivateObjectLocation = {
  provider: string;
  bucket?: string;
  key: string;
  versionId?: string;
  eTag?: string;
  checksum: string;
};

export type PrivateObjectMetadata = {
  sizeBytes: number;
  contentType?: string;
  versionId?: string;
  eTag?: string;
  checksum?: string;
  scanStatus?: string;
};

export type HrObjectStorage = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  head(key: string): Promise<{ sizeBytes: number; contentType?: string }>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  quarantineUpload(key: string, bytes: Uint8Array, contentType: string, checksum: string): Promise<PrivateObjectLocation>;
  headVersion(location: PrivateObjectLocation): Promise<PrivateObjectMetadata>;
  getAuthorized(location: PrivateObjectLocation): Promise<Uint8Array>;
  deleteVersion(location: PrivateObjectLocation): Promise<void>;
};

const LOCAL_PROVIDERS = new Set(["local", "local-private"]);

export function hrStorageProvider() {
  return process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase() || "local-private";
}

export function assertProductionHrStorage() {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const provider = hrStorageProvider();
  if (!LOCAL_PROVIDERS.has(provider) && !["s3-compatible", "aws-s3"].includes(provider)) {
    throw new Error("Unsupported HR object storage provider.");
  }
  if ((["staging", "production"].includes(appEnv ?? "") || process.env.NODE_ENV === "production") && LOCAL_PROVIDERS.has(provider)) {
    throw new Error("Production HR documents require private S3-compatible object storage.");
  }
}

export function s3CompatibleStorageConfigured() {
  if (!process.env.OBJECT_STORAGE_BUCKET || !process.env.OBJECT_STORAGE_REGION) return false;
  if (hrStorageProvider() === "aws-s3") return true;
  return Boolean(process.env.OBJECT_STORAGE_ENDPOINT && process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY);
}

export function validateStorageKey(key: string) {
  if (
    !key
    || key.startsWith("/")
    || key.startsWith(".")
    || key.endsWith("/")
    || key.includes("//")
    || key.split("/").some((segment) => !segment || segment === "." || segment === "..")
    || !/^[a-zA-Z0-9][a-zA-Z0-9/_\-.]*$/.test(key)
    || path.isAbsolute(key)
  ) throw new Error("Invalid HR storage key.");
  return key;
}

function safeLocalPath(root: string, key: string) {
  validateStorageKey(key);
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Invalid HR storage key.");
  return resolved;
}

export class LocalDevelopmentHrStorage implements HrObjectStorage {
  constructor(private readonly root = process.env.HR_LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), ".hr-private")) {
    if (["staging", "production"].includes(String(process.env.APP_ENV).toLowerCase())) throw new Error("Local HR storage is development-only.");
  }
  async put(key: string, bytes: Uint8Array) { const target = safeLocalPath(this.root, key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
  async get(key: string) { return new Uint8Array(await readFile(safeLocalPath(this.root, key))); }
  async head(key: string) { const metadata = await stat(safeLocalPath(this.root, key)); return { sizeBytes: metadata.size }; }
  async exists(key: string) { try { await this.head(key); return true; } catch { return false; } }
  async delete(key: string) { await rm(safeLocalPath(this.root, key), { force: true }); }
  async quarantineUpload(key: string, bytes: Uint8Array, contentType: string, checksum: string) {
    await this.put(key, bytes);
    return { provider: "local-private", key, checksum };
  }
  async headVersion(location: PrivateObjectLocation) { return { ...(await this.head(location.key)), checksum: location.checksum, scanStatus: "NO_THREATS_FOUND" }; }
  async getAuthorized(location: PrivateObjectLocation) { return this.get(location.key); }
  async deleteVersion(location: PrivateObjectLocation) { await this.delete(location.key); }
}

export class S3CompatibleHrStorageConfig {
  readonly provider = "s3-compatible";
  constructor() {
    if (!s3CompatibleStorageConfigured()) throw new Error("S3-compatible HR storage configuration is incomplete.");
  }
}

export class S3CompatibleHrStorage implements HrObjectStorage {
  private readonly bucket: string;
  private readonly client: Pick<S3Client, "send">;
  constructor(client?: Pick<S3Client, "send">) {
    if (!s3CompatibleStorageConfigured()) throw new Error("S3-compatible HR storage configuration is incomplete.");
    this.bucket = process.env.OBJECT_STORAGE_BUCKET!;
    const credentials = process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY }
      : undefined;
    this.client = client ?? new S3Client({
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT || undefined,
      region: process.env.OBJECT_STORAGE_REGION || "auto",
      forcePathStyle: hrStorageProvider() === "s3-compatible" && process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      credentials,
    });
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    await this.safeSend(() => this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(key), Body: bytes, ContentType: contentType, ServerSideEncryption: process.env.OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined })));
  }
  async get(key: string) {
    const response = await this.safeSend(() => this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(key) })));
    if (!response.Body) throw new Error("HR object was not found.");
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  async head(key: string) {
    const response = await this.safeSend(() => this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(key) })));
    return { sizeBytes: response.ContentLength ?? 0, contentType: response.ContentType };
  }
  async exists(key: string) { try { await this.head(key); return true; } catch { return false; } }
  async delete(key: string) {
    await this.safeSend(() => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(key) })));
  }
  async quarantineUpload(key: string, bytes: Uint8Array, contentType: string, checksum: string) {
    const response = await this.safeSend(() => this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: validateStorageKey(key),
      Body: bytes,
      ContentType: contentType,
      ServerSideEncryption: process.env.OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined,
      Metadata: { sha256: checksum, state: "quarantined" },
    })));
    return { provider: hrStorageProvider(), bucket: this.bucket, key, versionId: response.VersionId, eTag: response.ETag?.replaceAll('"', ""), checksum };
  }
  async headVersion(location: PrivateObjectLocation) {
    this.assertLocation(location);
    const versionId = hrStorageProvider() === "aws-s3" ? location.versionId : undefined;
    const response = await this.safeSend(() => this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(location.key), VersionId: versionId })));
    let scanStatus: string | undefined;
    if (hrStorageProvider() === "aws-s3") {
      const tags = await this.safeSend(() => this.client.send(new GetObjectTaggingCommand({ Bucket: this.bucket, Key: validateStorageKey(location.key), VersionId: location.versionId })));
      scanStatus = tags.TagSet?.find((tag) => tag.Key === "GuardDutyMalwareScanStatus")?.Value;
    }
    return { sizeBytes: response.ContentLength ?? 0, contentType: response.ContentType, versionId: response.VersionId, eTag: response.ETag?.replaceAll('"', ""), checksum: response.Metadata?.sha256, scanStatus };
  }
  async getAuthorized(location: PrivateObjectLocation) {
    const metadata = await this.headVersion(location);
    if (metadata.checksum !== location.checksum) throw new Error("Private HR object checksum metadata does not match the immutable document version.");
    if (hrStorageProvider() === "aws-s3" && metadata.scanStatus !== "NO_THREATS_FOUND") throw new Error("Private HR object is not released by the malware-scanning provider.");
    const response = await this.safeSend(() => this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(location.key), VersionId: hrStorageProvider() === "aws-s3" ? location.versionId : undefined })));
    if (!response.Body) throw new Error("HR object was not found.");
    return new Uint8Array(await response.Body.transformToByteArray());
  }
  async deleteVersion(location: PrivateObjectLocation) {
    this.assertLocation(location);
    await this.safeSend(() => this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: validateStorageKey(location.key), VersionId: hrStorageProvider() === "aws-s3" ? location.versionId : undefined })));
  }
  private assertLocation(location: PrivateObjectLocation) {
    if (location.bucket && location.bucket !== this.bucket) throw new Error("Private HR object bucket does not match the configured provider.");
    if (hrStorageProvider() === "aws-s3" && !location.versionId) throw new Error("AWS private HR objects require an immutable version ID.");
  }
  private async safeSend<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch {
      throw new Error("Private HR storage operation failed.");
    }
  }
}

export function hrObjectStorage(): HrObjectStorage {
  assertProductionHrStorage();
  return LOCAL_PROVIDERS.has(hrStorageProvider()) ? new LocalDevelopmentHrStorage() : new S3CompatibleHrStorage();
}
