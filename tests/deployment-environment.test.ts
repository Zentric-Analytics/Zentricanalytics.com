import assert from "node:assert/strict";
import { resolveDeploymentEnvironment as resolve } from "../src/lib/deployment-environment.mjs";
import type { ApprovedDeploymentBinding, DeploymentMetadata, UnverifiedReasonCode } from "../src/lib/deployment-environment.mjs";

// Existing Vitest when available/in use; otherwise the bundled Node offline runner.
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");

// All IDs, repository names and origins below are synthetic, including Render-shaped fixtures.
const staging = Object.freeze({
  serviceId: "srv-fixture-staging", identitySource: "render", workloadType: "web",
  repository: "fixture/example", branch: "dev", environment: "staging",
  configuredOrigin: "https://staging.example.test",
} satisfies ApprovedDeploymentBinding);
const production = Object.freeze({
  ...staging, serviceId: "srv-fixture-production", branch: "main", environment: "production",
  configuredOrigin: "https://production.example.test",
} satisfies ApprovedDeploymentBinding);
const cron = Object.freeze({
  serviceId: "crn-fixture-backup", identitySource: "render", workloadType: "cron",
  repository: "fixture/example", branch: "main", environment: "production",
} satisfies ApprovedDeploymentBinding);
const fixture = Object.freeze({ ...staging, serviceId: "fixture-local", identitySource: "synthetic" } satisfies ApprovedDeploymentBinding);
const bindings = Object.freeze([staging, production, cron, fixture]);
const renderContext = Object.freeze({ kind: "render" });
const metadata = (binding: ApprovedDeploymentBinding = staging): DeploymentMetadata => ({ ...binding, isPreview: false, nodeEnv: "production" });
const denied = (actual: unknown, reasonCode: UnverifiedReasonCode) => assert.deepEqual(actual, { status: "UNVERIFIED", reasonCode });

