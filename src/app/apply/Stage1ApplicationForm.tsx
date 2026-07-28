'use client';

import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react';
import { countryPhoneOptions } from '@/lib/phone';
import { roleAppliedForOptions } from '@/lib/recruitment-options';
import { employmentTypeOptions, stage1WorkModeOptions } from '@/lib/stage1-fields';
import { submitStage1Application } from './actions';
import { initialStage1FormState, type Stage1Field, type Stage1FormState } from './form-state';

const uploadAccept = ['.pdf','.doc','.docx','.jpg','.jpeg','.png','.webp','image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'].join(',');
const experienceLevelOptions = ['Entry level', 'Intermediate', 'Experienced', 'Senior / Lead', 'Career switcher'] as const;

type Width = 'compact' | 'standard' | 'wide' | 'full';

function errorFor(state: Stage1FormState, field: Stage1Field) { return state.fieldErrors[field]; }
function fieldWidth(width: Width = 'standard') {
  return {
    compact: 'md:col-span-3 xl:col-span-2',
    standard: 'md:col-span-3',
    wide: 'md:col-span-6 xl:col-span-4',
    full: 'md:col-span-6',
  }[width];
}
function inputClass(state: Stage1FormState, field: Stage1Field) {
  return `input text-[0.95rem] placeholder:text-slate-400 ${errorFor(state, field) ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100' : ''}`;
}
function FieldError({ state, field }: { state: Stage1FormState; field: Stage1Field }) {
  const error = errorFor(state, field);
  return error ? <p className="min-w-0 break-words text-sm font-semibold text-red-700" id={`${field}-error`}>{error}</p> : null;
}
function Required() { return <span className="text-red-600" aria-label="required">*</span>; }

function FormSection({ eyebrow, title, helper, children }: { eyebrow: string; title: string; helper: string; children: React.ReactNode }) {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl sm:rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-5 sm:px-6 lg:px-8">
        <p className="text-base font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{helper}</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-6 md:gap-5 lg:p-8">{children}</div>
    </section>
  );
}

