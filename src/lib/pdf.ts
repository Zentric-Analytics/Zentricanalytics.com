import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { maskSensitive } from './hiring';

export type PdfField = { label: string; value: string; sensitive?: boolean };
export type SubmittedDocumentInput = { title: string; applicantName: string; applicationId: string; documentRef?: string; role?: string; fields: PdfField[]; documents?: PdfField[]; signatureName: string; submittedAt: string; signedAt?: string; version: number; status: string };

export const STAGE_1_TEMPLATE_PATH = path.join(process.cwd(), 'src/assets/pdf-templates/stage-1-employment-application-candidate-information-form.pdf');

export function renderSubmittedDocumentText(input: SubmittedDocumentInput) {
  const rows = [
    'Zentric Analytics Ltd', 'PRIVATE & CONFIDENTIAL', 'Official recruitment communication', `Ref: ${input.documentRef ?? `ZA/HR/APP/${new Date().getUTCFullYear()}/${input.applicationId}`}`,
    'Employment Application', 'Candidate Information Form', 'Candidate Details', `Full legal name: ${input.applicantName}`, `Application ID: ${input.applicationId}`,
    ...input.fields.map(renderPlainRow), 'Role Interest and Availability', `Role applied for: ${input.role ?? ''}`, `Document status: ${input.status}`, `Submission timestamp: ${input.submittedAt}`, `Document version: ${input.version}`,
    'Documents Submitted', ...(input.documents?.length ? input.documents : [{ label: 'Documents submitted', value: 'Recorded in private recruitment storage' }]).map(renderPlainRow),
    'Candidate Declaration', 'I declare that the information submitted in this Stage 1 employment application is true and complete to the best of my knowledge. I understand that inaccurate information may affect my application.',
    'Candidate Data Privacy Acknowledgement', 'I acknowledge that Zentric Analytics Ltd may process my application data and private uploaded documents for recruitment review, verification, communication, and recruitment records management.',
    'Candidate Signature', `Electronic signature name: ${input.signatureName}`, 'Signature confirmation: Confirmed as electronic signature', `Signature timestamp: ${input.signedAt ?? input.submittedAt}`,
    'For Zentric Use Only', 'HR reviewer:', 'Stage 1 admin decision:', 'Internal notes:', 'Zentric Analytics Ltd | Recruitment Records | Private & Confidential',
  ];
  return rows.join('\n');
}

export async function renderSubmittedDocumentPdf(input: SubmittedDocumentInput) {
  const templateBytes = await readFile(STAGE_1_TEMPLATE_PATH);
  const pdf = await PDFDocument.load(templateBytes);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fields = toFieldMap(input.fields);
  const documents = input.documents?.map(({ label, value }) => `${label}: ${value}`).join('; ') || 'Recorded in private recruitment storage';
  const submittedAt = formatDateTime(input.submittedAt);
  const signedAt = formatDateTime(input.signedAt ?? input.submittedAt);
  const privacyConsent = truthy(fields.privacyConsent) ? 'Confirmed for recruitment processing' : '';

  pdf.setTitle(`${input.applicationId} Stage 1 Candidate Information Form`);
  pdf.setAuthor(input.applicantName);
  pdf.setSubject('Official Zentric Analytics Ltd Stage 1 employment application PDF generated from candidate portal submission');
  pdf.setKeywords([input.applicationId, input.applicantName, input.signatureName]);
  pdf.setProducer('Zentric Analytics Ltd candidate portal');
  pdf.setCreator('Zentric Analytics Ltd');

  const pages = pdf.getPages();
  addSharedHeaderData(pages, input, regular);

  const page1 = pages[0];
  draw(page1, input.applicantName, 198, 598, regular);
  draw(page1, [fields.firstName && `First: ${fields.firstName}`, fields.middleInitial && `Middle initial: ${fields.middleInitial}`, fields.lastName && `Last: ${fields.lastName}`].filter(Boolean).join('   '), 198, 568, regular, { size: 8.5 });
  drawMultiline(page1, fields.location, 198, 538, 310, regular);
  draw(page1, fields.phoneDisplay || [fields.phoneCountryName, fields.phoneE164].filter(Boolean).join(' '), 228, 505, regular);
  draw(page1, fields.email, 430, 505, regular);
  draw(page1, fields.location, 222, 473, regular, { size: 8 });
  draw(page1, input.role ?? fields.roleAppliedFor ?? fields.role, 198, 349, regular);
  draw(page1, fields.experienceLevel ? `Experience: ${fields.experienceLevel}` : '', 198, 318, regular, { size: 8 });
  drawChoice(page1, fields.workMode, { 'Office-based': [198, 286], Remote: [269, 286], Hybrid: [326, 286], Flexible: [382, 286] }, bold);
  if (documents) draw(page1, 'X', 38, 106, bold, { size: 9 });
  draw(page1, documents, 94, 96, regular, { size: 7.5, maxWidth: 460 });

  const page2 = pages[1];
  drawMultiline(page2, fields.skills, 48, 490, 500, regular);
  draw(page2, fields.portfolioUrl, 48, 324, regular, { size: 8.5, maxWidth: 490 });
  drawMultiline(page2, fields.message, 130, 202, 380, regular, { size: 8.5, lineHeight: 10, maxLines: 5 });

  const page3 = pages[2];
  draw(page3, privacyConsent, 70, 276, regular, { size: 8.5 });
  if (privacyConsent) draw(page3, 'X', 52, 277, bold, { size: 10 });
  draw(page3, input.signatureName, 118, 199, regular);
  draw(page3, 'Confirmed as electronic signature', 418, 199, regular, { size: 8 });
  draw(page3, signedAt, 68, 173, regular);

  const page4 = pages[3];
  draw(page4, submittedAt, 198, 596, regular);
  draw(page4, input.role ?? fields.roleAppliedFor ?? fields.role, 198, 566, regular);
  draw(page4, `${input.status} - Version ${input.version}`, 198, 506, regular);
  draw(page4, `Signed: ${signedAt}`, 198, 476, regular);

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function renderPlainRow({ label, value, sensitive = false }: PdfField) { return `${label}: ${sensitive ? maskSensitive(value) : (value || '-')}`; }

function toFieldMap(fields: PdfField[]) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    const normalized = field.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = FIELD_ALIASES[normalized] ?? normalized.replace(/\s+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
    acc[key] = field.sensitive ? maskSensitive(field.value) : field.value;
    return acc;
  }, {});
}

