import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { resolveDeploymentEnvironment } from "../src/lib/deployment-environment.mjs";
import type { DeploymentResolution } from "../src/lib/deployment-environment.mjs";
import {
  evaluateInternalHrmsEmailEligibility,
  evaluateOutgoingEmailRecipientEligibility,
} from "../src/lib/environment-policy-rules.mjs";
import type { InternalHrmsAccountAuthorization } from "../src/lib/environment-policy-rules.mjs";

// No package installation: same dual offline runner convention as U02-I01.
const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test");

// All bindings, accounts, addresses and authorization attestations are test data.
const stagingBinding = Object.freeze({
  serviceId: "srv-policy-fixture-staging", identitySource: "render", workloadType: "web",
  repository: "fixture/policy", branch: "dev", environment: "staging",
  configuredOrigin: "https://staging.example.test",
});
const productionBinding = Object.freeze({ ...stagingBinding,
  serviceId: "srv-policy-fixture-production", branch: "main", environment: "production",
  configuredOrigin: "https://production.example.test",
});
const bindings = Object.freeze([stagingBinding, productionBinding]);
const staging = resolveDeploymentEnvironment({ ...stagingBinding, isPreview: false }, bindings, { kind: "render" });
const production = resolveDeploymentEnvironment({ ...productionBinding, isPreview: false }, bindings, { kind: "render" });
const stagingAuthorization = Object.freeze({ authorized: true, environment: "staging", purpose: "INTERNAL_HRMS_TEST" });
const productionAuthorization = Object.freeze({ authorized: true, environment: "production", purpose: "INTERNAL_HRMS" });
const companyEmail = "policy.fixture@zentricanalytics.com";
const externalEmail = "u02.policy.fixture@gmail.com";
const allowlist = Object.freeze([externalEmail]);

// Invalid shapes intentionally exercise JS boundary validation despite typed callers.
const account = (resolution: unknown, email: unknown, authorization: unknown) => evaluateInternalHrmsEmailEligibility(
  resolution as DeploymentResolution, email as string, authorization as InternalHrmsAccountAuthorization,
);
const recipient = (resolution: unknown, email: unknown, approved: unknown = undefined) => evaluateOutgoingEmailRecipientEligibility(
  resolution as DeploymentResolution, email as string, approved as readonly string[] | undefined,
);
const deny = (actual: unknown, reasonCode: string) => assert.deepEqual(actual, { eligible: false, reasonCode });

describe("internal HRMS account email eligibility", () => {
  for (const email of [externalEmail, companyEmail, "fixture@yahoo.com", "fixture@outlook.com", "fixture+tag@example.test"]) {
    it(`permits explicitly authorized staging test account ${email}`, () => {
      assert.deepEqual(account(staging, email, stagingAuthorization), { eligible: true, reasonCode: "STAGING_TEST_ACCOUNT_ELIGIBLE" });
    });
  }
  it("permits an authorized production company-domain account", () => {
    assert.deepEqual(account(production, companyEmail, productionAuthorization), { eligible: true, reasonCode: "PRODUCTION_ACCOUNT_EMAIL_ELIGIBLE" });
  });
  it("normalizes outer spaces and case without changing the exact production domain", () => {
    assert.equal(account(production, "  Policy.Fixture@ZENTRICANALYTICS.COM  ", productionAuthorization).eligible, true);
  });
  for (const [resolution, authorization] of [[staging, stagingAuthorization], [production, productionAuthorization]]) {
    it(`does not authorize ${resolution.status} from a company address alone`, () => {
      deny(account(resolution, companyEmail, { ...authorization, authorized: false }), "ACCOUNT_NOT_AUTHORIZED");
      deny(account(resolution, companyEmail, undefined), "INVALID_ACCOUNT_AUTHORIZATION");
    });
  }
  for (const email of [externalEmail, "fixture@zentricanalytics.com.evil.test", "fixture@sub.zentricanalytics.com", "fixture@zentric-analytics.com", "fixture@zentricanalytics.co", "fixture@notzentricanalytics.com"]) {
    it(`rejects external/lookalike production domain ${email}`, () => deny(account(production, email, productionAuthorization), "PRODUCTION_COMPANY_DOMAIN_REQUIRED"));
  }
  it("does not reuse authorization across environments", () => {
    deny(account(production, companyEmail, stagingAuthorization), "AUTHORIZATION_SCOPE_MISMATCH");
    deny(account(staging, externalEmail, productionAuthorization), "AUTHORIZATION_SCOPE_MISMATCH");
  });
  it("requires staging test-specific authorization, not just a generic HRMS assertion", () => {
    deny(account(staging, externalEmail, { ...stagingAuthorization, purpose: "INTERNAL_HRMS" }), "AUTHORIZATION_SCOPE_MISMATCH");
    deny(account(production, companyEmail, { ...productionAuthorization, purpose: "INTERNAL_HRMS_TEST" }), "AUTHORIZATION_SCOPE_MISMATCH");
  });
  for (const authorization of [null, [], true, "true", {}, { ...stagingAuthorization, authorized: "true" }, { ...stagingAuthorization, purpose: "PUBLIC_RECRUITMENT" }, { ...stagingAuthorization, environment: "test" }, { ...stagingAuthorization, emailAllowlisted: true }]) {
    it(`rejects malformed account authorization ${JSON.stringify(authorization)}`, () => deny(account(staging, externalEmail, authorization), "INVALID_ACCOUNT_AUTHORIZATION"));
  }
});