describe("resolveDeploymentEnvironment: isolated configuration matching", () => {
  for (const [binding, status] of [[staging, "VERIFIED_STAGING"], [production, "VERIFIED_PRODUCTION"], [cron, "VERIFIED_PRODUCTION"]] as const) {
    it(`matches ${binding.serviceId} without confusing workload or NODE_ENV`, () => {
      assert.deepEqual(resolve(metadata(binding), bindings, renderContext), {
        status, reasonCode: "BINDING_MATCH", environment: binding.environment,
        workloadType: binding.workloadType, verificationBasis: "CONFIGURATION_MATCH",
      });
    });
  }

  const mismatches = [
    ["workloadType", "cron", "WORKLOAD_MISMATCH"],
    ["repository", "fixture/other", "REPOSITORY_MISMATCH"],
    ["branch", "main", "BRANCH_MISMATCH"],
    ["environment", "production", "ENVIRONMENT_MISMATCH"],
    ["configuredOrigin", "https://other.example.test", "ORIGIN_MISMATCH"],
    ["identitySource", "synthetic", "IDENTITY_SOURCE_MISMATCH"],
  ] as const;
  for (const [key, value, reason] of mismatches) {
    it(`rejects conflicting ${key}`, () => {
      const actual: Record<string, unknown> = { ...metadata(), [key]: value };
      if (key === "workloadType") delete actual.configuredOrigin;
      denied(resolve(actual, bindings, renderContext), reason);
    });
  }

  it("never downgrades a production identity to staging configuration", () => {
    const result = resolve({ ...metadata(production), environment: "staging", configuredOrigin: staging.configuredOrigin }, bindings, renderContext);
    denied(result, "ENVIRONMENT_MISMATCH");
  });

  for (const key of ["serviceId", "identitySource", "workloadType", "repository", "branch", "environment", "configuredOrigin", "isPreview"]) {
    it(`rejects missing ${key}`, () => {
      const actual: Record<string, unknown> = { ...metadata() };
      delete actual[key];
      denied(resolve(actual, bindings, renderContext), "INVALID_METADATA");
    });
    it(`rejects duplicated/array-valued ${key}`, () => {
      denied(resolve({ ...metadata(), [key]: [metadata()[key as keyof DeploymentMetadata], metadata()[key as keyof DeploymentMetadata]] }, bindings, renderContext), "INVALID_METADATA");
    });
  }

  it("rejects unknown services even when branch and NODE_ENV appear correct", () => {
    denied(resolve({ ...metadata(), serviceId: "srv-unknown" }, bindings, renderContext), "UNKNOWN_SERVICE");
  });
  it("rejects preview environments", () => denied(resolve({ ...metadata(), isPreview: true }, bindings, renderContext), "PREVIEW_NOT_APPROVED"));
  it("rejects a string preview flag instead of silently treating it as false", () => denied(resolve({ ...metadata(), isPreview: "false" }, bindings, renderContext), "INVALID_METADATA"));
  it("does not classify from NODE_ENV", () => {
    assert.equal(resolve({ ...metadata(), nodeEnv: "test" }, bindings, renderContext).status, "VERIFIED_STAGING");
    denied(resolve({ nodeEnv: "production", branch: "main" }, bindings, renderContext), "INVALID_METADATA");
  });

  for (const configuredOrigin of [undefined, "", "http://staging.example.test", "https://staging.example.test/", "https://user:password@staging.example.test", "https://staging.example.test/path", "https://staging.example.test?token=fixture", "https://staging.example.test#fragment", "not-a-url"]) {
    it(`rejects malformed/noncanonical origin ${String(configuredOrigin)}`, () => denied(resolve({ ...metadata(), configuredOrigin }, bindings, renderContext), "INVALID_METADATA"));
  }
  it("does not give a cron workload a web origin or web capability", () => {
    denied(resolve({ ...metadata(cron), configuredOrigin: production.configuredOrigin }, bindings, renderContext), "INVALID_METADATA");
    denied(resolve({ ...metadata(cron), workloadType: "web", configuredOrigin: production.configuredOrigin }, bindings, renderContext), "WORKLOAD_MISMATCH");
  });

  for (const approved of [undefined, null, {}, [], [null], [{ ...staging, environment: "development" }], [{ ...cron, configuredOrigin: production.configuredOrigin }]]) {
    it(`rejects invalid bindings ${JSON.stringify(approved)}`, () => denied(resolve(metadata(), approved, renderContext), "INVALID_BINDINGS"));
  }
  it("rejects identical duplicate service bindings", () => denied(resolve(metadata(), [staging, staging], renderContext), "DUPLICATE_SERVICE_BINDING"));
  it("rejects contradictory duplicate service bindings", () => denied(resolve(metadata(), [staging, { ...production, serviceId: staging.serviceId }], renderContext), "DUPLICATE_SERVICE_BINDING"));
  it("rejects ambiguity elsewhere in the binding list", () => denied(resolve(metadata(), [staging, production, production], renderContext), "DUPLICATE_SERVICE_BINDING"));

  for (const key of ["headers", "host", "hostname", "query", "APP_ENV", "RENDER_SERVICE_ID", "NEXT_PUBLIC_APP_ENV"]) {
    it(`does not accept request/alternate identity field ${key}`, () => denied(resolve({ ...metadata(), [key]: "production.example.test" }, bindings, renderContext), "INVALID_METADATA"));
  }
  it("cannot classify request metadata alone", () => denied(resolve({ headers: { host: "staging.example.test" }, branch: "dev" }, bindings, renderContext), "INVALID_METADATA"));

  for (const kind of ["local", "test", "ci"] as const) {
    const context = { kind, syntheticFixtures: true };
    it(`supports explicit ${kind} synthetic fixtures with a distinct basis`, () => {
      assert.deepEqual(resolve(metadata(fixture), bindings, context), {
        status: "VERIFIED_STAGING", reasonCode: "SYNTHETIC_BINDING_MATCH", environment: "staging",
        workloadType: "web", verificationBasis: "SYNTHETIC_FIXTURE",
      });
    });
    it(`cannot use ${kind} to override recognized production identity`, () => denied(resolve(metadata(production), bindings, context), "CONTEXT_MISMATCH"));
    it(`cannot relabel protected identity as synthetic via ${kind}`, () => denied(resolve({ ...metadata(production), identitySource: "synthetic" }, bindings, context), "CONTEXT_MISMATCH"));
    it(`requires explicit synthetic opt-in for ${kind}`, () => denied(resolve(metadata(fixture), bindings, { kind }), "INVALID_CONTEXT"));
  }
  it("never treats a fixture as a deployed Render service", () => denied(resolve(metadata(fixture), bindings, renderContext), "CONTEXT_MISMATCH"));
  for (const context of [undefined, null, {}, { kind: "preview" }, { kind: "render", syntheticFixtures: true }, { kind: "render", localOverride: true }]) {
    it(`rejects invalid execution context ${JSON.stringify(context)}`, () => denied(resolve(metadata(), bindings, context), "INVALID_CONTEXT"));
  }

  for (const actual of [undefined, null, [], "fixture", new Date(), Object.create({ ...metadata() })]) {
    it(`rejects non-data metadata ${String(actual)}`, () => denied(resolve(actual, bindings, renderContext), "INVALID_METADATA"));
  }
  it("rejects accessor metadata without invoking the getter", () => {
    let invoked = false;
    const actual = { ...metadata() };
    Object.defineProperty(actual, "serviceId", { get() { invoked = true; throw new Error("do not execute"); } });
    denied(resolve(actual, bindings, renderContext), "INVALID_METADATA");
    assert.equal(invoked, false);
  });
  it("rejects accessor binding/context records without invoking them", () => {
    const dangerous = { get serviceId() { throw new Error("do not execute"); } };
    denied(resolve(metadata(), [dangerous], renderContext), "INVALID_BINDINGS");
    denied(resolve(metadata(), bindings, { get kind() { throw new Error("do not execute"); } }), "INVALID_CONTEXT");
  });
  it("supports null-prototype data records", () => assert.equal(resolve(Object.assign(Object.create(null), metadata()), bindings, renderContext).status, "VERIFIED_STAGING"));
  it("rejects unknown/symbol fields and does not echo sensitive-looking data", () => {
    const result = resolve({ ...metadata(), token: "fixture-only-sensitive-value", [Symbol("fixture")]: true }, bindings, renderContext);
    denied(result, "INVALID_METADATA");
    assert.equal(JSON.stringify(result).includes("fixture-only-sensitive-value"), false);
  });
  it("is deterministic, leaves frozen inputs untouched and freezes its result", () => {
    const actual = Object.freeze(metadata());
    const before = JSON.stringify([actual, bindings, renderContext]);
    const first = resolve(actual, bindings, renderContext);
    for (let i = 0; i < 50; i++) assert.deepEqual(resolve(actual, bindings, renderContext), first);
    assert.equal(JSON.stringify([actual, bindings, renderContext]), before);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(resolve(null, bindings, renderContext)), true);
  });
  it("resolves without environment reads, logging, network calls or timer scheduling", () => {
    const guarded: Array<[object, string]> = [
      [process, "env"], [globalThis, "fetch"], [globalThis, "setTimeout"], [globalThis, "setInterval"],
      ...["log", "info", "warn", "error", "debug"].map(key => [console, key] as [object, string]),
    ];
    const originals = guarded.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    try {
      for (const [target, key] of guarded) Object.defineProperty(target, key, {
        configurable: true,
        get() { throw new Error("Resolver attempted a forbidden side effect or environment read."); },
      });
      assert.equal(resolve(metadata(production), bindings, renderContext).status, "VERIFIED_PRODUCTION");
      denied(resolve({ ...metadata(production), environment: "staging" }, bindings, renderContext), "ENVIRONMENT_MISMATCH");
    } finally {
      guarded.forEach(([target, key], i) => {
        const descriptor = originals[i];
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      });
    }
  });
});
