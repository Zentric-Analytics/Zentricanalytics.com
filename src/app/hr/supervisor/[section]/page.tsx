import { notFound } from "next/navigation";
const sections = new Set(["team","tasks","leave","reviews","onboarding","assets"]);
export default async function SupervisorSection({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!sections.has(section)) notFound(); return <><h1 className="text-3xl font-bold">Supervisor {section}</h1><p className="mt-4 rounded-2xl bg-white p-6 text-slate-600">Assignment checks are active; workflow functionality follows in Milestone 3.</p></>; }
