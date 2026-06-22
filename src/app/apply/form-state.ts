export type Stage1Field = 'firstName'|'middleInitial'|'lastName'|'email'|'phoneCountryIso'|'phoneNational'|'location'|'role'|'otherRole'|'workMode'|'experienceLevel'|'skills'|'portfolioUrl'|'message'|'cv'|'privacyConsent'|'signatureName'|'signatureConsent';
export type Stage1FormState = { ok: false; message?: string; values: Record<string,string>; fieldErrors: Partial<Record<Stage1Field,string>> };
export const initialStage1FormState: Stage1FormState = { ok: false, values: {}, fieldErrors: {} };
