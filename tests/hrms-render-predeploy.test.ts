import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { hrEnvironmentChecks } from "../scripts/hr-preflight-lib.mjs";
import { S3CompatibleHrStorage, validateStorageKey } from "../src/lib/hr/storage";
import { authorizeInternalRequest, timingSafeSecret } from "../src/lib/hr/internal-auth";

const strongSecrets = {
  EMAIL_WORKER_SECRET: "a".repeat(64),
  DOCUMENT_SCANNER_SECRET: "b".repeat(64),
  MONITORING_SECRET: "c".repeat(64),
};

const baseEnvironment = {
  APP_ENV: "staging",
  DATABASE_URL: "postgresql://validation.invalid/database",
  AUTH_SECRET: "d".repeat(32),
  APPLICATION_BASE_URL: "https://staging.example.test",
  OBJECT_STORAGE_PROVIDER: "s3-compatible",
  OBJECT_STORAGE_ENDPOINT: "https://objects.example.test",
  OBJECT_STORAGE_BUCKET: "private-hr-documents",
  OBJECT_STORAGE_REGION: "auto",
  OBJECT_STORAGE_ACCESS_KEY_ID: "access-key-placeholder",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key-placeholder",
  OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
  ...strongSecrets,
};

describe("Render HRMS environment validation", () => {
  it("keeps production migrations out of the build and behind the governed pre-deploy command", () => {
    const productionBlueprint = fs.readFileSync(path.join(process.cwd(), "render.production.example.yaml"), "utf8");
    expect(productionBlueprint).toContain("autoDeployTrigger: off");
    expect(productionBlueprint).toContain("buildCommand: yarn install --frozen-lockfile && yarn build");
    expect(productionBlueprint).toContain("preDeployCommand: yarn hr:release");
    expect(productionBlueprint).toContain("healthCheckPath: /api/health/ready");
    expect(productionBlueprint).not.toContain("buildCommand: yarn install --frozen-lockfile && yarn hr:release");
  });
  it("accepts local-private in development but rejects it in staging and production", () => {
    expect(hrEnvironmentChecks({ ...baseEnvironment, APP_ENV: "development", OBJECT_STORAGE_PROVIDER: "local-private" }).issues).toEqual([]);
    for (const APP_ENV of ["staging", "production"]) {
      expect(hrEnvironmentChecks({ ...baseEnvironment, APP_ENV, OBJECT_STORAGE_PROVIDER: "local-private" }).issues.join(" ")).toContain("s3-compatible provider");
    }
  });

  it("accepts a complete S3-compatible configuration", () => {
    expect(hrEnvironmentChecks(baseEnvironment).issues).toEqual([]);
  });

  it.each([
    ["OBJECT_STORAGE_BUCKET", "", "OBJECT_STORAGE_BUCKET"],
    ["OBJECT_STORAGE_ENDPOINT", "", "OBJECT_STORAGE_ENDPOINT"],
    ["OBJECT_STORAGE_ACCESS_KEY_ID", "", "OBJECT_STORAGE_ACCESS_KEY_ID"],
    ["OBJECT_STORAGE_SECRET_ACCESS_KEY", "", "OBJECT_STORAGE_SECRET_ACCESS_KEY"],
  ])("rejects missing %s", (key, value, expected) => {
    expect(hrEnvironmentChecks({ ...baseEnvironment, [key]: value }).issues.join(" ")).toContain(expected);
  });

  it("rejects malformed and unsafe endpoints and invalid booleans", () => {
    expect(hrEnvironmentChecks({ ...baseEnvironment, OBJECT_STORAGE_ENDPOINT: "not-a-url" }).issues.join(" ")).toContain("invalid");
    expect(hrEnvironmentChecks({ ...baseEnvironment, OBJECT_STORAGE_ENDPOINT: "http://objects.example.test" }).issues.join(" ")).toContain("HTTPS");
    expect(hrEnvironmentChecks({ ...baseEnvironment, OBJECT_STORAGE_FORCE_PATH_STYLE: "yes" }).issues.join(" ")).toContain("true or false");
  });

  it("permits HTTP only for a local test endpoint", () => {
    const result = hrEnvironmentChecks({
      ...baseEnvironment,
      APP_ENV: "test",
      APPLICATION_BASE_URL: "http://localhost:3000",
      OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:9000",
    });
    expect(result.issues).toEqual([]);
  });

  it("requires strong independent service secrets in protected environments without leaking values", () => {
    const secretValue = "highly-sensitive-value-that-must-never-be-returned";
    const result = hrEnvironmentChecks({
      ...baseEnvironment,
      EMAIL_WORKER_SECRET: "",
      DOCUMENT_SCANNER_SECRET: secretValue,
      MONITORING_SECRET: "",
    });
    const output = result.issues.join(" ");
    expect(output).toContain("EMAIL_WORKER_SECRET");
    expect(output).toContain("DOCUMENT_SCANNER_SECRET");
    expect(output).toContain("MONITORING_SECRET");
    expect(output).not.toContain(secretValue);
  });
});