const FIELD_ALIASES: Record<string, string> = {
  'first name': 'firstName',
  'middle initial': 'middleInitial',
  'last name': 'lastName',
  'full legal name': 'fullLegalName',
  email: 'email',
  'phone country name': 'phoneCountryName',
  'phone e164': 'phoneE164',
  'phone display': 'phoneDisplay',
  location: 'location',
  role: 'role',
  'role applied for': 'roleAppliedFor',
  'work mode': 'workMode',
  'experience level': 'experienceLevel',
  skills: 'skills',
  'portfolio url': 'portfolioUrl',
  message: 'message',
  'privacy consent': 'privacyConsent',
};

function addSharedHeaderData(pages: PDFPage[], input: SubmittedDocumentInput, font: PDFFont) {
  const documentRef = input.documentRef ?? input.applicationId;
  for (const page of pages) {
    draw(page, documentRef, 488, 775, font, { size: 6.5, maxWidth: 75 });
  }
}

function drawChoice(page: PDFPage, value = '', choices: Record<string, [number, number]>, font: PDFFont) {
  const normalized = value.trim().toLowerCase();
  const match = Object.entries(choices).find(([choice]) => normalized.includes(choice.toLowerCase()));
  if (match) draw(page, 'X', match[1][0], match[1][1], font, { size: 10 });
  else draw(page, value, 198, 286, font, { size: 8.5 });
}

function draw(page: PDFPage, value: string | undefined, x: number, y: number, font: PDFFont, options: { size?: number; maxWidth?: number } = {}) {
  const text = clean(value);
  if (!text) return;
  page.drawText(fit(text, options.maxWidth ?? 260, font, options.size ?? 9), { x, y, size: options.size ?? 9, font, color: rgb(0.05, 0.09, 0.16) });
}

function drawMultiline(page: PDFPage, value: string | undefined, x: number, y: number, maxWidth: number, font: PDFFont, options: { size?: number; lineHeight?: number; maxLines?: number } = {}) {
  const size = options.size ?? 8.5;
  const lineHeight = options.lineHeight ?? 10.5;
  const lines = wrapText(clean(value), maxWidth, font, size).slice(0, options.maxLines ?? 3);
  lines.forEach((line, index) => draw(page, line, x, y - index * lineHeight, font, { size, maxWidth }));
}

function wrapText(value: string, maxWidth: number, font: PDFFont, size: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function fit(value: string, maxWidth: number, font: PDFFont, size: number) {
  let text = value;
  while (text.length > 3 && font.widthOfTextAtSize(text, size) > maxWidth) text = text.slice(0, -4).trimEnd() + '...';
  return text;
}

function clean(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truthy(value = '') {
  return ['true', 'yes', 'on', 'confirmed', '1'].includes(value.trim().toLowerCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
