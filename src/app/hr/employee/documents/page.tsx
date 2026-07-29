import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/hr/permissions/authorize";
import { uploadEmployeeDocumentAction, uploadEmployeeDocumentVersionAction } from "@/app/hr/admin/documents/actions";

const selfCategories = ["IDENTITY_DOCUMENT", "TAX_DOCUMENT", "BANK_DOCUMENT", "QUALIFICATION_CERTIFICATE", "POLICY_ACKNOWLEDGEMENT", "OTHER"];

export default async function EmployeeDocumentsPage() {
  const auth = await requirePermission("document.read_self");
  if (!auth.user.employee) throw new Error("An employee profile is required.");
  const documents = await prisma.hrEmployeeDocument.findMany({ where: { employeeId: auth.user.employee.id, archivedAt: null }, include: { versions: { orderBy: { version: "desc" } } }, orderBy: { createdAt: "desc" } });
  return <>
    <h1 className="text-3xl font-bold">My documents</h1><p className="mt-2 text-slate-600">Upload private HR records and access versions after security scanning.</p>
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Upload a document</h2><form action={uploadEmployeeDocumentAction} className="mt-4 grid gap-3 md:grid-cols-2"><input type="hidden" name="employeeId" value={auth.user.employee.id} /><select className="input" name="category">{selfCategories.map((category) => <option key={category}>{category}</option>)}</select><input className="input" name="title" placeholder="Document title" required /><input className="input" name="expiresAt" type="date" /><label className="text-sm font-semibold">PDF, JPEG, or PNG<input className="input mt-1" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required /></label><button className="btn btn-primary md:col-span-2">Upload securely</button></form></section>
    <section className="mt-5 overflow-x-auto rounded-2xl bg-white p-5"><h2 className="font-bold">Document history</h2><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">Document</th><th>Expiration</th><th>Versions</th><th>Upload new version</th></tr></thead><tbody>{documents.map((document) => <tr className="border-b last:border-0 align-top" key={document.id}><td className="py-3">{document.title}<br /><span className="text-xs text-slate-500">{document.category} · {document.retentionStatus}</span></td><td>{document.expiresAt?.toLocaleDateString() ?? "—"}</td><td className="space-y-1">{document.versions.map((version) => <div key={version.id}>{version.scanStatus === "CLEAN" ? <Link className="font-semibold text-teal-700" href={`/api/hr/documents/versions/${version.id}`}>v{version.version} · {version.displayFileName}</Link> : `v${version.version} · ${version.scanStatus.toLowerCase()}`}</div>)}</td><td><form action={uploadEmployeeDocumentVersionAction} className="flex gap-2"><input type="hidden" name="documentId" value={document.id} /><input className="input max-w-56" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required /><button className="font-semibold text-teal-700">Upload</button></form></td></tr>)}</tbody></table>{!documents.length && <p className="py-8 text-center text-slate-500">No documents have been uploaded.</p>}</section>
  </>;
}
