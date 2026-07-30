import { z } from "zod";

export const organizationImportKind = z.enum(["legal-entity", "job-family", "grade"]);
export type OrganizationImportKind = z.infer<typeof organizationImportKind>;

const schemas = {
  "legal-entity": z.object({ code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(160), countryCode: z.string().trim().length(2), currency: z.string().trim().length(3), timezone: z.string().trim().min(3).max(80) }),
  "job-family": z.object({ code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(160) }),
  grade: z.object({ code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(160), level: z.coerce.number().int().positive(), currency: z.string().trim().length(3), minimumSalary: z.coerce.number().nonnegative(), midpointSalary: z.coerce.number().nonnegative(), maximumSalary: z.coerce.number().nonnegative() }).refine(value => value.minimumSalary <= value.midpointSalary && value.midpointSalary <= value.maximumSalary, "Salary range is invalid."),
} as const;

function splitCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseOrganizationCsv(kind: OrganizationImportKind, text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  if (lines.length > 5001) throw new Error("CSV imports are limited to 5,000 rows.");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const payload = Object.fromEntries(headers.map((header, offset) => [header, values[offset] ?? ""]));
    const parsed = schemas[kind].safeParse(payload);
    return { rowNumber: index + 2, payload, valid: parsed.success, errors: parsed.success ? [] : parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`), normalized: parsed.success ? parsed.data : undefined };
  });
}

export function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
