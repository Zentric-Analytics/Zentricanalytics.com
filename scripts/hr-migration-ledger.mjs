import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const migrationsDirectory = new URL("../prisma/migrations/", import.meta.url);
const organizationMigration = "20260730110000_hrms_organization_management";
const organizationBackfill = "20260730120000_hrms_organization_default_backfill";
const originalOrganizationChecksum = "3affd6eafb43dfcdf8eb3e41ea67330dd233b0a83a27c0e3656e8702de991fcb";
const candidateOrganizationChecksum = "17a3263920f59cca9ceb2c558cef228c92a0635d6c3bd788793edee84fc2cb20";
const stagingOrganizationFingerprint = "03af544db91a3af2cb37f24ab48d0401dfc853128666a8d0ea474b08d2036f94";

export async function readReleaseMigrations(directory = migrationsDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!names.length || names.some((name) => !/^\d{14}_[a-z0-9_]+$/.test(name))) {
    throw new Error("Release migration source is incomplete or malformed.");
  }
  return Promise.all(names.map(async (name) => {
    const bytes = await readFile(new URL(`${name}/migration.sql`, directory));
    return { name, checksum: createHash("sha256").update(bytes).digest("hex") };
  }));
}

export function assertReleaseMigrationLedger(source, ledger, organizationVariantVerified = false) {
  const known = new Set(source.map(({ name }) => name));
  const completed = new Set();
  for (const row of ledger) {
    if (!known.has(row.name)) throw new Error("Release ledger contains a migration outside the candidate source.");
    if (row.rolledBack) continue;
    if (!row.finished || completed.has(row.name)) throw new Error(`Release ledger is unresolved at ${row.name}.`);
    const expected = source[completed.size];
    if (!expected || expected.name !== row.name) {
      throw new Error(`Release ledger order differs at ${row.name}. Expected predecessor ${expected?.name ?? "none"}.`);
    }
    const verifiedVariant = organizationVariantVerified && row.name === organizationMigration &&
      row.checksum === originalOrganizationChecksum && expected.checksum === candidateOrganizationChecksum;
    if (expected.checksum !== row.checksum && !verifiedVariant) {
      throw new Error(`Release migration checksum differs at ${row.name}.`);
    }
    completed.add(row.name);
  }
}

export async function verifyReleaseMigrationLedger(prisma, source, environment) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [catalog] = await tx.$queryRaw`
      SELECT current_schema() = 'public' AS "publicSchema",
             to_regclass('public._prisma_migrations') IS NOT NULL AS "hasLedger",
             EXISTS (SELECT 1 FROM pg_class
              WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r','p','v','m','S','f')
                AND relname <> '_prisma_migrations') AS "hasObjects"
    `;
    if (!catalog.publicSchema) throw new Error("Release database is not using the expected public schema.");
    if (!catalog.hasLedger) {
      if (catalog.hasObjects) throw new Error("Release database has objects but no Prisma migration ledger.");
      return;
    }
    const ledger = await tx.$queryRaw`
      SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished,
             rolled_back_at IS NOT NULL AS "rolledBack" FROM public._prisma_migrations
      ORDER BY started_at, migration_name
    `;
    if (catalog.hasObjects && !ledger.some((row) => row.finished && !row.rolledBack)) {
      throw new Error("Release database has objects but no completed migrations.");
    }
    const needsOrganizationVerification = environment === "staging" &&
      source.some((row) => row.name === organizationMigration && row.checksum === candidateOrganizationChecksum) &&
      ledger.some((row) => row.name === organizationMigration && row.finished && !row.rolledBack &&
        row.checksum === originalOrganizationChecksum) &&
      ledger.some((row) => row.name === organizationBackfill && row.finished && !row.rolledBack);
    const organizationVariantVerified = needsOrganizationVerification && await verifyStagingOrganizationShape(tx);
    assertReleaseMigrationLedger(source, ledger, organizationVariantVerified);
  }, { isolationLevel: "RepeatableRead" });
}

async function verifyStagingOrganizationShape(tx) {
  // The original SQL omitted these three tables. Verify the separately applied
  // definitions, including validity and defaults, before accepting that history.
  const [catalog] = await tx.$queryRaw`
    WITH tables(name) AS (
      VALUES ('HrOrganizationImportBatch'), ('HrOrganizationImportRow'), ('HrOrganizationStructureRevision')
    ), shape AS (
      SELECT table_name AS tbl, 'column' AS kind, ordinal_position::text AS key,
             jsonb_build_array(column_name, data_type, is_nullable, column_default, datetime_precision)::text AS definition
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN (SELECT name FROM tables)
      UNION ALL
      SELECT c.relname, 'constraint', con.conname,
             jsonb_build_array(con.convalidated, pg_get_constraintdef(con.oid))::text
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN (SELECT name FROM tables) AND con.contype <> 'n'
      UNION ALL
      SELECT c.relname, 'index', ci.relname,
             jsonb_build_array(i.indisvalid, i.indisready, pg_get_indexdef(ci.oid))::text
      FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_class ci ON ci.oid = i.indexrelid
      WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN (SELECT name FROM tables)
    )
    SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(shape)
      ORDER BY tbl COLLATE "C", kind COLLATE "C", key COLLATE "C")::text, 'UTF8')), 'hex') AS fingerprint
    FROM shape
  `;
  return catalog?.fingerprint === stagingOrganizationFingerprint;
}
