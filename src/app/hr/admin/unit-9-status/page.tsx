export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local development candidate";
const items = [
  ["Environment", "Staging only — production untouched"],
  ["Branch", "dev"],
  ["HEAD SHA", head],
  ["Candidate", "NG-CANDIDATE-2026.6 — NOT CERTIFIED"],
  ["Operating scope", "Lagos, Oyo and FCT; Ibadan routes to OYO by residence/RTA"],
  ["Earnings", "Salary recurring; Bonus non-periodic; no other active ordinary earning type"],
  ["Income binding", "Frozen Salary, Bonus, YTD, annualization and prior-employer facts share one deterministic hash"],
  ["Compliance", "Amount mismatches, unsupported facts, ambiguity and stale hashes fail closed"],
  ["Payments/accounting", "Governed export only; not settled on export; accounting adapter not configured"],
  ["Deployment", "Current Render staging deployment must match the HEAD SHA above"],
  ["Migrations", "62 expected; additive income-binding migration pending staging deployment"],
  ["Automated suite", "1,014 / 1,014 across 86 files PASS; focused candidate gate 15 / 15 PASS"],
  ["Quality gates", "TypeScript, ESLint zero warnings, Prisma and production build PASS"],
  ["PostgreSQL", "Fresh database-backed race and integrity validation pending exact-SHA staging deployment"],
  ["Browser authorization", "Signed-in staging privacy/RBAC rerun pending"],
  ["Nigeria certification", "NOT CERTIFIED — official finalization remains fail-closed"],
  ["Next release gate", "Exact-SHA staging deployment and governed income-binding validation"],
] as const;

export default function Unit9StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Staging validation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — NG-CANDIDATE-2026.6</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive operational evidence only. No employee payroll, tax, bank or payment data is displayed.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">ENGINEERING VALIDATION — NOT CERTIFIED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label, value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Fail-closed boundary</h2><p className="mt-2 text-sm text-amber-900">This candidate is not legally certified. Income-binding mismatches, unsupported or unknown taxable income, ambiguous minimum-wage cases, stale binding hashes and refund execution remain on governed compliance hold. No authoritative finalization, official payslip, real payment, filing, submission, settlement or remittance is permitted.</p></section></main>;
}
