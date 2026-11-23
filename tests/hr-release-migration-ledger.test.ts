import { expect, it, vi } from "vitest";
import { assertReleaseMigrationLedger, verifyReleaseMigrationLedger } from "../scripts/hr-migration-ledger.mjs";

const organization = {
  name: "20260730110000_hrms_organization_management",
  checksum: "17a3263920f59cca9ceb2c558cef228c92a0635d6c3bd788793edee84fc2cb20",
};
const queue = { name: "20261029000100_email_queue_held_enum", checksum: "a".repeat(64) };
const source = [organization, queue];
const completed = { ...organization, finished: true, rolledBack: false };
const historicalChecksum = "3affd6eafb43dfcdf8eb3e41ea67330dd233b0a83a27c0e3656e8702de991fcb";

it("blocks the staging organization checksum even when the queue migration is merely pending", () => {
  expect(() => assertReleaseMigrationLedger(source, [{ ...completed, checksum: historicalChecksum }]))
    .toThrow(`Release migration checksum differs at ${organization.name}`);
});

it("permits a matching prefix with a superseded rolled-back attempt", () => {
  expect(() => assertReleaseMigrationLedger(source, [
    { ...completed, checksum: historicalChecksum, finished: false, rolledBack: true },
    completed,
  ])).not.toThrow();
});

it("rejects unresolved attempts, missing predecessors and duplicate successes", () => {
  expect(() => assertReleaseMigrationLedger(source, [{ ...completed, finished: false }])).toThrow("unresolved");
  expect(() => assertReleaseMigrationLedger(source, [{ ...queue, finished: true, rolledBack: false }])).toThrow("predecessor");
  expect(() => assertReleaseMigrationLedger(source, [completed, completed])).toThrow("unresolved");
});

it("rejects completed migrations applied out of order even when both checksums are correct", () => {
  expect(() => assertReleaseMigrationLedger(source, [
    { ...queue, finished: true, rolledBack: false },
    completed,
  ])).toThrow("Release ledger order differs");
});

function database(publicSchema: boolean, hasLedger: boolean, hasObjects: boolean) {
  const $executeRaw = vi.fn();
  const $queryRaw = vi.fn().mockResolvedValueOnce([{ publicSchema, hasLedger, hasObjects }]).mockResolvedValueOnce([]);
  return {
    $executeRaw, $queryRaw,
    $transaction: vi.fn(async (action: (tx: { $executeRaw: typeof $executeRaw; $queryRaw: typeof $queryRaw }) => Promise<void>) =>
      action({ $executeRaw, $queryRaw })),
  };
}

it("checks the database in a read-only transaction and distinguishes a clean first install", async () => {
  const clean = database(true, false, false);
  await expect(verifyReleaseMigrationLedger(clean, source)).resolves.toBeUndefined();
  expect(clean.$executeRaw).toHaveBeenCalledWith(["SET TRANSACTION READ ONLY"]);
  expect(clean.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  expect(clean.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(clean.$queryRaw.mock.invocationCallOrder[0]);
  await expect(verifyReleaseMigrationLedger(database(true, false, true), source)).rejects.toThrow("no Prisma migration ledger");
  await expect(verifyReleaseMigrationLedger(database(true, true, true), source)).rejects.toThrow("no completed migrations");
  await expect(verifyReleaseMigrationLedger(database(false, true, false), source)).rejects.toThrow("expected public schema");
});
