import { open } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { B1, assertLedger, digest, reviewedInputs } from './b1-contract.mjs';
import { assertOverlap } from './concurrency.mjs';
import { RACE_CASES } from './db-tests.mjs';
import { assertHistoricalPreserved, assertHistoricalSnapshot } from './evidence-rules.mjs';
import { baseFixturesSQL, legacyFixturesSQL, id } from './fixtures.mjs';

const target = 'q03_1960147fab_track_b';
const runtime = Object.freeze({ node: '22.23.3', prisma: '6.10.1', revision: B1.revision, serverVersion: 180006 });
const resources = Object.freeze({
  endpoint: B1.endpoint, container: B1.container, databaseImage: B1.databaseImage,
  network: B1.network, networkName: B1.networkName, volume: B1.volume, runnerImage: B1.image,
  volumeDriver: 'local', volumeMount: '/var/lib/postgresql', restartPolicy: 'no',
  internalNetwork: true, onlyDatabasePeer: true, publishedPorts: 0, runnerHasDataMount: false,
  noProviderEgress: true, verifiedLabels: true,
});
const fixtureHashes = Object.freeze({ base: digest(baseFixturesSQL()), legacy: digest(legacyFixturesSQL()) });
const legacyStatuses = ['PENDING', 'PROCESSING', 'FAILED', 'DELIVERED', 'ABANDONED'];

class Stop extends Error {}

function requireFact(condition, code) {
  if (!condition) throw new Stop(code);
}

function verifyLedger(rows, expected) {
  assertLedger(rows, expected, false);
  requireFact(rows.length === expected.length && rows.every(row => row.finished && row.steps === 1 && row.logs === null), 'LEDGER_INCOMPLETE');
}

function verifyPreflight(receipt) {
  requireFact(Object.entries(resources).every(([key, value]) => receipt.resources?.[key] === value), 'RESOURCE_MISMATCH');
  requireFact(Object.entries(runtime).every(([key, value]) => receipt.runtime?.[key] === value), 'RUNTIME_MISMATCH');
  requireFact(receipt.database === B1.baseline && receipt.role === B1.role && receipt.readOnly === true
    && receipt.publicObjects === 0 && receipt.syntheticOnly === true, 'BASELINE_IDENTITY_MISMATCH');
  requireFact(receipt.targetExists === false, 'TARGET_COLLISION_OR_UNKNOWN');
}

function verifySyntheticSnapshot(snapshot) {
  assertHistoricalSnapshot(snapshot);
  requireFact(legacyStatuses.every((status, index) => {
    const outboxId = id('legacy_' + status.toLowerCase());
    const row = snapshot.outbox.find(item => item.id === outboxId);
    if (row?.status !== status || row.recipient !== 'legacy-' + index + '@example.invalid' || row.attemptCount !== index) return false;
    const attempts = snapshot.attempts.filter(item => item.outboxId === outboxId);
    return attempts.length === index && attempts.every((_, offset) => {
      const number = offset + 1;
      return attempts.some(attempt => attempt.id === id('legacy_attempt_' + index + '_' + number)
        && attempt.attemptNumber === number && attempt.status === status);
    });
  }) && ['audit_aurora', 'audit_cobalt'].every(name => snapshot.audit.some(row => row.id === id(name))),
  'SYNTHETIC_SNAPSHOT_REQUIRED');
}

function verifyBehavior(receipt) {
  requireFact(receipt.constraintsVerified === true && receipt.journalVerified === true
    && receipt.rollbackVerified === true && receipt.syntheticSessionsClosed === true, 'BEHAVIOR_CHECKS_INCOMPLETE');
  requireFact(Array.isArray(receipt.races) && receipt.races.length === RACE_CASES.length, 'RACE_SET_INCOMPLETE');
  for (const [index, [name, , left]] of RACE_CASES.entries()) {
    const race = receipt.races[index];
    const interrupted = name === 'interrupted_lock';
    requireFact(race.name === name && race.leader === (interrupted ? null : 1)
      && race.follower === (interrupted ? 1 : 0) && race.interrupted === interrupted
      && race.version === 1 && race.events === 1 && race.eventVersion === 1
      && race.counter === (left === 'INVOCATION_BOUNDARY' ? 1 : 0), 'RACE_OUTCOME_MISMATCH');
    assertOverlap(race.proof);
  }
  return { raceCount: RACE_CASES.length };
}

