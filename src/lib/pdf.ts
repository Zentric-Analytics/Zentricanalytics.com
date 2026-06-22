import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { maskSensitive } from './hiring';

export type PdfField = { label: string; value: string; sensitive?: boolean };
export type SubmittedDocumentInput = { title: string; applicantName: string; applicationId: string; documentRef?: string; role?: string; fields: PdfField[]; documents?: PdfField[]; signatureName: string; submittedAt: string; signedAt?: string; version: number; status: string };

export const STAGE_1_TEMPLATE_PATH = path.join(process.cwd(), 'src/assets/pdf-templates/stage-1-employment-application-candidate-information-form.pdf');

export type Stage1PdfFieldMapEntry = { fieldKey: string; page: number; x: number; y: number; maxWidth: number; fontSize: number; kind?: 'text'|'multiline'|'checkbox' };
export const STAGE1_PDF_FIELD_MAP: Stage1PdfFieldMapEntry[] = [
  { fieldKey: 'fullName', page: 1, x: 198, y: 600, maxWidth: 320, fontSize: 8.5 },
  { fieldKey: 'splitName', page: 1, x: 198, y: 570, maxWidth: 320, fontSize: 8 },
  { fieldKey: 'preferredName', page: 1, x: 198, y: 552, maxWidth: 170, fontSize: 8 },
  { fieldKey: 'residentialAddress', page: 1, x: 198, y: 538, maxWidth: 315, fontSize: 8, kind: 'multiline' },
  { fieldKey: 'phoneDisplay', page: 1, x: 226, y: 507, maxWidth: 165, fontSize: 8 },
  { fieldKey: 'email', page: 1, x: 430, y: 507, maxWidth: 125, fontSize: 8 },
  { fieldKey: 'stateOfResidence', page: 1, x: 222, y: 475, maxWidth: 120, fontSize: 8 },
  { fieldKey: 'lgaOfResidence', page: 1, x: 405, y: 475, maxWidth: 120, fontSize: 8 },
  { fieldKey: 'nationality', page: 1, x: 198, y: 445, maxWidth: 130, fontSize: 8 },
  { fieldKey: 'rightToWorkNigeria', page: 1, x: 338, y: 445, maxWidth: 100, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'genderForHr', page: 1, x: 198, y: 416, maxWidth: 160, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'roleAppliedFor', page: 1, x: 198, y: 351, maxWidth: 220, fontSize: 8.5 },
  { fieldKey: 'employmentType', page: 1, x: 198, y: 320, maxWidth: 220, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'workMode', page: 1, x: 198, y: 288, maxWidth: 220, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'availableStartDate', page: 1, x: 198, y: 258, maxWidth: 90, fontSize: 8 },
  { fieldKey: 'noticePeriod', page: 1, x: 370, y: 258, maxWidth: 100, fontSize: 8 },
  { fieldKey: 'salaryExpectation', page: 1, x: 198, y: 228, maxWidth: 110, fontSize: 8 },
  { fieldKey: 'salaryNegotiable', page: 1, x: 370, y: 228, maxWidth: 80, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'canWorkMondayFriday', page: 1, x: 198, y: 198, maxWidth: 80, fontSize: 8, kind: 'checkbox' },
  { fieldKey: 'preferredWorkingTime', page: 1, x: 370, y: 198, maxWidth: 130, fontSize: 8 },
  { fieldKey: 'heardAboutUs', page: 1, x: 198, y: 168, maxWidth: 300, fontSize: 8 },
  { fieldKey: 'documentsSubmitted', page: 1, x: 94, y: 98, maxWidth: 460, fontSize: 7.5 },
  { fieldKey: 'educationHistory', page: 2, x: 48, y: 626, maxWidth: 500, fontSize: 8, kind: 'multiline' },
  { fieldKey: 'skills', page: 2, x: 48, y: 490, maxWidth: 500, fontSize: 8, kind: 'multiline' },
  { fieldKey: 'portfolioUrl', page: 2, x: 48, y: 324, maxWidth: 490, fontSize: 8 },
  { fieldKey: 'employmentHistory', page: 2, x: 48, y: 280, maxWidth: 500, fontSize: 8, kind: 'multiline' },
  { fieldKey: 'referee1', page: 3, x: 70, y: 650, maxWidth: 480, fontSize: 7.8, kind: 'multiline' },
  { fieldKey: 'referee2', page: 3, x: 70, y: 560, maxWidth: 480, fontSize: 7.8, kind: 'multiline' },
  { fieldKey: 'declarationAccuracy', page: 3, x: 52, y: 302, maxWidth: 12, fontSize: 10, kind: 'checkbox' },
  { fieldKey: 'privacyConsent', page: 3, x: 52, y: 279, maxWidth: 12, fontSize: 10, kind: 'checkbox' },
  { fieldKey: 'signatureName', page: 3, x: 118, y: 201, maxWidth: 240, fontSize: 8.5 },
  { fieldKey: 'signedAt', page: 3, x: 68, y: 175, maxWidth: 160, fontSize: 8 },
];


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
  const declarationConsent = truthy(fields.declarationAccuracy) ? 'Confirmed accurate and complete' : '';
  const phoneDisplay = fields.phoneDisplay || [fields.phoneCountryName, fields.phoneE164].filter(Boolean).join(' ');

  pdf.setTitle(`${input.applicationId} Stage 1 Candidate Information Form`);
  pdf.setAuthor(input.applicantName);
  pdf.setSubject('Official Zentric Analytics Ltd Stage 1 employment application PDF generated from candidate portal submission');
  pdf.setKeywords([input.applicationId, input.applicantName, input.signatureName]);
  pdf.setProducer('Zentric Analytics Ltd candidate portal');
  pdf.setCreator('Zentric Analytics Ltd');

  const pages = pdf.getPages();
  addSharedHeaderData(pages, input, regular);

  const page1 = pages[0];
  draw(page1, fields.fullName || input.applicantName, 198, 600, regular, { size: 8.5, maxWidth: 320 });
  draw(page1, [fields.firstName && `First: ${fields.firstName}`, fields.middleInitial && `Middle: ${fields.middleInitial}`, fields.lastName && `Last: ${fields.lastName}`].filter(Boolean).join('   '), 198, 570, regular, { size: 8, maxWidth: 320 });
  draw(page1, fields.preferredName, 198, 552, regular, { size: 8, maxWidth: 170 });
  drawMultiline(page1, fields.residentialAddress || fields.location, 198, 538, 315, regular, { size: 8, lineHeight: 9.5, maxLines: 2 });
  draw(page1, phoneDisplay, 226, 507, regular, { size: 8, maxWidth: 165 });
  draw(page1, fields.email, 430, 507, regular, { size: 8, maxWidth: 125 });
  draw(page1, fields.stateOfResidence || fields.location, 222, 475, regular, { size: 8, maxWidth: 120 });
  draw(page1, fields.lgaOfResidence, 405, 475, regular, { size: 8, maxWidth: 120 });
  draw(page1, fields.nationality, 198, 445, regular, { size: 8, maxWidth: 130 });
  drawChoice(page1, fields.rightToWorkNigeria, { Yes: [338, 445], No: [382, 445], 'N/A': [426, 445] }, bold);
  drawChoice(page1, fields.genderForHr, { Male: [198, 416], Female: [250, 416], 'Prefer not to say': [318, 416] }, bold);
  draw(page1, input.role ?? fields.roleAppliedFor ?? fields.role, 198, 351, regular, { size: 8.5, maxWidth: 220 });
  drawChoice(page1, fields.employmentType, { 'Full-time': [198, 320], 'Part-time': [260, 320], 'Fixed-term': [322, 320], 'Internship or Trainee': [390, 320], 'Contract or Other': [490, 320] }, bold);
  drawChoice(page1, fields.workMode, { 'Office-based': [198, 288], Remote: [269, 288], Hybrid: [326, 288], Flexible: [382, 288] }, bold);
  draw(page1, fields.availableStartDate, 198, 258, regular, { size: 8, maxWidth: 90 });
  draw(page1, fields.noticePeriod, 370, 258, regular, { size: 8, maxWidth: 100 });
  draw(page1, fields.salaryExpectation, 198, 228, regular, { size: 8, maxWidth: 110 });
  drawChoice(page1, fields.salaryNegotiable, { Yes: [370, 228], No: [414, 228] }, bold);
  drawChoice(page1, fields.canWorkMondayFriday, { Yes: [198, 198], No: [242, 198] }, bold);
  draw(page1, fields.preferredWorkingTime, 370, 198, regular, { size: 8, maxWidth: 130 });
  draw(page1, fields.heardAboutUs, 198, 168, regular, { size: 8, maxWidth: 300 });
  if (documents) draw(page1, 'X', 38, 106, bold, { size: 9 });
  draw(page1, [documents, fields.portfolioAvailable && `Portfolio/work samples: ${fields.portfolioAvailable}`, fields.certificatesAvailable && `Certificates: ${fields.certificatesAvailable}`, fields.certificatesNote, fields.otherDocumentNote].filter(Boolean).join('; '), 94, 98, regular, { size: 7.5, maxWidth: 460 });

  const page2 = pages[1];
  drawMultiline(page2, fields.educationHistory, 48, 626, 500, regular, { size: 8, lineHeight: 10, maxLines: 7 });
  drawMultiline(page2, fields.skills, 48, 490, 500, regular, { size: 8, lineHeight: 10, maxLines: 5 });
  draw(page2, fields.portfolioUrl, 48, 324, regular, { size: 8, maxWidth: 490 });
  drawMultiline(page2, fields.employmentHistory || fields.message, 48, 280, 500, regular, { size: 8, lineHeight: 10, maxLines: 8 });

  const page3 = pages[2];
  drawMultiline(page3, formatReferee(fields, '1'), 70, 650, 480, regular, { size: 7.8, lineHeight: 9.5, maxLines: 5 });
  drawMultiline(page3, formatReferee(fields, '2'), 70, 560, 480, regular, { size: 7.8, lineHeight: 9.5, maxLines: 5 });
  if (declarationConsent) draw(page3, 'X', 52, 302, bold, { size: 10 });
  draw(page3, declarationConsent, 70, 301, regular, { size: 8.5, maxWidth: 250 });
  if (privacyConsent) draw(page3, 'X', 52, 279, bold, { size: 10 });
  draw(page3, privacyConsent, 70, 278, regular, { size: 8.5, maxWidth: 250 });
  draw(page3, input.signatureName, 118, 201, regular, { size: 8.5, maxWidth: 240 });
  draw(page3, 'Confirmed as electronic signature', 418, 201, regular, { size: 8, maxWidth: 125 });
  draw(page3, signedAt, 68, 175, regular, { size: 8, maxWidth: 160 });

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
  'full legal name': 'fullName',
  'full name': 'fullName',
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
  'preferred name': 'preferredName', 'residential address': 'residentialAddress', 'state of residence': 'stateOfResidence', 'lga of residence': 'lgaOfResidence', nationality: 'nationality', 'right to work nigeria': 'rightToWorkNigeria', 'gender for hr record': 'genderForHr', 'employment type': 'employmentType', 'available start date': 'availableStartDate', 'notice period': 'noticePeriod', 'salary expectation': 'salaryExpectation', 'salary negotiable': 'salaryNegotiable', 'can work monday friday': 'canWorkMondayFriday', 'preferred working time': 'preferredWorkingTime', 'heard about us': 'heardAboutUs', 'portfolio available': 'portfolioAvailable', 'certificates available': 'certificatesAvailable', 'certificates note': 'certificatesNote', 'other document note': 'otherDocumentNote', 'education history': 'educationHistory', 'employment history': 'employmentHistory', 'referee 1 name': 'referee1Name', 'referee 1 company role': 'referee1CompanyRole', 'referee 1 relationship': 'referee1Relationship', 'referee 1 phone': 'referee1Phone', 'referee 1 email': 'referee1Email', 'referee 1 may contact': 'referee1MayContact', 'referee 2 name': 'referee2Name', 'referee 2 company role': 'referee2CompanyRole', 'referee 2 relationship': 'referee2Relationship', 'referee 2 phone': 'referee2Phone', 'referee 2 email': 'referee2Email', 'referee 2 may contact': 'referee2MayContact', 'declaration accuracy': 'declarationAccuracy',
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

function formatReferee(fields: Record<string, string>, suffix: '1' | '2') {
  return [fields[`referee${suffix}Name`], fields[`referee${suffix}CompanyRole`], fields[`referee${suffix}Relationship`] && `Relationship: ${fields[`referee${suffix}Relationship`]}`, fields[`referee${suffix}Phone`], fields[`referee${suffix}Email`], fields[`referee${suffix}MayContact`] && `May contact: ${fields[`referee${suffix}MayContact`]}`].filter(Boolean).join(' | ');
}

function truthy(value = '') {
  return ['true', 'yes', 'on', 'confirmed', '1'].includes(value.trim().toLowerCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
