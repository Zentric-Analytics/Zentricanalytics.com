import type { HrPositionLifecycleStatus } from "@prisma/client";

export function wouldCreateHierarchyCycle(records: Array<{ id: string; parentId: string | null }>, id: string, parentId?: string | null) {
  if (!parentId) return false;
  if (id === parentId) return true;
  const parents = new Map(records.map((record) => [record.id, record.parentId]));
  let cursor: string | null | undefined = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === id || visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parents.get(cursor);
  }
  return false;
}

const transitions: Record<HrPositionLifecycleStatus, readonly HrPositionLifecycleStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  APPROVED: ["OPEN", "FROZEN", "CANCELLED"],
  OPEN: ["PARTIALLY_FILLED", "FILLED", "FROZEN", "CLOSED"],
  PARTIALLY_FILLED: ["OPEN", "FILLED", "FROZEN", "CLOSED"],
  FILLED: ["OPEN", "PARTIALLY_FILLED", "FROZEN", "CLOSED"],
  FROZEN: ["OPEN", "CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function assertPositionTransition(from: HrPositionLifecycleStatus, to: HrPositionLifecycleStatus) {
  if (!transitions[from].includes(to)) throw new Error(`Position cannot move from ${from} to ${to}.`);
}

export function positionOccupancyStatus(input: { activeCount: number; occupiedFte: number; headcountLimit: number; fullTimeEquivalent: number }): HrPositionLifecycleStatus {
  if (input.activeCount <= 0) return "OPEN";
  if (input.activeCount > input.headcountLimit || input.occupiedFte > input.fullTimeEquivalent) throw new Error("Position capacity would be exceeded.");
  return input.activeCount === input.headcountLimit || input.occupiedFte === input.fullTimeEquivalent ? "FILLED" : "PARTIALLY_FILLED";
}

export function assertEffectiveInterval(effectiveFrom: Date, effectiveTo?: Date | null) {
  if (Number.isNaN(effectiveFrom.getTime()) || (effectiveTo && effectiveTo <= effectiveFrom)) throw new Error("The effective interval is invalid.");
}
