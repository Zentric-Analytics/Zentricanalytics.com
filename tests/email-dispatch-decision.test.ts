import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { decideEmailDispatch as decide, classifyEmailProviderAttempt as failed } from "../src/lib/email-dispatch-decision.mjs";
import { validateDeploymentRuntimeMetadata as validate } from "../src/lib/deployment-runtime-metadata.mjs";
import { resolveDeploymentEnvironment as resolve } from "../src/lib/deployment-environment.mjs";
import { evaluateOutgoingEmailRecipientEligibility as eligible } from "../src/lib/environment-policy-rules.mjs";
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");

// Independently declared synthetic fixtures; no deployed identities or secrets.
const stageBinding = Object.freeze({ serviceId: "srv-stage-fixture", identitySource: "render", workloadType: "web",
  repository: "fixture/example", branch: "dev", environment: "staging", configuredOrigin: "https://stage.example.test" });
const prodBinding = Object.freeze({ serviceId: "srv-prod-fixture", identitySource: "render", workloadType: "web",
  repository: "fixture/example", branch: "main", environment: "production", configuredOrigin: "https://prod.example.test" });
const localBinding = Object.freeze({ ...stageBinding, serviceId: "fixture-local", identitySource: "synthetic" });
const cronBinding = Object.freeze({ serviceId: "crn-fixture", identitySource: "render", workloadType: "cron",
  repository: "fixture/example", branch: "main", environment: "production" });
const syntheticCron = Object.freeze({ ...cronBinding, serviceId: "fixture-cron", identitySource: "synthetic" });
const bindings = Object.freeze([stageBinding, prodBinding, localBinding, cronBinding, syntheticCron]);
const staging = Object.freeze({ ...stageBinding, executionKind: "render", isPreview: false });
const production = Object.freeze({ ...prodBinding, executionKind: "render", isPreview: false });
const list = Object.freeze(["tester@example.test"]);
const expected = (decision: string, stage: string, reasonCode: string) => ({ decision, stage, reasonCode });
const check = (snapshot: unknown, decision: string, stage: string, reason: string, recipient: unknown = list[0], allowlist: unknown = list, registry: unknown = bindings) =>
  assert.deepEqual(decide(snapshot, registry, recipient, allowlist), expected(decision, stage, reason));

describe("email dispatch policy: delegation and recipient outcomes", () => {
  it("allows approved staging", () => check(staging, "ALLOW", "RECIPIENT", "STAGING_RECIPIENT_ALLOWLISTED"));
  it("holds valid unapproved staging", () => check(staging, "HOLD", "RECIPIENT", "STAGING_RECIPIENT_NOT_ALLOWLISTED", "other@example.test"));
  it("uses existing case/space matching without returning or rewriting the address", () => {
    const input = " TESTER@EXAMPLE.TEST ";
    assert.deepEqual(decide(staging, bindings, input, list), expected("ALLOW", "RECIPIENT", "STAGING_RECIPIENT_ALLOWLISTED"));
    assert.equal(input, " TESTER@EXAMPLE.TEST ");
  });
  for (const address of ["tester+tag@example.test", "test.er@example.test", "person@zentricanalytics.com"]) {
    it(`does not silently approve aliases/company addresses ${address}`, () => check(staging, "HOLD", "RECIPIENT", "STAGING_RECIPIENT_NOT_ALLOWLISTED", address));
  }
  for (const address of [undefined, null, 3, {}, [], "", "bad", "a@localhost", "Name <tester@example.test>", "a@example.test,b@example.test", "a@example.test\r\nBcc:b@example.test"]) {
    it(`blocks invalid recipient ${JSON.stringify(address)} instead of holding`, () => {
      assert.deepEqual(decide(staging, bindings, address, list), expected("CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_EMAIL_ADDRESS"));
      assert.deepEqual(decide(production, bindings, address, list), expected("CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_EMAIL_ADDRESS"));
    });
  }
  for (const allowlist of [undefined, null, [], "tester@example.test", {}, ["bad"], [list[0], "bad"], ["*@example.test", "bad"], Array(1)]) {
    it(`blocks unusable staging list ${JSON.stringify(allowlist)}`, () => {
      assert.deepEqual(decide(staging, bindings, list[0], allowlist), expected("CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_STAGING_RECIPIENT_ALLOWLIST"));
      assert.deepEqual(decide(production, bindings, "external@example.test", allowlist), expected("ALLOW", "RECIPIENT", "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE"));
    });
  }
  it("does not expand wildcard-looking addresses", () => check(staging, "HOLD", "RECIPIENT", "STAGING_RECIPIENT_NOT_ALLOWLISTED", list[0], ["*@example.test"]));
  it("production does not inspect an executable staging list", () => {
    const accessor = Object.defineProperty([], "0", { get() { throw new Error("Must not execute"); } });
    check(production, "ALLOW", "RECIPIENT", "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE", list[0], accessor);
    check(staging, "CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_STAGING_RECIPIENT_ALLOWLIST", list[0], accessor);
  });
  for (const snapshot of [staging, production]) it(`matches all three existing components for ${snapshot.environment}`, () => {
    const validated = validate(snapshot);
    if (validated.status !== "VALIDATED") throw new Error("Fixture invalid");
    const resolution = resolve(validated.metadata, bindings, validated.executionContext);
    const policy = eligible(resolution, list[0], list);
    assert.equal(policy.eligible, true);
    assert.deepEqual(decide(snapshot, bindings, list[0], list), expected("ALLOW", "RECIPIENT", policy.reasonCode));
  });
});

