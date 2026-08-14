export const dynamic = "force-dynamic";

const head = process.env.RENDER_GIT_COMMIT ?? "local implementation working tree";
const items = [
  ["Environment", "Staging validation — production untouched"],
  ["Branch", "feature/hrms-unit-08-compensation-rewards-blueprint"],
  ["HEAD SHA", head],
  ["Validated deployment", "dep-d9v2s2gn74is73ctm2jg"],
  ["Tests", "767/767 passing across 69 files; TypeScript, ESLint, Prisma and production build pass"],
  ["Migrations", "48/48 applied to zentric_analytics_staging; none pending"],
  ["Concurrency", "PASS — 16 real PostgreSQL race cases; exactly-once and losing-request behavior verified"],
  ["Integrity", "PASS — zero relevant duplicates, orphans, overlaps, broken correction links or budget errors"],
  ["Load", "PASS — 250 requests, zero failures, p95 404.3 ms"],
  ["Encrypted archive", "PASS — durable archive 5d0b772a7db0; checksum and independent remote version verified"],
  ["Defects fixed", "Lifecycle race serialization, immutable promotion-decision guard, and read-only integrity gate"],
  ["Remaining gates", "Signed-in field privacy matrix and owner-approved isolated restore correlation"],
] as const;

export default function Unit8StatusPage() {
  return <main><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Implementation status</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Unit 8 — Compensation &amp; Rewards Management</h1><p className="mt-2 max-w-3xl text-slate-600">Non-sensitive engineering status. No individual compensation data appears here.</p></div><span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-950">FINAL GATES IN PROGRESS</span></div><section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(([label,value]) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h2 className="font-bold text-indigo-950">Current gate</h2><p className="mt-2 text-sm font-semibold text-indigo-900">FIELD-LEVEL PRIVACY AND ISOLATED RESTORE CORRELATION</p><p className="mt-2 text-sm text-indigo-900">Unit 8 PASS is withheld until both gates are evidenced. Production remains untouched.</p></section></main>;
}
