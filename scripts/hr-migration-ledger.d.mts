type Migration = { name: string; checksum: string };
type LedgerEntry = Migration & { finished: boolean; rolledBack: boolean };
type LedgerTransaction = {
  $executeRaw(query: TemplateStringsArray): Promise<unknown>;
  $queryRaw(query: TemplateStringsArray): Promise<unknown>;
};

export function readReleaseMigrations(directory?: URL): Promise<Migration[]>;
export function assertReleaseMigrationLedger(source: Migration[], ledger: LedgerEntry[]): void;
export function verifyReleaseMigrationLedger(
  prisma: { $transaction(action: (tx: LedgerTransaction) => Promise<void>): Promise<void> },
  source: Migration[],
  environment?: string,
): Promise<void>;
