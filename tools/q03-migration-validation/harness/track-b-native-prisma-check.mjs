import { pathToFileURL } from 'node:url';
import { id, queue } from './fixtures.mjs';
import { requireNativeLiveEntry } from './track-b-native-postgres.mjs';

const target = 'q03_replacement_track_b';
const version = 180006;

function requireFact(condition) {
  if (!condition) throw Error('NATIVE_PRISMA_VERIFICATION_FAILED');
}

export function verifyPrismaConnection(input) {
  requireFact(input?.database === target && /^q03_replacement_[a-z0-9_]{1,36}$/.test(input.role)
    && /^[a-f0-9]{64}$/.test(input.marker) && /^q03b_[a-f0-9]{24}$/.test(input.tag));
  const url = new URL(input.url);
  const options = new Map(url.searchParams);
  requireFact(url.protocol === 'postgresql:' && url.hostname === '127.0.0.1' && url.port === '5432'
    && url.pathname === '/' + target && url.username === input.role && !url.hash
    && /^[a-f0-9]{64}$/.test(url.password) && [...url.searchParams].length === options.size
    && options.size === 4 && options.get('application_name') === input.tag
    && options.get('connect_timeout') === '5' && options.get('connection_limit') === '1'
    && options.get('options') === '-c statement_timeout=120000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000');
}

export async function verifyPrismaTransaction(client, input) {
  verifyPrismaConnection(input);
  const fixture = queue('native_prisma_transaction');
  const selector = { id: fixture.id, organizationId: fixture.organizationId };
  const intentionalRollback = new Error('NATIVE_INTENTIONAL_PRISMA_ROLLBACK');
  let fakeProviderCalls = 0;
  const fakeProvider = recipient => {
    requireFact(recipient.endsWith('@example.invalid'));
    fakeProviderCalls++;
  };
  const identity = async tx => {
    const rows = await tx.$queryRaw`
      SELECT current_database() = ${target} AND current_user::text = ${input.role}
        AND current_user = session_user AND inet_server_addr() = '127.0.0.1'::inet
        AND current_setting('server_version_num')::int = ${version}
        AND current_setting('application_name') = ${input.tag}
        AND current_setting('zentric.q03_replacement_marker',true) = ${input.marker}
        AND EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
          WHERE d.datname=current_database() AND r.rolname=current_user
            AND NOT r.rolsuper AND NOT r.rolcreaterole AND NOT r.rolcreatedb
            AND NOT r.rolreplication AND NOT r.rolbypassrls) AS verified
    `;
    requireFact(rows.length === 1 && rows[0].verified === true);
  };
  const transaction = fn => client.$transaction(async tx => {
    await identity(tx);
    return fn(tx.hrEmailOutbox);
  }, { maxWait: 3000, timeout: 10_000 });

  try {
    await transaction(async outbox => {
      requireFact(await outbox.count({ where: selector }) === 0);
      await outbox.create({ data: { ...fixture, payload: JSON.parse(fixture.payload), status: 'PENDING' } });
      const observed = await outbox.findFirst({ where: { ...selector, status: 'PENDING', dispatchPhase: 'NONE' } });
      requireFact(observed?.version === 0 && observed.recipient === fixture.recipient);
      const fenced = await outbox.updateMany({ where: { ...selector, version: 1 }, data: { version: 2 } });
      if (fenced.count > 0) fakeProvider(observed.recipient);
      requireFact(fenced.count === 0 && fakeProviderCalls === 0);
      requireFact(await outbox.count({ where: { id: fixture.id, organizationId: id('org_cobalt') } }) === 0);
      throw intentionalRollback;
    });
    throw Error('NATIVE_PRISMA_ROLLBACK_NOT_OBSERVED');
  } catch (error) {
    if (error !== intentionalRollback) throw error;
  }
  await transaction(async outbox => {
    requireFact(await outbox.count({ where: selector }) === 0 && fakeProviderCalls === 0);
  });
}

async function main() {
  requireNativeLiveEntry();
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    requireFact(input.length <= 4096);
  }
  const binding = JSON.parse(input);
  verifyPrismaConnection(binding);
  const { Prisma, PrismaClient } = (await import('/work/zentric-native-track-b/generated/index.js')).default;
  requireFact(Prisma.prismaVersion.client === '6.10.1'
    && Prisma.prismaVersion.engine === '9b628578b3b7cae625e8c927178f15a170e74a9c');
  const client = new PrismaClient({ datasourceUrl: binding.url, log: [] });
  try {
    await verifyPrismaTransaction(client, binding);
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    console.error('NATIVE_PRISMA_VERIFICATION_FAILED');
    process.exitCode = 1;
  });
}
