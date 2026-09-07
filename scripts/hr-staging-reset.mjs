// Operator-only staging reset. Never called from application build/start/release.
// Defaults to read-only inspection. Requires an explicit, recent backup attestation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require('@prisma/client');
const target = {
  service: 'srv-d8s6ovvavr4c73fctksg',
  databaseHost: 'dpg-d8s9itj6sc1c73c6vsl0-a',
  baseUrl: 'https://staging.zentricanalytics.com',
};
const execute = process.argv.includes('--execute');
const dbUrl = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(process.env.APP_ENV, 'staging', 'Only staging is allowed');
assert.equal(process.env.RENDER_SERVICE_ID, target.service, 'Wrong service');
assert.equal(String(process.env.APPLICATION_BASE_URL).replace(/\/$/, ''), target.baseUrl, 'Wrong application');
assert.equal(dbUrl.hostname.split('.')[0], target.databaseHost, 'Wrong database');
if (execute) {
  assert.equal(process.env.STAGING_RESET_CONFIRM, 'clear-staging-preserve-primary-admin', 'Missing reset confirmation');
  const backupTime = Date.parse(process.env.STAGING_RESET_BACKUP_COMPLETED_AT || '');
  assert(Number.isFinite(backupTime) && backupTime <= Date.now() && Date.now() - backupTime < 3600000,
    'A completed backup within the last hour must be confirmed');
}
const p = new PrismaClient();
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const models = Prisma.dmmf.datamodel.models;
const tables = models.map(m => m.dbName || m.name).sort();
assert(tables.every(t => /^[A-Za-z][A-Za-z0-9_]*$/.test(t)));
const allTables = tables.map(t => 'public.' + quote(t)).join(', ');
// Restore order respects all foreign keys among retained foundation tables.
const keep = [
  ['HrOrganization', 'id'],
  ['HrUser', 'id'],
  ['HrRole', 'organizationId'],
  ['HrPermission', 'organizationId'],
  ['HrRolePermission', null],
  ['HrUserRole', 'userId'],
  ['HrSession', 'userId'],
  ['HrPasswordResetToken', 'userId'],
  ['HrPasswordResetChallenge', 'userId'],
  ['HrOrganizationSetting', 'organizationId'],
  ['HrNotificationPreference', 'userId'],
];
const serial = value => JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v);
async function inspect(tx) {
  const live = await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  assert.deepEqual(live.map(r => r.tablename).filter(t => t !== '_prisma_migrations').sort(), tables,
    'Live table manifest differs from reviewed Prisma schema');
  const admins = await tx.hrUser.findMany({ where: { isPrimaryAdmin: true }, select: { id: true, organizationId: true, email: true, status: true, mfaEnabled: true, employee: { select: { id: true } } } });
  assert.equal(admins.length, 1, 'Exactly one primary administrator required');
  const admin = admins[0];
  assert.equal(admin.email.toLowerCase(), 'admin@zentricanalytics.com', 'Unexpected primary administrator');
  assert.equal(admin.status, 'ACTIVE');
  assert.equal(admin.mfaEnabled, true, 'Primary administrator MFA must remain enabled');
  assert.equal(admin.employee, null, 'Primary administrator has an employee dependency; stop for review');
  assert.equal(await tx.hrOrganization.count(), 1, 'Multiple organizations require a separate reset plan');
  assert(await tx.hrUserRole.count({ where: { userId: admin.id, revokedAt: null, role: { key: 'ADMIN' } } }) > 0,
    'Primary administrator has no active admin role');
  const counts = {};
  for (const table of tables) {
    const [row] = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM public.' + quote(table));
    if (row.count) counts[table] = row.count;
  }
  return { admin, counts };
}
try {
  await p.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '15s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '45s'");
    if (execute) await tx.$executeRawUnsafe('LOCK TABLE ' + allTables + ' IN ACCESS EXCLUSIVE MODE');
    const { admin, counts } = await inspect(tx);
    console.info('VERIFIED staging target, one active primary admin with MFA and admin permissions.');
    console.info('BEFORE aggregate row counts', JSON.stringify(counts));
    if (!execute) { console.info('DRY RUN ONLY: no data changed.'); return; }
    const adminBefore = serial(await tx.hrUser.findUnique({ where: { id: admin.id } }));
    const migrationsBefore = serial(await tx.$queryRawUnsafe('SELECT * FROM public._prisma_migrations ORDER BY id'));
    const expected = new Map();
    for (const [table, column] of keep) {
      const temp = quote('reset_keep_' + table);
      let predicate = '';
      let params = [];
      if (column) {
        predicate = ' WHERE ' + quote(column) + ' = $1';
        params = [table === 'HrOrganization' || column === 'organizationId' ? admin.organizationId : admin.id];
      }
      await tx.$executeRawUnsafe('CREATE TEMP TABLE ' + temp + ' ON COMMIT DROP AS SELECT * FROM public.' + quote(table) + predicate, ...params);
      const [count] = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM ' + temp);
      expected.set(table, count.count);
    }
    // Explicit all-table RESTRICT, no CASCADE or schema changes. Any exception rolls back everything.
    await tx.$executeRawUnsafe('TRUNCATE TABLE ' + allTables + ' RESTRICT');
    for (const [table] of keep) {
      await tx.$executeRawUnsafe('INSERT INTO public.' + quote(table) + ' SELECT * FROM ' + quote('reset_keep_' + table));
    }
    assert.equal(serial(await tx.hrUser.findUnique({ where: { id: admin.id } })), adminBefore,
      'Primary administrator changed; rolling back');
    assert.equal(serial(await tx.$queryRawUnsafe('SELECT * FROM public._prisma_migrations ORDER BY id')), migrationsBefore,
      'Migration history changed; rolling back');
    const after = {};
    for (const table of tables) {
      const [row] = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM public.' + quote(table));
      assert.equal(row.count, expected.get(table) || 0, 'Unexpected remaining rows in ' + table);
      if (row.count) after[table] = row.count;
    }
    console.info('AFTER retained foundation row counts', JSON.stringify(after));
    console.info('VERIFIED primary account fields unchanged; sessions/MFA/role definitions/configuration preserved; business tables empty.');
  }, { timeout: 120000, maxWait: 15000 });
  console.info(execute ? 'STAGING RESET COMMITTED.' : 'Read-only inspection complete.');
} catch (error) {
  console.error('RESET BLOCKED OR ROLLED BACK:', error instanceof assert.AssertionError ? error.message : 'Database operation failed; transaction was not committed.');
  process.exitCode = 1;
} finally { await p.$disconnect(); }