describe("outgoing recipient eligibility is separate from account authorization", () => {
  it("permits an exact normalized staging allowlist match", () => {
    assert.deepEqual(recipient(staging, `  ${externalEmail.toUpperCase()}  `, [` ${externalEmail} `]), { eligible: true, reasonCode: "STAGING_RECIPIENT_ALLOWLISTED" });
  });
  it("does not automatically approve staging company addresses", () => deny(recipient(staging, companyEmail, allowlist), "STAGING_RECIPIENT_NOT_ALLOWLISTED"));
  it("allows company recipients only when explicitly listed", () => assert.equal(recipient(staging, companyEmail, [companyEmail]).eligible, true));
  it("does not approve unlisted addresses or Gmail alias/dot variations", () => {
    for (const email of ["other@gmail.com", "u02.policy.fixture+tag@gmail.com", "u02policyfixture@gmail.com"]) {
      deny(recipient(staging, email, allowlist), "STAGING_RECIPIENT_NOT_ALLOWLISTED");
    }
  });
  it("does not expand wildcard-looking local parts or domain strings", () => {
    deny(recipient(staging, externalEmail, ["*@gmail.com"]), "STAGING_RECIPIENT_NOT_ALLOWLISTED");
    deny(recipient(staging, externalEmail, ["@gmail.com"]), "INVALID_STAGING_RECIPIENT_ALLOWLIST");
  });
  it("deduplicates complete normalized allowlist entries without broadening access", () => assert.equal(recipient(staging, externalEmail, [externalEmail, externalEmail.toUpperCase()]).eligible, true));
  for (const approved of [undefined, null, [], "[]", externalEmail, {}, new Set([externalEmail]), [undefined], [1], [externalEmail, "invalid"], [externalEmail, ""], ["Name <fixture@example.test>"], ["one@example.test,two@example.test"]]) {
    it(`denies missing/empty/malformed allowlist ${JSON.stringify(approved)}`, () => deny(recipient(staging, externalEmail, approved), "INVALID_STAGING_RECIPIENT_ALLOWLIST"));
  }
  it("rejects sparse and property-extended allowlists", () => {
    deny(recipient(staging, externalEmail, new Array(2)), "INVALID_STAGING_RECIPIENT_ALLOWLIST");
    deny(recipient(staging, externalEmail, Object.assign([externalEmail], { override: true })), "INVALID_STAGING_RECIPIENT_ALLOWLIST");
  });
  for (const approved of [undefined, null, [], "invalid", ["invalid"], [companyEmail]]) {
    it(`does not apply staging configuration to production: ${JSON.stringify(approved)}`, () => {
      assert.deepEqual(recipient(production, externalEmail, approved), { eligible: true, reasonCode: "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE" });
    });
  }
  it("does not read the staging allowlist at all for production", () => {
    const approved = Object.defineProperty([], "0", { get() { throw new Error("must not inspect"); } });
    assert.equal(recipient(production, externalEmail, approved).eligible, true);
  });
  it("never infers login authority from recipient approval", () => {
    assert.equal(recipient(staging, externalEmail, allowlist).eligible, true);
    deny(account(staging, externalEmail, { ...stagingAuthorization, authorized: false }), "ACCOUNT_NOT_AUTHORIZED");
  });
  it("does not block authorized staging login merely because email is not allowlisted", () => {
    assert.equal(account(staging, externalEmail, stagingAuthorization).eligible, true);
    deny(recipient(staging, externalEmail, [companyEmail]), "STAGING_RECIPIENT_NOT_ALLOWLISTED");
  });
});

