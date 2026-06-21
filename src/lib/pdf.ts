import { maskSensitive } from './hiring';
export type PdfField = { label: string; value: string; sensitive?: boolean };
export function renderSubmittedDocumentText(input:{title:string; applicantName:string; applicationId:string; role?:string; fields:PdfField[]; signatureName:string; submittedAt:string; version:number; status:string}){
 const lines = ['Zentric Analytics Ltd', input.title, `Applicant: ${input.applicantName}`, `Application ID: ${input.applicationId}`, input.role ? `Role: ${input.role}` : '', 'Submitted answers:', ...input.fields.map(f=>`${f.label}: ${f.sensitive ? maskSensitive(f.value) : f.value}`), `Signature name: ${input.signatureName}`, 'Signature confirmation: Confirmed as electronic signature', `Submission timestamp: ${input.submittedAt}`, `Document version: ${input.version}`, `Document status: ${input.status}`, 'Footer: This document was electronically signed and submitted through the Zentric Analytics hiring enrollment portal.'];
 return lines.filter(Boolean).join('\n');
}