describe("email dispatch: identity and precedence", () => {
  it("metadata failure precedes bindings and recipient", () => check(null, "CONFIGURATION_BLOCKED", "METADATA", "INVALID_SNAPSHOT", "bad", [], []));
  it("rejects caller-supplied verified status", () => check({ ...staging, status: "VERIFIED_PRODUCTION" }, "CONFIGURATION_BLOCKED", "METADATA", "INVALID_SNAPSHOT"));
  it("rejects contradictory explicit environments", () => check({ ...staging, deploymentEnvironment: "production" }, "CONFIGURATION_BLOCKED", "METADATA", "ENVIRONMENT_CONFLICT"));
  it("rejects preview", () => check({ ...staging, isPreview: true }, "CONFIGURATION_BLOCKED", "METADATA", "PREVIEW_NOT_APPROVED"));
  it("rejects missing preview information", () => {
    const { isPreview: _preview, ...input } = staging;
    check(input, "CONFIGURATION_BLOCKED", "METADATA", "INVALID_PREVIEW_CLASSIFICATION");
  });
  for (const registry of [undefined, null, [], {}, [null], Array(1)]) it(`blocks invalid bindings ${JSON.stringify(registry)}`, () => {
    assert.deepEqual(decide(staging, registry, "bad", []), expected("CONFIGURATION_BLOCKED", "BINDING", "INVALID_BINDINGS"));
  });
  it("blocks duplicate bindings", () => check(staging, "CONFIGURATION_BLOCKED", "BINDING", "DUPLICATE_SERVICE_BINDING", list[0], list, [stageBinding, stageBinding]));
  const conflicts = [
    ["serviceId", "srv-unknown", "UNKNOWN_SERVICE"], ["branch", "main", "BRANCH_MISMATCH"],
    ["repository", "fixture/other", "REPOSITORY_MISMATCH"], ["environment", "production", "ENVIRONMENT_MISMATCH"],
    ["configuredOrigin", "https://other.example.test", "ORIGIN_MISMATCH"],
  ];
  for (const [field, value, reason] of conflicts) it(`binding mismatch ${field} precedes recipient`, () => check({ ...staging, [field]: value }, "CONFIGURATION_BLOCKED", "BINDING", reason, "bad", []));
  it("production cannot be relabeled staging", () => check({ ...production, environment: "staging" }, "CONFIGURATION_BLOCKED", "BINDING", "ENVIRONMENT_MISMATCH"));
  it("local override cannot bypass protected service binding", () => check({ ...production, executionKind: "local", identitySource: "synthetic" }, "CONFIGURATION_BLOCKED", "BINDING", "CONTEXT_MISMATCH"));
  for (const kind of ["local", "test", "ci"]) it(`synthetic ${kind} simulates only after binding match`, () => {
    const snapshot = { ...localBinding, executionKind: kind, isPreview: false };
    check(snapshot, "SIMULATED", "SIMULATION", "SYNTHETIC_DISPATCH_ONLY", "bad", []);
    check({ ...snapshot, serviceId: "fixture-unknown" }, "CONFIGURATION_BLOCKED", "BINDING", "UNKNOWN_SERVICE");
    check({ ...snapshot, isPreview: true }, "CONFIGURATION_BLOCKED", "METADATA", "PREVIEW_NOT_APPROVED");
  });
  for (const binding of [cronBinding, syntheticCron]) it(`cron never dispatches or simulates ${binding.identitySource}`, () => {
    check({ ...binding, executionKind: binding.identitySource === "render" ? "render" : "test", isPreview: false }, "CONFIGURATION_BLOCKED", "WORKLOAD", "WORKLOAD_NOT_PERMITTED", "bad", []);
  });
  it("invalid recipient precedes invalid allowlist", () => check(staging, "CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_EMAIL_ADDRESS", "bad", []));
  it("invalid list precedes valid unapproved recipient hold", () => check(staging, "CONFIGURATION_BLOCKED", "RECIPIENT", "INVALID_STAGING_RECIPIENT_ALLOWLIST", "other@example.test", []));
  it("rejects executable binding containers without invoking them", () => {
    const accessor = Object.defineProperty([], "0", { get() { throw new Error("Must not execute"); } });
    const iterable = Object.assign([stageBinding], { [Symbol.iterator]() { throw new Error("Must not iterate"); } });
    for (const registry of [accessor, iterable]) assert.deepEqual(decide(staging, registry, list[0], list), expected("CONFIGURATION_BLOCKED", "BINDING", "INVALID_BINDINGS"));
  });
});

