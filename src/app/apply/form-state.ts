import { stage1ApplicantFieldNames } from '@/lib/stage1-fields';
export type Stage1Field = typeof stage1ApplicantFieldNames[number] | 'cv';
export type Stage1FormState = { ok: false; message?: string; values: Record<string,string>; fieldErrors: Partial<Record<Stage1Field,string>> };
export const initialStage1FormState: Stage1FormState = { ok: false, values: {}, fieldErrors: {} };
