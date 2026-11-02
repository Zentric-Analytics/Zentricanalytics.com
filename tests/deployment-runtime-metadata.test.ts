import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { validateDeploymentRuntimeMetadata as validate } from "../src/lib/deployment-runtime-metadata.mjs";
import type { RuntimeMetadataSnapshot, RuntimeMetadataRejectionCode } from "../src/lib/deployment-runtime-metadata.mjs";
import { resolveDeploymentEnvironment as resolve } from "../src/lib/deployment-environment.mjs";
import { evaluateOutgoingEmailRecipientEligibility as recipient } from "../src/lib/environment-policy-rules.mjs";

// Existing offline convention; only the test harness reads this runner flag.
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");
// Synthetic examples, including all Render-shaped fixtures. No live identities.
const staging = Object.freeze({ executionKind: "render", identitySource: "render",
  serviceId: "srv-fixture-stage", workloadType: "web", repository: "fixture/example",
  branch: "dev", environment: "staging", configuredOrigin: "https://staging.example.test",
  isPreview: false, nodeEnv: "production" } satisfies RuntimeMetadataSnapshot);
const production = Object.freeze({ ...staging, serviceId: "srv-fixture-prod", environment: "production",
  branch: "main", configuredOrigin: "https://production.example.test" } satisfies RuntimeMetadataSnapshot);
const binding = (snapshot: RuntimeMetadataSnapshot) => {
  const { executionKind: _context, isPreview: _preview, nodeEnv: _diagnostic, deploymentEnvironment: _assertion, ...identity } = snapshot;
  return identity;
};
// Independently declared registry, deliberately not derived from input under test.
const approved = Object.freeze([
  Object.freeze({ serviceId: "srv-fixture-stage", identitySource: "render", workloadType: "web",
    repository: "fixture/example", branch: "dev", environment: "staging", configuredOrigin: "https://staging.example.test" }),
  Object.freeze({ serviceId: "srv-fixture-prod", identitySource: "render", workloadType: "web",
    repository: "fixture/example", branch: "main", environment: "production", configuredOrigin: "https://production.example.test" }),
  Object.freeze({ serviceId: "fixture-local", identitySource: "synthetic", workloadType: "web",
    repository: "fixture/example", branch: "dev", environment: "staging", configuredOrigin: "https://staging.example.test" }),
  Object.freeze({ serviceId: "crn-fixture", identitySource: "render", workloadType: "cron",
    repository: "fixture/example", branch: "main", environment: "production" }),
]);
const deny = (input: unknown, reasonCode: RuntimeMetadataRejectionCode) => assert.deepEqual(validate(input), { status: "REJECTED", reasonCode });

describe("runtime metadata: successful syntax is not authority", () => {
  for (const [snapshot, status] of [[staging, "VERIFIED_STAGING"], [production, "VERIFIED_PRODUCTION"]] as const) {
    it(`validates and interoperates for ${snapshot.environment} web`, () => {
      const result = validate(snapshot);
      assert.equal(result.status, "VALIDATED");
      if (result.status !== "VALIDATED") throw new Error("Expected validation");
      assert.equal(result.assurance, "VALIDATED_CONFIGURATION_ONLY");
      assert.deepEqual(result.metadata, { ...binding(snapshot), isPreview: false, nodeEnv: "production" });
      assert.equal(resolve(result.metadata, approved, result.executionContext).status, status);
    });
  }
  it("validates cron without inventing a web origin or dispatch authority", () => {
    const result = validate({ ...approved[3], executionKind: "render", isPreview: false });
    assert.equal(result.status, "VALIDATED");
    if (result.status !== "VALIDATED") throw new Error("Expected validation");
    assert.equal(Object.hasOwn(result.metadata, "configuredOrigin"), false);
    const resolution = resolve(result.metadata, approved, result.executionContext);
    assert.equal(resolution.status, "VERIFIED_PRODUCTION");
    assert.deepEqual(recipient(resolution, "tester@example.test"), { eligible: false, reasonCode: "WORKLOAD_NOT_PERMITTED" });
  });
  for (const kind of ["local", "test", "ci"] as const) {
    it(`keeps ${kind} synthetic and ineligible for live email`, () => {
      const result = validate({ ...staging, executionKind: kind, identitySource: "synthetic", serviceId: "fixture-local" });
      if (result.status !== "VALIDATED") throw new Error("Expected validation");
      assert.deepEqual(result.executionContext, { kind, syntheticFixtures: true });
      const resolution = resolve(result.metadata, approved, result.executionContext);
      assert.equal("verificationBasis" in resolution && resolution.verificationBasis, "SYNTHETIC_FIXTURE");
      assert.deepEqual(recipient(resolution, "tester@example.test", ["tester@example.test"]), { eligible: false, reasonCode: "SYNTHETIC_RESOLUTION_REJECTED" });
    });
  }
  it("leaves unknown identities to independent binding verification", () => {
    const result = validate({ ...staging, serviceId: "srv-unknown" });
    if (result.status !== "VALIDATED") throw new Error("Expected syntax validation");
    assert.deepEqual(resolve(result.metadata, approved, result.executionContext), { status: "UNVERIFIED", reasonCode: "UNKNOWN_SERVICE" });
  });
  it("cannot downgrade a recognized production identity to staging", () => {
    const result = validate({ ...staging, serviceId: production.serviceId });
    if (result.status !== "VALIDATED") throw new Error("Expected syntax validation");
    assert.deepEqual(resolve(result.metadata, approved, result.executionContext), { status: "UNVERIFIED", reasonCode: "BRANCH_MISMATCH" });
  });
  it("cannot relabel a protected service as a local synthetic identity", () => {
    const result = validate({ ...production, executionKind: "local", identitySource: "synthetic" });
    if (result.status !== "VALIDATED") throw new Error("Expected syntax validation");
    assert.deepEqual(resolve(result.metadata, approved, result.executionContext), { status: "UNVERIFIED", reasonCode: "CONTEXT_MISMATCH" });
  });
  it("does not infer environment from branch, hostname or NODE_ENV", () => {
    const result = validate({ ...staging, branch: "main", nodeEnv: "test", configuredOrigin: "https://production.example.test" });
    assert.equal(result.status === "VALIDATED" && result.metadata.environment, "staging");
  });
  it("accepts an agreeing explicit environment assertion and removes it from resolver input", () => {
    const result = validate({ ...production, deploymentEnvironment: "production" });
    assert.equal(result.status, "VALIDATED");
    if (result.status === "VALIDATED") assert.equal(Object.hasOwn(result.metadata, "deploymentEnvironment"), false);
  });
});