describe("provider outcomes are separate caller attestations", () => {
  it("classifies only explicit attempted failure", () => assert.deepEqual(failed({ attempted: true, status: "failed" }), expected("PROVIDER_FAILED", "PROVIDER_OUTCOME", "PROVIDER_ATTEMPT_FAILED")));
  for (const input of [undefined, null, [], {}, "failed", false, { status: "failed" }, { attempted: false, status: "failed" }, { attempted: "true", status: "failed" }, { attempted: true, status: "sent" }, { attempted: true, status: "failed", error: "private-fixture" }, Object.create({ attempted: true, status: "failed" })]) {
    it(`does not invent an attempted failure ${JSON.stringify(input)}`, () => assert.deepEqual(failed(input), expected("CONFIGURATION_BLOCKED", "PROVIDER_OUTCOME", "INVALID_PROVIDER_ATTEMPT_OUTCOME")));
  }
  it("rejects accessor and symbol outcome fields without execution", () => {
    const accessor = Object.defineProperty({ status: "failed" }, "attempted", { get() { throw new Error("Must not execute"); } });
    for (const input of [accessor, { attempted: true, status: "failed", [Symbol("extra")]: true }]) assert.equal(failed(input).decision, "CONFIGURATION_BLOCKED");
  });
  it("accepts null-prototype data outcome", () => assert.equal(failed(Object.assign(Object.create(null), { attempted: true, status: "failed" })).decision, "PROVIDER_FAILED"));
  it("cannot override HOLD or configuration block", () => {
    failed({ attempted: true, status: "failed" });
    check(staging, "HOLD", "RECIPIENT", "STAGING_RECIPIENT_NOT_ALLOWLISTED", "other@example.test");
    check(null, "CONFIGURATION_BLOCKED", "METADATA", "INVALID_SNAPSHOT");
  });
});

describe("immutable decisions and no operational effects", () => {
  it("returns frozen deterministic outputs without input mutation or sensitive echoes", () => {
    const before = JSON.stringify([staging, bindings, list]);
    const outcomes = [decide(staging, bindings, list[0], list), decide(staging, bindings, "private@example.test", list), decide(null, bindings, "private-fixture"),
      decide({ ...localBinding, executionKind: "ci", isPreview: false }, bindings, "private-fixture"), failed({ attempted: true, status: "failed" }), failed(null)];
    for (const outcome of outcomes) {
      assert.equal(Object.isFrozen(outcome), true);
      assert.equal(JSON.stringify(outcome).includes("private"), false);
    }
    for (let i = 0; i < 30; i++) assert.deepEqual(decide(staging, bindings, list[0], list), outcomes[0]);
    assert.equal(JSON.stringify([staging, bindings, list]), before);
  });
  it("rejects snapshot accessors without execution", () => {
    const input = Object.defineProperty({ ...staging }, "serviceId", { get() { throw new Error("Must not execute"); } });
    check(input, "CONFIGURATION_BLOCKED", "METADATA", "INVALID_SNAPSHOT");
  });
  it("uses no environment, logging, filesystem, network, timers or subprocess APIs", () => {
    const guarded: Array<[object, string]> = [[process, "env"], [globalThis, "fetch"], [globalThis, "setTimeout"], [globalThis, "setInterval"],
      ...["log", "info", "warn", "error", "debug"].map(key => [console, key] as [object, string]),
      ...["readFile", "readFileSync", "writeFile", "writeFileSync", "open", "openSync"].map(key => [fs, key] as [object, string]),
      ...["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"].map(key => [childProcess, key] as [object, string]),
      [net, "connect"], [net, "createConnection"], [http, "request"], [http, "get"], [https, "request"], [https, "get"]];
    const originals = guarded.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    const outcomes: unknown[] = [];
    try {
      for (const [target, key] of guarded) Object.defineProperty(target, key, { configurable: true, get() { throw new Error("Forbidden API"); } });
      outcomes.push(decide(staging, bindings, list[0], list), decide(staging, bindings, "other@example.test", list), decide(null, bindings, list[0]),
        decide({ ...localBinding, executionKind: "test", isPreview: false }, bindings, list[0]), failed({ attempted: true, status: "failed" }));
    } finally {
      guarded.forEach(([target, key], index) => { const original = originals[index]; if (original) Object.defineProperty(target, key, original); else Reflect.deleteProperty(target, key); });
    }
    assert.deepEqual(outcomes.map(value => (value as { decision: string }).decision), ["ALLOW", "HOLD", "CONFIGURATION_BLOCKED", "SIMULATED", "PROVIDER_FAILED"]);
  });
  it("imports only the three pure modules and contains no runtime clients", () => {
    const source = fs.readFileSync(new URL("../src/lib/email-dispatch-decision.mjs", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";/gm)].map(match => match[1]);
    assert.deepEqual(imports, ["./deployment-runtime-metadata.mjs", "./deployment-environment.mjs", "./environment-policy-rules.mjs"]);
    assert.equal(/\b(?:process|console|prisma)\s*\.|\b(?:fetch|require)\s*\(|\bimport\s*\(/u.test(source), false);
  });
});
