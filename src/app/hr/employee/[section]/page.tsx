import { notFound } from "next/navigation";
const sections = new Set(["profile","leave","payslips","documents","assets","notifications","security"]);
export default async function EmployeeSection({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!sections.has(section)) notFound(); return <><h1 className="text-3xl font-bold">My {section}</h1><p className="mt-4 rounded-2xl bg-white p-6 text-slate-600">This secured self-service module is planned for a later milestone.</p></>; }