function TextField({ state, name, label, required = false, width = 'standard', helper, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { state: Stage1FormState; name: Stage1Field; label: string; required?: boolean; width?: Width; helper?: string }) {
  return <label className={`field ${className ?? fieldWidth(width)}`}><span className="text-sm font-bold text-ink">{label} {required ? <Required /> : null}</span>{helper ? <span className="text-xs leading-5 text-slate-500">{helper}</span> : null}<input className={inputClass(state, name)} name={name} defaultValue={state.values[name]} required={required} aria-invalid={Boolean(errorFor(state, name))} aria-describedby={errorFor(state, name) ? `${name}-error` : undefined} {...props} /><FieldError state={state} field={name} /></label>;
}
function SelectField({ state, name, label, options, required = true, width = 'standard' }: { state: Stage1FormState; name: Stage1Field; label: string; options: readonly string[]; required?: boolean; width?: Width }) {
  return <label className={`field ${fieldWidth(width)}`}><span className="text-sm font-bold text-ink">{label} {required ? <Required /> : null}</span><select className={inputClass(state, name)} name={name} required={required} defaultValue={state.values[name] || options[0]} aria-invalid={Boolean(errorFor(state, name))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><FieldError state={state} field={name} /></label>;
}
function TextAreaField({ state, name, label, required = false, helper, placeholder }: { state: Stage1FormState; name: Stage1Field; label: string; required?: boolean; helper?: string; placeholder?: string }) {
  return <label className={`field ${fieldWidth('full')}`}><span className="text-sm font-bold text-ink">{label} {required ? <Required /> : null}</span>{helper ? <span className="text-xs leading-5 text-slate-500">{helper}</span> : null}<textarea className={`${inputClass(state, name)} min-h-32 resize-y py-3 leading-6`} name={name} defaultValue={state.values[name]} placeholder={placeholder} required={required} aria-invalid={Boolean(errorFor(state, name))} /><FieldError state={state} field={name} /></label>;
}
function ConsentBox({ state, name, children }: { state: Stage1FormState; name: Stage1Field; children: React.ReactNode }) {
  return <label className="flex min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700 shadow-sm transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 md:col-span-6"><input className="mt-1 h-4 w-4 accent-brand" name={name} type="checkbox" defaultChecked={state.values[name] === 'on'} required aria-invalid={Boolean(errorFor(state, name))} /><span className="min-w-0"><span>{children}</span> <Required /><FieldError state={state} field={name} /></span></label>;
}

export function Stage1ApplicationForm() {
  const [state, formAction, pending] = useActionState(submitStage1Application, initialStage1FormState);
  const [clearedErrors, setClearedErrors] = useState<Partial<Record<Stage1Field, boolean>>>({});
  const [selectedFile, setSelectedFile] = useState('');
  const [fileNeedsReselection, setFileNeedsReselection] = useState(false);
  const [editedSinceServerError, setEditedSinceServerError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const values = state.values;
  const displayState = useMemo<Stage1FormState>(() => ({
    ...state,
    fieldErrors: Object.fromEntries(Object.entries(state.fieldErrors).filter(([field]) => !clearedErrors[field as Stage1Field])) as Stage1FormState['fieldErrors'],
  }), [state, clearedErrors]);

  useEffect(() => {
    setClearedErrors({});
    setEditedSinceServerError(false);
    if (state.message) {
      setSelectedFile('');
      setFileNeedsReselection(true);
    }
    const firstInvalidField = Object.keys(state.fieldErrors)[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[name="${CSS.escape(firstInvalidField)}"]`)?.focus();
      });
    }
  }, [state]);

  const clearFieldError = (field: Stage1Field) => {
    setEditedSinceServerError(true);
    setClearedErrors((current) => current[field] ? current : { ...current, [field]: true });
    if (field === 'cv') setFileNeedsReselection(false);
  };
  const validateVisibleFileSelection = () => {
    const hasFile = Boolean(fileInputRef.current?.files?.length);
    setFileNeedsReselection(!hasFile);
    return hasFile;
  };
  const visibleMessage = state.message && !editedSinceServerError ? state.message : undefined;
  const fileErrorDescription = [errorFor(displayState, 'cv') ? 'cv-error' : '', fileNeedsReselection ? 'cv-reselection-error' : ''].filter(Boolean).join(' ') || undefined;
  const [selectedRole, setSelectedRole] = useState(values.role || roleAppliedForOptions[0]);
  const otherRoleIsSelected = selectedRole === 'Other';

  return <form action={formAction} className="mx-auto w-full max-w-5xl min-w-0 space-y-6 sm:space-y-8" aria-busy={pending} onSubmit={() => { validateVisibleFileSelection(); }} onChange={(event) => { const name = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name as Stage1Field | undefined; if (name) clearFieldError(name); }}>
    <p className="sr-only" aria-live="polite">{pending ? 'Submitting application' : ''}</p>
    {visibleMessage ? <div className="min-w-0 break-words rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{visibleMessage}</div> : null}

    <FormSection eyebrow="Step 01" title="Personal details" helper="Use the same contact information you want our hiring team to use for updates.">
      <div className="md:col-span-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        <TextField state={displayState} name="firstName" label="First name" autoComplete="given-name" required className="md:col-span-5" />
        <TextField state={displayState} name="middleInitial" label="Middle name / initial" autoComplete="additional-name" maxLength={50} className="md:col-span-2" />
        <TextField state={displayState} name="lastName" label="Last name" autoComplete="family-name" required className="md:col-span-5" />
      </div>

      <div className="md:col-span-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12 md:items-start md:gap-5">
        <TextField state={displayState} name="preferredName" label="Preferred name" className="md:col-span-3" />
        <TextField state={displayState} name="email" label="Email" type="email" autoComplete="email" required className="md:col-span-5" />
        <div className="field md:col-span-4"><span className="text-sm font-bold text-ink">Phone <Required /></span><div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]"><select className={inputClass(displayState,'phoneCountryIso')} name="phoneCountryIso" aria-label="Phone country" required defaultValue={values.phoneCountryIso || 'NG'}>{countryPhoneOptions.map((country)=><option key={country.iso} value={country.iso}>{country.name} {country.dialCode}</option>)}</select><input className={inputClass(displayState,'phoneNational')} name="phoneNational" inputMode="tel" autoComplete="tel" defaultValue={values.phoneNational} required aria-label="Phone number" /></div><FieldError state={displayState} field="phoneCountryIso" /><FieldError state={displayState} field="phoneNational" /></div>
      </div>

      <div className="md:col-span-6 grid min-w-0 grid-cols-1 md:grid-cols-12">
        <TextField state={displayState} name="residentialAddress" label="Current city/state or residential location" autoComplete="street-address" placeholder="e.g. Ikeja, Lagos" required className="md:col-span-8" />
      </div>
    </FormSection>

    <FormSection eyebrow="Step 02" title="Role preference" helper="Select the role and work arrangement that best match this application.">
      <label className={`field ${fieldWidth('wide')}`}><span className="text-sm font-bold text-ink">Role applied for <Required /></span><select className={inputClass(displayState,'role')} name="role" required value={selectedRole} onChange={(event)=>{ setSelectedRole(event.currentTarget.value); clearFieldError('role'); }} aria-invalid={Boolean(errorFor(displayState, 'role'))}>{roleAppliedForOptions.map((role)=><option key={role} value={role}>{role}</option>)}</select><FieldError state={displayState} field="role" /></label>
      {otherRoleIsSelected ? <TextField state={displayState} name="otherRole" label="Other role" required width="standard" /> : null}
      <SelectField state={displayState} name="employmentType" label="Employment type" options={employmentTypeOptions} width="compact" />
      <SelectField state={displayState} name="workMode" label="Preferred work mode" options={stage1WorkModeOptions} width="compact" />
    </FormSection>

    <FormSection eyebrow="Step 03" title="Experience snapshot" helper="Keep this concise. We will request deeper information in later stages if needed.">
      <SelectField state={displayState} name="experienceLevel" label="Experience level" options={experienceLevelOptions} required={false} width="compact" />
      <TextField state={displayState} name="portfolioUrl" label="Portfolio or profile link" type="url" placeholder="https://" width="wide" helper="LinkedIn, GitHub, portfolio, or website." />
      <TextField state={displayState} name="skills" label="Skills/tools" placeholder="e.g. SQL, Excel, Python, Power BI" required width="wide" />
      <TextAreaField state={displayState} name="message" label="Application message" placeholder="Briefly tell us why you are interested and what you would bring to the role." required helper="Aim for 3–6 focused sentences." />
    </FormSection>

    <FormSection eyebrow="Step 04" title="CV/resume" helper="Upload one current document for recruitment review.">
      <div className="md:col-span-6 min-w-0 rounded-[1.5rem] border border-brand/20 bg-gradient-to-br from-brand/5 via-white to-accent/10 p-4 shadow-inner sm:p-5">
        <div className="grid gap-4 rounded-2xl border border-white/80 bg-white/85 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
          <div className="min-w-0"><p className="text-base font-bold text-ink">CV/resume <Required /></p><p className="mt-1 text-sm leading-6 text-slate-600">PDF, DOC, DOCX, JPG, PNG, or WEBP. Maximum file size: 20MB.</p>{selectedFile ? <p className="mt-3 max-w-full break-words rounded-xl bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">Selected: {selectedFile}</p> : <p className="mt-3 text-sm font-semibold text-slate-500">No file selected yet.</p>}<FieldError state={displayState} field="cv" />{fileNeedsReselection && !selectedFile ? <p className="mt-2 text-sm font-semibold text-red-700" id="cv-reselection-error" role="alert">Please reselect your CV/resume before submitting again.</p> : null}</div>
          <div><input ref={fileInputRef} id={fileInputId} className="sr-only" name="cv" type="file" accept={uploadAccept} required aria-invalid={Boolean(errorFor(displayState, 'cv') || fileNeedsReselection)} aria-describedby={fileErrorDescription} onInvalid={()=>setFileNeedsReselection(true)} onChange={(event)=>{ setSelectedFile(event.currentTarget.files?.[0]?.name ?? ''); clearFieldError('cv'); }} /><label htmlFor={fileInputId} className="btn btn-secondary btn-compact cursor-pointer">Choose file</label></div>
        </div>
      </div>
    </FormSection>

    <FormSection eyebrow="Step 05" title="Declaration and signature" helper="Your declaration helps us keep this first-stage record official and trustworthy.">
      <ConsentBox state={displayState} name="privacyConsent">I consent to Zentric Analytics processing my application data for recruitment review and records.</ConsentBox>
      <ConsentBox state={displayState} name="declarationAccuracy">I declare that the information provided is true and complete.</ConsentBox>
      <TextField state={displayState} name="signatureName" label="Electronic signature typed name" required width="wide" helper="Type your full legal name." />
      <ConsentBox state={displayState} name="signatureConsent">I confirm this typed name is my electronic signature.</ConsentBox>
    </FormSection>

    <div className="flex w-full min-w-0 flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-ink p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] sm:shadow-xl sm:p-6 md:flex-row md:items-center md:justify-between"><p className="text-sm leading-6 text-slate-200">Review your details before submitting. We will email your application ID after successful submission.</p><button className="btn btn-primary w-full min-w-0 justify-center md:w-auto" type="submit" disabled={pending}>{pending ? 'Submitting...' : 'Submit stage 1 application'}</button></div>
  </form>;
}