describe("runtime metadata: strict field validation", () => {
  const cases: Array<[string, unknown[], RuntimeMetadataRejectionCode]> = [
    ["executionKind", [undefined, "", "browser", "RENDER", false, []], "INVALID_EXECUTION_KIND"],
    ["identitySource", [undefined, "", "provider-attested", false, []], "INVALID_IDENTITY_SOURCE"],
    ["serviceId", [undefined, "", " srv-fixture", "srv fixture", "x\n", {}, [], 4, "x".repeat(257)], "INVALID_SERVICE_ID"],
    ["workloadType", [undefined, "", "worker", "Web", ["web", "cron"]], "INVALID_WORKLOAD_TYPE"],
    ["repository", [undefined, "", "owner", "owner/repo/extra", "https://example.test/repo", "../repo", "owner/..", "owner/re po", "owner/", ["owner/repo"]], "INVALID_REPOSITORY"],
    ["branch", [undefined, "", " dev", "-dev", "/dev", "dev/", "dev//x", "dev..x", "x.lock", "x/.hidden", "dev.", "x@{y", "x\\y", "x y", "x".repeat(257)], "INVALID_BRANCH"],
    ["environment", [undefined, "", "preview", "development", "PRODUCTION", false, []], "INVALID_ENVIRONMENT"],
    ["isPreview", [undefined, null, "false", "true", 0, 1, [], {}], "INVALID_PREVIEW_CLASSIFICATION"],
    ["configuredOrigin", [undefined, "", "http://example.test", "https://example.test/", "https://example.test/path", "https://user:pass@example.test", "https://example.test?secret=fixture", "https://example.test#x", "https://EXAMPLE.test", " https://example.test", "not-a-url", []], "INVALID_APPLICATION_ORIGIN"],
    ["nodeEnv", [undefined, "", "staging", " production", false, []], "INVALID_NODE_ENV"],
  ];
  for (const [field, values, reason] of cases) {
    values.forEach((value, index) => it(`rejects invalid ${field} case ${index}`, () => deny({ ...staging, [field]: value }, reason)));
  }
  for (const field of ["executionKind", "identitySource", "serviceId", "workloadType", "repository", "branch", "environment", "configuredOrigin", "isPreview"]) {
    it(`rejects omitted required ${field}`, () => {
      const snapshot: Record<string, unknown> = { ...staging };
      delete snapshot[field];
      assert.equal(validate(snapshot).status, "REJECTED");
    });
  }
  it("permits omitted diagnostic NODE_ENV", () => {
    const snapshot: Record<string, unknown> = { ...staging };
    delete snapshot.nodeEnv;
    assert.equal(validate(snapshot).status, "VALIDATED");
  });
  it("rejects preview deployments", () => deny({ ...staging, isPreview: true }, "PREVIEW_NOT_APPROVED"));
  it("rejects conflicting environments", () => deny({ ...staging, deploymentEnvironment: "production" }, "ENVIRONMENT_CONFLICT"));
  for (const value of [undefined, "preview", [], false]) it(`rejects malformed corroborating environment ${String(value)}`, () => deny({ ...staging, deploymentEnvironment: value }, "INVALID_ENVIRONMENT"));
  for (const kind of ["local", "test", "ci"]) it(`rejects Render identity in ${kind}`, () => deny({ ...staging, executionKind: kind }, "CONTEXT_SOURCE_CONFLICT"));
  it("rejects synthetic identity in Render context", () => deny({ ...staging, identitySource: "synthetic" }, "CONTEXT_SOURCE_CONFLICT"));
  for (const value of [undefined, "", staging.configuredOrigin]) it(`rejects any cron origin property ${String(value)}`, () => deny({ ...staging, workloadType: "cron", configuredOrigin: value }, "INVALID_APPLICATION_ORIGIN"));
  it("accepts a bounded Git branch subset", () => assert.equal(validate({ ...staging, branch: "feature/U02-identity_v2" }).status, "VALIDATED"));
});

