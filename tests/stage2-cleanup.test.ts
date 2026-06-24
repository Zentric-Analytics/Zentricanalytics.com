import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stage2SubmissionSchema, toStage2SubmissionPayload } from '../src/lib/hiring';

const portal = readFileSync('src/app/track/portal/page.tsx', 'utf8');
const actions = readFileSync('src/app/track/actions.ts', 'utf8');
const adminDetail = readFileSync('src/app/admin/applications/[id]/page.tsx', 'utf8');

describe('Stage 2 cleaned candidate identity flow', () => {
  it('renders required Primary ID and optional Secondary ID without stale standalone NIN/Tax fields', () => {
    expect(portal).toContain('Primary ID <span className="text-red-600">required</span>');
    expect(portal).toContain('Secondary ID <span className="font-normal text-slate-500">optional</span>');
    expect(portal).toContain('name="primaryIdNumber" required');
    expect(portal).toContain('name="secondaryIdNumber"');
    expect(portal).not.toContain('name="nin"');
    expect(portal).not.toContain('name="taxId"');
  });

  it('requires only the primary ID document and keeps passport/profile photo optional', () => {
    expect(portal).toContain('name="primaryIdDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required');
    expect(portal).toContain('name="secondaryIdDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />');
    expect(portal).toContain('Passport/profile photo, optional');
    expect(portal).toContain('name="passportPhoto" type="file" accept=".jpg,.jpeg,.png,.webp" />');
    expect(actions).toContain("validateIdentityDocumentFile(primaryIdFile, 'Upload your primary ID document.')");
    expect(actions).not.toContain("validateIdentityDocumentFile(photoFile, 'Upload your passport-style photograph.')");
  });

  it('uses country selectors and national inputs for applicant and emergency phones', () => {
    expect(portal).toContain('name="applicantPhoneCountryIso"');
    expect(portal).toContain('name="applicantPhoneNational"');
    expect(portal).toContain('name="emergencyContactPhoneCountryIso"');
    expect(portal).toContain('name="emergencyContactPhoneNational"');
    expect(portal).toContain('countryPhoneOptions.map');
  });

  it('rejects invalid phone numbers and masks ID numbers in payload', () => {
    const base = {
      session: '1234567890123456', fullLegalName: 'Ada Lovelace', dateOfBirth: '1990-01-01', gender: 'Female', nationality: 'Nigerian', stateOfOrigin: 'Lagos', stateOfResidence: 'Lagos', lga: 'Ikeja', residentialAddress: '1 Test Street', currentCity: 'Lagos', applicantPhoneCountryIso: 'NG', applicantPhoneNational: '1111111111', email: 'ada@example.com', primaryIdType: 'International Passport', primaryIdNumber: 'A123456789', primaryIdIssuingAuthority: 'Immigration', primaryIdIssueDate: '', primaryIdExpiryDate: '', secondaryIdType: 'Voter’s Card', secondaryIdNumber: 'VIN123456', secondaryIdIssuingAuthority: '', secondaryIdIssueDate: '', secondaryIdExpiryDate: '', emergencyContactName: 'Grace', emergencyContactRelationship: 'Sibling', emergencyContactPhoneCountryIso: 'NG', emergencyContactPhoneNational: '08012345678', emergencyContactAddress: '', declarationAccuracy: 'on', identityProcessingConsent: 'on', signatureName: 'Ada Lovelace', signatureConsent: 'on'
    };
    expect(stage2SubmissionSchema.safeParse(base).success).toBe(false);
    const parsed = stage2SubmissionSchema.parse({ ...base, applicantPhoneNational: '08012345678' });
    const payload = toStage2SubmissionPayload(parsed);
    expect(payload.primaryIdNumberMasked).not.toBe('A123456789');
    expect(payload.secondaryIdNumberMasked).not.toBe('VIN123456');
    expect(payload.applicantPhoneE164).toBe('+2348012345678');
    expect(payload.emergencyContactPhoneE164).toBe('+2348012345678');
  });

  it('updates admin review display and preserves admin-only document controls', () => {
    expect(adminDetail).toContain('Primary ID summary');
    expect(adminDetail).toContain('Secondary ID summary');
    expect(adminDetail).toContain('AdminDocumentActions');
    expect(portal).not.toContain('/uploads/');
    expect(`${portal}\n${actions}\n${adminDetail}`).not.toContain('<<<<<<<');
  });
});
