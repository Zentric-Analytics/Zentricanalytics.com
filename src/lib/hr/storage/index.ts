import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type HrObjectStorage = {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
};

export function hrStorageProvider() {
  return process.env.OBJECT_STORAGE_PROVIDER ?? "local";
}

export function assertProductionHrStorage() {
  if (process.env.NODE_ENV === "production" && hrStorageProvider() === "local") {
    throw new Error("Production HR documents require private S3-compatible object storage.");
  }
}

export function s3CompatibleStorageConfigured() {
  return Boolean(process.env.OBJECT_STORAGE_ENDPOINT && process.env.OBJECT_STORAGE_BUCKET && process.env.OBJECT_STORAGE_ACCESS_KEY_ID && process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY);
}

function safeLocalPath(root: string, key: string) {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes("..") || path.isAbsolute(key)) throw new Error("Invalid HR storage key.");
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Invalid HR storage key.");
  return resolved;
}

export class LocalDevelopmentHrStorage implements HrObjectStorage {
  constructor(private readonly root = process.env.HR_LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), ".hr-private")) {
    if (process.env.NODE_ENV === "production") throw new Error("Local HR storage is development-only.");
  }
  async put(key: string, bytes: Uint8Array) { const target = safeLocalPath(this.root, key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); }
  async get(key: string) { return new Uint8Array(await readFile(safeLocalPath(this.root, key))); }
  async delete(key: string) { await rm(safeLocalPath(this.root, key), { force: true }); }
}

export class S3CompatibleHrStorageConfig {
  readonly provider = "s3-compatible";
  constructor() {
    if (!s3CompatibleStorageConfigured()) throw new Error("S3-compatible HR storage configuration is incomplete.");
  }
}
