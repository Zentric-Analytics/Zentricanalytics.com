import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_NG_2026_9_ENTRY_POINTS = [
  "src/lib/hr/payroll/nigeria-2026-9.ts",
  "src/lib/hr/payroll/unit9-engine-2026-9.ts",
  "src/lib/hr/payroll/unit9-candidate-certification.ts",
  "src/lib/hr/payroll/unit9-service.ts",
  "src/lib/hr/payroll/unit9-financial-service.ts",
];

const normalize = (value) => value.split(path.sep).join("/");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function resolveRelativeImport(fromFile, specifier, root) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(path.resolve(root, fromFile)), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return match ? normalize(path.relative(root, match)) : null;
}

export function buildNg2026_9DependencyInventory(entryPoints = DEFAULT_NG_2026_9_ENTRY_POINTS, root = repositoryRoot, readFile = fs.readFileSync) {
  const pending = [...entryPoints];
  const visited = new Set();
  const records = [];
  while (pending.length) {
    const relativePath = normalize(pending.shift());
    if (visited.has(relativePath)) continue;
    const absolutePath = path.resolve(root, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`NG_2026_9_CALCULATION_DEPENDENCY_MISSING:${relativePath}`);
    const bytes = readFile(absolutePath);
    const source = bytes.toString("utf8");
    const imports = [];
    const pattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      if (!match[1].startsWith(".")) continue;
      const dependency = resolveRelativeImport(relativePath, match[1], root);
      if (!dependency) throw new Error(`NG_2026_9_CALCULATION_DEPENDENCY_MISSING:${relativePath}:${match[1]}`);
      imports.push(dependency);
      pending.push(dependency);
    }
    records.push({ path: relativePath, sha256: sha256(bytes), imports: [...new Set(imports)].sort() });
    visited.add(relativePath);
  }
  records.sort((left, right) => left.path.localeCompare(right.path));
  const inventory = { candidateVersion: "NG-CANDIDATE-2026.9", candidateStatus: "NOT_CERTIFIED", algorithm: "SHA-256", entryPoints: [...entryPoints].sort(), files: records };
  return { ...inventory, inventorySha256: sha256(Buffer.from(JSON.stringify(inventory))) };
}

export function assertNg2026_9InventoryComplete(inventory, root = repositoryRoot) {
  const indexed = new Set(inventory.files.map((entry) => entry.path));
  for (const entry of inventory.files) {
    const bytes = fs.readFileSync(path.resolve(root, entry.path));
    if (sha256(bytes) !== entry.sha256) throw new Error(`NG_2026_9_CALCULATION_DEPENDENCY_CHANGED:${entry.path}`);
    for (const dependency of entry.imports) if (!indexed.has(dependency)) throw new Error(`NG_2026_9_CALCULATION_DEPENDENCY_MISSING:${dependency}`);
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = buildNg2026_9DependencyInventory();
  const output = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (output) fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
  else process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}
