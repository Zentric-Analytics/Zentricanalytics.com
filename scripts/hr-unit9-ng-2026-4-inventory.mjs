import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-compensation-inventory.json");
const raw = execFileSync("git", ["grep", "-n", "-i", "-E", "compensation|variable_compensation|discretionary_compensation", "--", ":(exclude)docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-compensation-inventory.json", ":(exclude)docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-stage1-manifest.json", ":(exclude)docs/hrms/delivery-units/unit-09/ng-candidate-2026-4-stage1-package.sha256"], { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

function category(file, text) {
  const normalized = file.replaceAll("\\", "/");
  if (/loss of employment|statutory compensation/i.test(text)) return "D_STATUTORY_LOSS_OF_EMPLOYMENT";
  if (/unit-09|unit9|nigeria-2026-[123]|ng-candidate-2026-[123]/i.test(normalized) && /earning|non-periodic|payroll input|classification/i.test(text)) return "B_UNIT9_LEGACY_OR_HISTORICAL_EARNING";
  if (/compensation|unit-08|unit8|schema\.prisma|permissions|hr-bootstrap|email|notification/i.test(normalized)) return "A_UNIT8_PAY_REWARDS_BOUNDED_CONTEXT";
  if (/\.md$/i.test(normalized)) return "C_GENERIC_DOCUMENTATION_WORDING";
  return "E_UNRELATED_OR_IMPLEMENTATION_IDENTIFIER";
}

const occurrences = raw.trim().split(/\r?\n/).filter(Boolean).map((line) => {
  const match = line.match(/^(.+?):(\d+):(.*)$/);
  if (!match) throw new Error(`Unparseable compensation inventory line: ${line}`);
  return { file: match[1].replaceAll("\\", "/"), line: Number(match[2]), category: category(match[1], match[3]), text: match[3].trim().slice(0, 500) };
});
const counts = Object.fromEntries([...new Set(occurrences.map(({ category: value }) => value))].sort().map((value) => [value, occurrences.filter(({ category }) => category === value).length]));
const inventory = { candidateVersion: "NG-CANDIDATE-2026.4", generatedFromGitHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), decision: "Unit 8 compensation terminology is preserved; Unit 9 COMPENSATION is legacy-only and prohibited for new input.", counts, occurrences };

if (process.argv.includes("--check")) {
  if (!fs.existsSync(output)) throw new Error("Compensation inventory evidence is missing.");
  const existing = JSON.parse(fs.readFileSync(output, "utf8"));
  if (JSON.stringify(existing.occurrences) !== JSON.stringify(occurrences)) throw new Error("Compensation inventory evidence is stale.");
  console.info(`PASS compensation inventory current; occurrences=${occurrences.length}`);
} else {
  fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  console.info(`WROTE ${path.relative(root, output)} occurrences=${occurrences.length}`);
}