async function bounded(callback, timeoutMs, signal) {
  const controller = new AbortController();
  let timer;
  let abort;
  try {
    const stop = new Promise((_, reject) => {
      abort = () => {
        controller.abort();
        reject(new Stop('CANCELLED'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(new Stop('TIMEOUT'));
      }, timeoutMs);
    });
    if (signal?.aborted) {
      abort();
      return await stop;
    }
    return await Promise.race([stop, Promise.resolve().then(() => callback(controller.signal))]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * Offline coordinator. The fake receives only fixed stage names and reviewed
 * metadata. This module has no PostgreSQL/Docker adapter or execution authority.
 */
export async function runTrackBOffline({ fake, evidencePath, signal, timeoutMs = 1000 } = {}) {
  requireFact(fake?.mode === 'offline-fixture' && typeof fake.step === 'function', 'OFFLINE_ADAPTER_REQUIRED');
  requireFact(typeof evidencePath === 'string' && isAbsolute(evidencePath)
    && /^track-b-[a-z0-9-]+\.jsonl$/.test(basename(evidencePath)), 'EXCLUSIVE_EVIDENCE_PATH_REQUIRED');
  requireFact(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 5000, 'INVALID_TIMEOUT');
  const inputs = reviewedInputs(
    readFileSync(new URL('./input-manifest.json', import.meta.url)),
    file => readFileSync(new URL(file, import.meta.url)),
  );
  const historical = Object.freeze(inputs.slice(0, 66));
  const upgrade = Object.freeze(inputs.slice(66));
  const handle = await open(evidencePath, 'wx', 0o600);
  let stage = 'start';
  const record = async (event, details = {}) => {
    await handle.writeFile(JSON.stringify({ mode: 'offline-fixture', event, stage, ...details }) + '\n');
    await handle.sync();
  };
  const step = async (name, requirements, verify) => {
    stage = name;
    await record('begin');
    const receipt = await bounded(
      stepSignal => fake.step(name, Object.freeze({ target, ...requirements }), stepSignal),
      timeoutMs, signal,
    );
    const evidence = verify(receipt);
    await record('verified', evidence);
  };
  try {
    await record('exclusive-marker', { manifest: B1.manifest, migrations: inputs.length });
    await step('preflight', { resources, runtime }, verifyPreflight);
    await step('create-target', {}, receipt => {
      requireFact(receipt.database === target && receipt.owner === B1.role && receipt.publicObjects === 0
        && receipt.created === true, 'TARGET_CREATION_UNVERIFIED');
    });
    await step('apply-historical', { migrations: historical }, ledger => {
      verifyLedger(ledger, historical);
      return { migrationCount: historical.length };
    });
    let before;
    await step('seed-and-capture-legacy', { fixtureHashes }, receipt => {
      requireFact(receipt.baseHash === fixtureHashes.base && receipt.legacyHash === fixtureHashes.legacy, 'FIXTURE_HASH_MISMATCH');
      requireFact(receipt.safetyMetadataAbsent === true, 'PRE_UPGRADE_SHAPE_MISMATCH');
      verifySyntheticSnapshot(receipt.snapshot);
      before = structuredClone(receipt.snapshot);
      return { outbox: 5, attempts: 10, audit: 2 };
    });
    await step('apply-upgrade', { migrations: upgrade }, ledger => {
      verifyLedger(ledger, inputs);
      return { migrationCount: inputs.length };
    });
    await step('verify-upgrade', {}, receipt => {
      verifySyntheticSnapshot(receipt.snapshot);
      assertHistoricalPreserved(before, receipt.snapshot);
      requireFact(receipt.catalogVerified === true && receipt.safetyShapeVerified === true, 'UPGRADE_CHECKS_INCOMPLETE');
    });
    await step('verify-behavior', {}, verifyBehavior);
    await record('offline-pass');
    return 'OFFLINE_PASS';
  } catch (error) {
    // Never retain adapter errors, receipt content, credentials or subprocess output.
    const reason = error instanceof Stop ? error.message : 'STEP_OR_EVIDENCE_REJECTED';
    try {
      await record('stop-preserve', { reason });
    } catch {
      throw new Stop('EVIDENCE_WRITE_FAILED_PRESERVE');
    }
    throw new Stop(reason);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error('TRACK_B_REAL_EXECUTION_UNAVAILABLE');
  process.exitCode = 1;
}
