export function turnoverRate(input: { openingHeadcount: number; closingHeadcount: number; terminations: number }) {
  const average = (input.openingHeadcount + input.closingHeadcount) / 2;
  return average > 0 ? Number(((input.terminations / average) * 100).toFixed(2)) : 0;
}

export function openingHeadcount(input: { closingHeadcount: number; hires: number; terminations: number }) {
  return Math.max(0, input.closingHeadcount - input.hires + input.terminations);
}

export function percentage(part: number, total: number) {
  return total > 0 ? Number(((part / total) * 100).toFixed(2)) : 0;
}

export function reportPeriod(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Report year is invalid.");
  return { startsAt: new Date(Date.UTC(year, 0, 1)), endsAt: new Date(Date.UTC(year + 1, 0, 1)) };
}

export function safeReportFileName(report: string, date = new Date()) {
  const key = report.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "report";
  return `hr-${key}-${date.toISOString().slice(0, 10)}.csv`;
}