describe("runtime metadata: data shapes, immutable results and no effects", () => {
  for (const value of [null, undefined, false, 3, "secret-fixture", [], new Date(), () => staging, Object.create(staging)]) {
    it(`rejects non-data shape ${typeof value}`, () => deny(value, "INVALID_SNAPSHOT"));
  }
  for (const key of ["headers", "cookies", "request", "approvedBindings", "RESEND_API_KEY", "override", "__proto__"]) {
    it(`rejects unexpected ${key} without echoing its value`, () => {
      const result = validate(Object.defineProperty({ ...staging }, key, { value: "do-not-echo-fixture", enumerable: false }));
      assert.deepEqual(result, { status: "REJECTED", reasonCode: "INVALID_SNAPSHOT" });
    });
  }
  it("rejects symbols", () => deny({ ...staging, [Symbol("fixture")]: true }, "INVALID_SNAPSHOT"));
  for (const key of Object.keys(staging)) it(`rejects accessor ${key} without invoking it`, () => {
    deny(Object.defineProperty({ ...staging }, key, { get() { throw new Error("Accessor executed"); } }), "INVALID_SNAPSHOT");
  });
  it("rejects executable field values without coercion", () => deny({ ...staging, serviceId: { toString() { throw new Error("Coercion executed"); } } }, "INVALID_SERVICE_ID"));
  it("accepts null-prototype own-data records", () => assert.equal(validate(Object.assign(Object.create(null), staging)).status, "VALIDATED"));
  it("returns deterministic frozen copies and does not mutate inputs", () => {
    const input = { ...staging };
    const result = validate(input);
    for (let i = 0; i < 30; i++) assert.deepEqual(validate(input), result);
    assert.deepEqual(input, staging);
    assert.equal(Object.isFrozen(result), true);
    if (result.status !== "VALIDATED") throw new Error("Expected validation");
    assert.equal(Object.isFrozen(result.metadata), true);
    assert.equal(Object.isFrozen(result.executionContext), true);
    input.serviceId = "changed";
    assert.equal(result.metadata.serviceId, staging.serviceId);
    assert.equal(Object.isFrozen(validate(null)), true);
  });
  it("uses no environment, logging, timers, filesystem, subprocess or network APIs", () => {
    const guarded: Array<[object, string]> = [
      [process, "env"], [globalThis, "fetch"], [globalThis, "setTimeout"], [globalThis, "setInterval"],
      ...["log", "info", "warn", "error", "debug"].map(key => [console, key] as [object, string]),
      ...["readFile", "readFileSync", "writeFile", "writeFileSync", "open", "openSync"].map(key => [fs, key] as [object, string]),
      ...["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"].map(key => [childProcess, key] as [object, string]),
      [net, "connect"], [net, "createConnection"], [http, "request"], [http, "get"], [https, "request"], [https, "get"],
    ];
    const descriptors = guarded.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    const results: unknown[] = [];
    try {
      for (const [target, key] of guarded) Object.defineProperty(target, key, { configurable: true, get() { throw new Error("Forbidden API access"); } });
      results.push(validate(staging), validate(production), validate(null), validate({ ...staging, isPreview: true }));
    } finally {
      guarded.forEach(([target, key], index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      });
    }
    assert.deepEqual(results, [validate(staging), validate(production), validate(null), validate({ ...staging, isPreview: true })]);
  });
  it("has no runtime imports or provider/process access in module source", () => {
    const source = fs.readFileSync(new URL("../src/lib/deployment-runtime-metadata.mjs", import.meta.url), "utf8");
    assert.equal(/\bimport\s*(?:\(|["'{*])|\bprocess\b|\bfetch\s*\(|\bconsole\s*\.|\brequire\s*\(/u.test(source), false);
  });
});
