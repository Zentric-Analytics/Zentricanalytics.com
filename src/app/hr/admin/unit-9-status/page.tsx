export const dynamic = "force-dynamic";
const head = process.env.RENDER_GIT_COMMIT ?? "local development candidate";
const items = [
  ["Environment", "Staging only — production untouched"],
  ["Branch", "dev"],
  ["HEAD SHA", head],
  ["Operating scope", "Lagos, Oyo and FCT; Ibadan routes to OYO by residence/RTA"],
  ["Calendar", "Monthly; nominal 29th; frozen previous-business-day resolution"],
  ["Earnings", "Salary recurring; Compensation and Bonus non-periodic; sick leave excluded"],
  ["Compliance", "Structured holds, immutable exception history and deterministic population partitioning"],
  ["Payments/accounting", "Governed export only; not settled on export; accounting adapter not configured"],
  ["Migrations", "60 applied; none pending or failed"],
  ["Automated suite", "959 / 959 passing across 81 files; focused limited-launch and concurrency 15 / 15"],
  ["Quality gates", "TypeScript, ESLint, Prisma and production build PASS"],
  ["PostgreSQL", "Exactly-once exception resolution, population partitioning and existing Unit 9 concurrency PASS"],
  ["Browser authorization", "Compliance queue PASS; unrelated administration 403; temporary role removed and audited"],
  ["Nigeria certification", "NOT CERTIFIED — official finalization remains fail-closed"],
  ["Next release gate", "Qualified external compliance review of unresolved authoritative-rule questions"],
] as const;
export default function Unit9StatusPage() { return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Staging validation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 9 — Nigeria limited-launch controls</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive operational evidence only. No employee payroll, tax, bank or payment data is displayed.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-950">STAGING READY — NOT CERTIFIED</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Fail-closed boundary</h2><p className="mt-2 text-sm text-amber-900">Launch scope is not legal certification. Unsupported minimum-wage edge cases and all uncertified RTA non-periodic allocation scenarios remain on a governed compliance hold. No official payslip, payment or filing is permitted.</p></section></main>; }