describe("private S3-compatible HR storage", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(baseEnvironment)) vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("delegates upload, download, and delete to the S3 adapter", async () => {
    const send = vi.fn(async (command: object) => {
      if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
      return {};
    });
    const storage = new S3CompatibleHrStorage({ send } as never);
    await storage.put("documents/org/employee/file.pdf", new Uint8Array([1]), "application/pdf");
    await expect(storage.get("documents/org/employee/file.pdf")).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await storage.delete("documents/org/employee/file.pdf");
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[2][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it.each(["../secret", "/absolute/file", ".hidden", "documents//file", "documents/./file"])("rejects unsafe object key %s", (key) => {
    expect(() => validateStorageKey(key)).toThrow("Invalid HR storage key");
  });

  it("maps provider failures without leaking credentials", async () => {
    const credential = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!;
    const storage = new S3CompatibleHrStorage({
      send: vi.fn(async () => { throw new Error(`provider failed with ${credential}`); }),
    } as never);
    await expect(storage.get("documents/org/file.pdf")).rejects.toThrow("Private HR storage operation failed");
    await expect(storage.get("documents/org/file.pdf")).rejects.not.toThrow(credential);
  });

  it("does not send unsupported version-id parameters to S3-compatible providers", async () => {
    const send = vi.fn(async (command: object) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: 5, Metadata: { sha256: "checksum" } };
      if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => new Uint8Array([1]) } };
      return {};
    });
    const storage = new S3CompatibleHrStorage({ send } as never);
    const location = { provider: "s3-compatible", bucket: baseEnvironment.OBJECT_STORAGE_BUCKET, key: "quarantine/document.pdf", versionId: "provider-returned-but-unsupported", checksum: "checksum" };
    await expect(storage.headVersion(location)).resolves.toMatchObject({ sizeBytes: 5, checksum: "checksum" });
    await expect(storage.getAuthorized(location)).resolves.toEqual(new Uint8Array([1]));
    await storage.deleteVersion(location);
    for (const [command] of send.mock.calls) expect((command as { input?: { VersionId?: string } }).input?.VersionId).toBeUndefined();
  });
});

describe("internal service authentication", () => {
  const secret = "e".repeat(64);
  it("accepts the correct secret and rejects absent or incorrect secrets", () => {
    expect(authorizeInternalRequest(new Request("https://example.test", { headers: { authorization: `Bearer ${secret}` } }), secret)).toBe(true);
    expect(authorizeInternalRequest(new Request("https://example.test"), secret)).toBe(false);
    expect(authorizeInternalRequest(new Request("https://example.test", { headers: { authorization: "Bearer wrong" } }), secret)).toBe(false);
  });

  it("uses the timing-safe comparison helper", () => {
    const spy = vi.spyOn(crypto, "timingSafeEqual");
    expect(timingSafeSecret(secret, secret)).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});