describe("both policies require the full deployment contract and web workload", () => {
  const bothDeny = (resolution: unknown, reason: string) => {
    deny(account(resolution, companyEmail, stagingAuthorization), reason);
    deny(recipient(resolution, companyEmail, [companyEmail]), reason);
  };
  it("rejects an actual U02-I01 unverified result", () => {
    bothDeny(resolveDeploymentEnvironment(null, bindings, { kind: "render" }), "UNVERIFIED_ENVIRONMENT");
  });
  it("rejects actual U02-I01 synthetic fixture results", () => {
    const fixtureBinding = { ...stagingBinding, identitySource: "synthetic" };
    const result = resolveDeploymentEnvironment({ ...fixtureBinding, isPreview: false }, [fixtureBinding], { kind: "test", syntheticFixtures: true });
    assert.equal(result.status, "VERIFIED_STAGING");
    bothDeny(result, "SYNTHETIC_RESOLUTION_REJECTED");
  });
  for (const resolution of [
    undefined, null, [], "VERIFIED_STAGING", {}, { status: "VERIFIED_STAGING" },
    { ...staging, environment: "production" }, { ...production, environment: "staging" },
    { ...staging, reasonCode: "SYNTHETIC_BINDING_MATCH" },
    { ...staging, verificationBasis: "SYNTHETIC_FIXTURE" },
    { ...staging, verificationBasis: "CONFIGURATION_MATCH", reasonCode: "OTHER" },
    { ...staging, workloadType: "worker" }, { ...staging, workloadType: ["web", "cron"] },
    { ...staging, status: "VERIFIED_PREVIEW" }, { ...staging, override: true },
    { status: "UNVERIFIED", reasonCode: "INVALID_METADATA", environment: "staging" },
    { status: "UNVERIFIED", reasonCode: 1 },
  ]) {
    it(`rejects invalid/contradictory resolution ${JSON.stringify(resolution)}`, () => bothDeny(resolution, "INVALID_DEPLOYMENT_RESOLUTION"));
  }
  for (const key of ["reasonCode", "environment", "workloadType", "verificationBasis"]) {
    it(`does not trust verified status without ${key}`, () => {
      const resolution = { ...staging } as Record<string, unknown>;
      delete resolution[key];
      bothDeny(resolution, "INVALID_DEPLOYMENT_RESOLUTION");
    });
  }
  it("rejects a consistent configuration match for the wrong workload", () => {
    const cronBinding = { ...productionBinding, serviceId: "crn-policy-fixture", workloadType: "cron", configuredOrigin: undefined };
    const resolution = resolveDeploymentEnvironment({ ...cronBinding, isPreview: false }, [cronBinding], { kind: "render" });
    assert.equal(resolution.status, "VERIFIED_PRODUCTION");
    bothDeny(resolution, "WORKLOAD_NOT_PERMITTED");
  });
  it("rejects inherited, accessor and symbol-bearing resolution shapes", () => {
    bothDeny(Object.create(staging), "INVALID_DEPLOYMENT_RESOLUTION");
    bothDeny(Object.defineProperty({ ...staging }, "status", { get() { throw new Error("must not execute"); } }), "INVALID_DEPLOYMENT_RESOLUTION");
    bothDeny({ ...staging, [Symbol("override")]: true }, "INVALID_DEPLOYMENT_RESOLUTION");
  });
  it("accepts consistent null-prototype data records", () => assert.equal(recipient(Object.assign(Object.create(null), staging), externalEmail, allowlist).eligible, true));
});

