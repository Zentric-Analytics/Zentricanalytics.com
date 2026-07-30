import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type HrObjectStorage = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  head(key: string): Promise<{ sizeBytes: number; contentType?: string }>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
};

const LOCAL_PROVIDERS = new Set(["local", "local-private"]);

export function hrStorageProvider() {
  return process.env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase() || "local-private";
}

export function assertProductionHrStorage() {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const provider = hrStorageProvider();
  if (!LOCAL_PROVIDERS.has(provider) && provider !== "s3-compatible") {
    throw new Error("Unsupported HR object storage provider.");
  }
  if ((["staging", "production"].includes(appEnv ?? "") || process.env.NODE_ENV === "production") && LOCAL_PROVIDERS.has(provider)) {
    throw new Error("Production HR documents require private S3-compatible object storage.");
  }
}

export function s3CompatibleStorageConfigured() {
  return Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT
    && process.env.OBJECT_STORAGE_BUCKET
    && process.env.OBJECT_STORAGE_REGION
    && process.env.OBJECT_STORAGE_ACCESS_KEY_ID
    && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  );
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
    this.client = client ?? new S3Client({
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
      region: process.env.OBJECT_STORAGE_REGION || "auto",
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      credentials: { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY! },
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
