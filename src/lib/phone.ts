export type CountryPhoneOption = { iso: string; name: string; dialCode: string; minLength: number; maxLength: number };

export const countryPhoneOptions: CountryPhoneOption[] = [
  { iso: 'NG', name: 'Nigeria', dialCode: '+234', minLength: 10, maxLength: 10 },
  { iso: 'US', name: 'United States', dialCode: '+1', minLength: 10, maxLength: 10 },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10 },
  { iso: 'CA', name: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10 },
  { iso: 'GH', name: 'Ghana', dialCode: '+233', minLength: 9, maxLength: 9 },
  { iso: 'KE', name: 'Kenya', dialCode: '+254', minLength: 9, maxLength: 9 },
  { iso: 'ZA', name: 'South Africa', dialCode: '+27', minLength: 9, maxLength: 9 },
  { iso: 'IN', name: 'India', dialCode: '+91', minLength: 10, maxLength: 10 },
  { iso: 'AU', name: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9 },
  { iso: 'DE', name: 'Germany', dialCode: '+49', minLength: 7, maxLength: 12 },
  { iso: 'FR', name: 'France', dialCode: '+33', minLength: 9, maxLength: 9 },
  { iso: 'ES', name: 'Spain', dialCode: '+34', minLength: 9, maxLength: 9 },
  { iso: 'IT', name: 'Italy', dialCode: '+39', minLength: 8, maxLength: 11 },
  { iso: 'NL', name: 'Netherlands', dialCode: '+31', minLength: 9, maxLength: 9 },
  { iso: 'IE', name: 'Ireland', dialCode: '+353', minLength: 7, maxLength: 9 },
  { iso: 'BR', name: 'Brazil', dialCode: '+55', minLength: 10, maxLength: 11 },
  { iso: 'MX', name: 'Mexico', dialCode: '+52', minLength: 10, maxLength: 10 },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971', minLength: 8, maxLength: 9 },
  { iso: 'CN', name: 'China', dialCode: '+86', minLength: 11, maxLength: 11 },
  { iso: 'JP', name: 'Japan', dialCode: '+81', minLength: 10, maxLength: 10 },
];

export function buildFullLegalName(firstName: string, middleInitial: string | null | undefined, lastName: string) {
  return [firstName, middleInitial, lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
}

export function normalizePhoneForCountry(iso: string, rawNationalNumber: string) {
  const country = countryPhoneOptions.find((option) => option.iso === iso);
  if (!country) return { valid: false as const, error: 'Select a valid country.' };
  let national = rawNationalNumber.replace(/[^0-9]/g, '');
  const dialDigits = country.dialCode.replace(/\D/g, '');
  if (national.startsWith(dialDigits) && national.length > country.maxLength) national = national.slice(dialDigits.length);
  if (national.startsWith('0') && national.length > country.maxLength) national = national.replace(/^0+/, '');
  const validLength = national.length >= country.minLength && national.length <= country.maxLength;
  const repeated = /^(\d)\1+$/.test(national);
  if (!validLength || repeated) return { valid: false as const, error: 'Enter a valid phone number for the selected country.' };
  return { valid: true as const, iso: country.iso, countryName: country.name, dialCode: country.dialCode, nationalNumber: national, e164: `${country.dialCode}${national}` };
}