describe("email syntax, determinism and side-effect safeguards", () => {
  for (const email of [undefined, null, 1, true, {}, [], new String(companyEmail), "", " ", "missing-at", "@zentricanalytics.com", "user@@zentricanalytics.com", "user@", ".user@example.test", "user.@example.test", "user..name@example.test", "user@-example.test", "user@example-.test", "user@localhost", "Name <user@example.test>", "user@example.test,other@example.test", "user@example.test\r\nBcc:x@example.test", " user@example.test\n", "user @example.test", "user@zentrіcanalytics.com", `${"x".repeat(65)}@example.test`]) {
    it(`rejects malformed email input ${JSON.stringify(email)}`, () => {
      deny(account(staging, email, stagingAuthorization), "INVALID_EMAIL_ADDRESS");
      deny(account(production, email, productionAuthorization), "INVALID_EMAIL_ADDRESS");
      deny(recipient(production, email), "INVALID_EMAIL_ADDRESS");
      deny(recipient(staging, email, allowlist), "INVALID_EMAIL_ADDRESS");
    });
  }
  it("rejects accessor authorization/allowlist inputs without invoking them", () => {
    const authorization = Object.defineProperty({ ...stagingAuthorization }, "authorized", { get() { throw new Error("must not execute"); } });
    deny(account(staging, externalEmail, authorization), "INVALID_ACCOUNT_AUTHORIZATION");
    const approved = Object.defineProperty([], "0", { get() { throw new Error("must not execute"); } });
    deny(recipient(staging, externalEmail, approved), "INVALID_STAGING_RECIPIENT_ALLOWLIST");
  });
  it("returns fixed reason codes without sensitive inputs", () => {
    const result = account(staging, "fixture-only-sensitive-token", stagingAuthorization);
    deny(result, "INVALID_EMAIL_ADDRESS");
    assert.equal(JSON.stringify(result).includes("fixture-only-sensitive-token"), false);
    assert.equal(JSON.stringify(recipient(staging, externalEmail, [companyEmail])).includes(externalEmail), false);
  });
  it("is deterministic with immutable inputs and immutable results", () => {
    const before = JSON.stringify([staging, production, stagingAuthorization, productionAuthorization, allowlist]);
    const expected = account(staging, externalEmail, stagingAuthorization);
    for (let i = 0; i < 50; i++) {
      assert.deepEqual(account(staging, externalEmail, stagingAuthorization), expected);
      assert.equal(recipient(staging, externalEmail, allowlist).eligible, true);
    }
    assert.equal(JSON.stringify([staging, production, stagingAuthorization, productionAuthorization, allowlist]), before);
    assert.equal(Object.isFrozen(expected), true);
    assert.equal(Object.isFrozen(recipient(production, externalEmail)), true);
    assert.equal(Object.isFrozen(account(null, externalEmail, stagingAuthorization)), true);
  });
  it("requires no environment, logging, timers, filesystem, subprocess or network APIs", () => {
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
      for (const [target, key] of guarded) Object.defineProperty(target, key, { configurable: true,
        get() { throw new Error("Policy attempted forbidden API access."); } });
      results.push(account(staging, externalEmail, stagingAuthorization));
      results.push(account(production, externalEmail, productionAuthorization));
      results.push(recipient(staging, externalEmail, allowlist));
      results.push(recipient(staging, companyEmail, allowlist));
      results.push(recipient(production, externalEmail));
    } finally {
      guarded.forEach(([target, key], index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      });
    }
    assert.deepEqual(results, [
      { eligible: true, reasonCode: "STAGING_TEST_ACCOUNT_ELIGIBLE" },
      { eligible: false, reasonCode: "PRODUCTION_COMPANY_DOMAIN_REQUIRED" },
      { eligible: true, reasonCode: "STAGING_RECIPIENT_ALLOWLISTED" },
      { eligible: false, reasonCode: "STAGING_RECIPIENT_NOT_ALLOWLISTED" },
      { eligible: true, reasonCode: "PRODUCTION_RECIPIENT_ENVIRONMENT_ELIGIBLE" },
    ]);
  });
});
