export type Ng2026_9DependencyRecord = {
  path: string;
  sha256: string;
  imports: string[];
};

export type Ng2026_9DependencyInventory = {
  candidateVersion: "NG-CANDIDATE-2026.9";
  candidateStatus: "NOT_CERTIFIED";
  algorithm: "SHA-256";
  entryPoints: string[];
  files: Ng2026_9DependencyRecord[];
  inventorySha256: string;
};

export const DEFAULT_NG_2026_9_ENTRY_POINTS: string[];
export function buildNg2026_9DependencyInventory(entryPoints?: string[], root?: string): Ng2026_9DependencyInventory;
export function assertNg2026_9InventoryComplete(inventory: Ng2026_9DependencyInventory, root?: string): true;
