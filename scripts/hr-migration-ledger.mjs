import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const migrationsDirectory = new URL("../prisma/migrations/", import.meta.url);

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

export function assertReleaseMigrationLedger(source, ledger) {
  const known = new Set(source.map(({ name }) => name));
  const completed = new Map();
  for (const row of ledger) {
    if (!known.has(row.name)) throw new Error("Release ledger contains a migration outside the candidate source.");
    if (row.rolledBack) continue;
    if (!row.finished || completed.has(row.name)) throw new Error(`Release ledger is unresolved at ${row.name}.`);
    completed.set(row.name, row.checksum);
  }
  for (const [index, { name, checksum }] of source.entries()) {
    if (index < completed.size && !completed.has(name)) throw new Error(`Release ledger is missing predecessor ${name}.`);
    if (completed.has(name) && completed.get(name) !== checksum) throw new Error(`Release migration checksum differs at ${name}.`);
  }
}

export async function verifyReleaseMigrationLedger(prisma, source) {
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
    `;
    if (catalog.hasObjects && !ledger.some((row) => row.finished && !row.rolledBack)) {
      throw new Error("Release database has objects but no completed migrations.");
    }
    assertReleaseMigrationLedger(source, ledger);
  });
}
