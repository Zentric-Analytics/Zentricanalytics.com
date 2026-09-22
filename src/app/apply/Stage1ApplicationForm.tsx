'use client';

import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './application.module.css';
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
    compact: styles.half,
    standard: styles.half,
    wide: styles.full,
    full: styles.full,
  }[width];
}
function inputClass(state: Stage1FormState, field: Stage1Field) {
  return `${styles.control} ${errorFor(state, field) ? styles.invalid : ''}`;
}
function FieldError({ state, field }: { state: Stage1FormState; field: Stage1Field }) {
  const error = errorFor(state, field);
  return error ? <p className={styles.fieldError} id={`${field}-error`}>{error}</p> : null;
}
function Required() { return <span className="text-red-600" aria-label="required">*</span>; }

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.section}><h2>{title}</h2><div className={styles.fields}>{children}</div></section>;
}

function TextField({ state, name, label, required = false, width = 'standard', helper, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { state: Stage1FormState; name: Stage1Field; label: string; required?: boolean; width?: Width; helper?: string }) {
  return <label className={`${styles.field} ${className ?? fieldWidth(width)}`}><span className={styles.label}>{label} {required ? <Required /> : null}</span>{helper ? <span className={styles.helper}>{helper}</span> : null}<input className={inputClass(state, name)} name={name} defaultValue={state.values[name]} required={required} aria-invalid={Boolean(errorFor(state, name))} aria-describedby={errorFor(state, name) ? `${name}-error` : undefined} {...props} /><FieldError state={state} field={name} /></label>;
}
function SelectField({ state, name, label, options, required = true, width = 'standard' }: { state: Stage1FormState; name: Stage1Field; label: string; options: readonly string[]; required?: boolean; width?: Width }) {
  return <label className={`${styles.field} ${fieldWidth(width)}`}><span className={styles.label}>{label} {required ? <Required /> : null}</span><select className={inputClass(state, name)} name={name} required={required} defaultValue={state.values[name] || options[0]} aria-invalid={Boolean(errorFor(state, name))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><FieldError state={state} field={name} /></label>;
}
function TextAreaField({ state, name, label, required = false, helper, placeholder }: { state: Stage1FormState; name: Stage1Field; label: string; required?: boolean; helper?: string; placeholder?: string }) {
  return <label className={`${styles.field} ${fieldWidth('full')}`}><span className={styles.label}>{label} {required ? <Required /> : null}</span>{helper ? <span className={styles.helper}>{helper}</span> : null}<textarea className={`${inputClass(state, name)} ${styles.textarea}`} name={name} defaultValue={state.values[name]} placeholder={placeholder} required={required} aria-invalid={Boolean(errorFor(state, name))} /><FieldError state={state} field={name} /></label>;
}
function ConsentBox({ state, name, children }: { state: Stage1FormState; name: Stage1Field; children: React.ReactNode }) {
  return <label className={styles.consent}><input className="mt-1 h-4 w-4 accent-brand" name={name} type="checkbox" defaultChecked={state.values[name] === 'on'} required aria-invalid={Boolean(errorFor(state, name))} /><span className="min-w-0"><span>{children}</span> <Required /><FieldError state={state} field={name} /></span></label>;
}

export function Stage1ApplicationForm({ vacancy }: { vacancy?: { publicSlug: string; title: string; vacancyNumber: string; applicationDeadline: Date | null } | null }) {
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
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [selectedRole, setSelectedRole] = useState(vacancy ? "Other" : values.role || roleAppliedForOptions[0]);
  const otherRoleIsSelected = selectedRole === 'Other';

  return <form action={formAction} className={styles.form} aria-busy={pending} onSubmit={() => { validateVisibleFileSelection(); }} onChange={(event) => { const name = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name as Stage1Field | undefined; if (name) clearFieldError(name); }}>
    <input type="hidden" name="submissionKey" value={submissionKey} />
    {vacancy ? <><input type="hidden" name="vacancySlug" value={vacancy.publicSlug} /><input type="hidden" name="role" value="Other" /><input type="hidden" name="otherRole" value={vacancy.title} /></> : null}
    <p className="sr-only" aria-live="polite">{pending ? 'Submitting application' : ''}</p>
    {visibleMessage ? <div className="min-w-0 break-words rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{visibleMessage}</div> : null}

    <FormSection title="Personal details">
      <TextField state={displayState} name="firstName" label="First name" autoComplete="given-name" required />
      <TextField state={displayState} name="lastName" label="Last name" autoComplete="family-name" required />
      <TextField state={displayState} name="middleInitial" label="Middle name / initial" autoComplete="additional-name" maxLength={50} />
      <TextField state={displayState} name="preferredName" label="Preferred name" />
      <TextField state={displayState} name="email" label="Email" type="email" autoComplete="email" required />
      <div className={styles.field}><span className={styles.label}>Phone <Required /></span><div className={styles.phone}><select className={inputClass(displayState,'phoneCountryIso')} name="phoneCountryIso" aria-label="Phone country" required defaultValue={values.phoneCountryIso || 'NG'}>{countryPhoneOptions.map((country)=><option key={country.iso} value={country.iso}>{country.name} {country.dialCode}</option>)}</select><input className={inputClass(displayState,'phoneNational')} name="phoneNational" inputMode="tel" autoComplete="tel" defaultValue={values.phoneNational} required aria-label="Phone number" /></div><FieldError state={displayState} field="phoneCountryIso" /><FieldError state={displayState} field="phoneNational" /></div>
      <TextField state={displayState} name="residentialAddress" label="Current city/state or residential location" autoComplete="street-address" placeholder="e.g. Ikeja, Lagos" required width="full" />
    </FormSection>

    <FormSection title="Role preference">
      {vacancy ? <div className={`${styles.vacancy} ${fieldWidth("full")}`}><p className="text-sm font-bold text-brand">{vacancy.vacancyNumber}</p><p className="mt-1 text-lg font-bold">{vacancy.title}</p><p className="mt-1 text-sm text-slate-600">{vacancy.applicationDeadline ? `Applications close ${vacancy.applicationDeadline.toLocaleString()}.` : "Applications are currently open."}</p></div> : <><label className={`${styles.field} ${fieldWidth('wide')}`}><span className={styles.label}>Role applied for <Required /></span><select className={inputClass(displayState,'role')} name="role" required value={selectedRole} onChange={(event)=>{ setSelectedRole(event.currentTarget.value); clearFieldError('role'); }} aria-invalid={Boolean(errorFor(displayState, 'role'))}>{roleAppliedForOptions.map((role)=><option key={role} value={role}>{role}</option>)}</select><FieldError state={displayState} field="role" /></label>
      {otherRoleIsSelected ? <TextField state={displayState} name="otherRole" label="Other role" required width="standard" /> : null}</>}
      <SelectField state={displayState} name="employmentType" label="Employment type" options={employmentTypeOptions} width="compact" />
      <SelectField state={displayState} name="workMode" label="Preferred work mode" options={stage1WorkModeOptions} width="compact" />
    </FormSection>

    <FormSection title="Experience snapshot">
      <SelectField state={displayState} name="experienceLevel" label="Experience level" options={experienceLevelOptions} required={false} width="compact" />
      <TextField state={displayState} name="portfolioUrl" label="Portfolio or profile link" type="url" placeholder="https://" width="standard" helper="LinkedIn, GitHub, portfolio, or website." />
      <TextField state={displayState} name="skills" label="Skills/tools" placeholder="e.g. SQL, Excel, Python, Power BI" required width="wide" />
      <TextAreaField state={displayState} name="message" label="Application message" placeholder="Briefly tell us why you are interested and what you would bring to the role." required helper="Aim for 3–6 focused sentences." />
    </FormSection>

    <FormSection title="CV/resume">
      <div className={styles.upload}>
        <div className={styles.uploadInner}>
          <div className="min-w-0"><p className="text-base font-bold text-ink">CV/resume <Required /></p><p className="mt-1 text-sm leading-6 text-slate-600">PDF, DOC, DOCX, JPG, PNG, or WEBP. Maximum file size: 20MB.</p>{selectedFile ? <p className={styles.fileName}>Selected: {selectedFile}</p> : <p className="mt-3 text-sm font-semibold text-slate-500">No file selected yet.</p>}<FieldError state={displayState} field="cv" />{fileNeedsReselection && !selectedFile ? <p className="mt-2 text-sm font-semibold text-red-700" id="cv-reselection-error" role="alert">Please reselect your CV/resume before submitting again.</p> : null}</div>
          <div><input ref={fileInputRef} id={fileInputId} className="sr-only" name="cv" type="file" accept={uploadAccept} required aria-invalid={Boolean(errorFor(displayState, 'cv') || fileNeedsReselection)} aria-describedby={fileErrorDescription} onInvalid={()=>setFileNeedsReselection(true)} onChange={(event)=>{ setSelectedFile(event.currentTarget.files?.[0]?.name ?? ''); clearFieldError('cv'); }} /><label htmlFor={fileInputId} className={styles.chooseFile}>Choose file</label></div>
        </div>
      </div>
    </FormSection>

    <FormSection title="Declaration and signature">
      <ConsentBox state={displayState} name="privacyConsent">I consent to Zentric Analytics processing my application data for recruitment review and records.</ConsentBox>
      <ConsentBox state={displayState} name="declarationAccuracy">I declare that the information provided is true and complete.</ConsentBox>
      <TextField state={displayState} name="signatureName" label="Electronic signature typed name" required width="wide" helper="Type your full legal name." />
      <ConsentBox state={displayState} name="signatureConsent">I confirm this typed name is my electronic signature.</ConsentBox>
    </FormSection>

    <div className={styles.submitRow}><p className={styles.submitNote}>Review your details before submitting. We will email your application ID after successful submission.</p><button className={styles.submit} type="submit" disabled={pending}>{pending ? 'Submitting...' : 'Submit stage 1 application'}</button></div>
  </form>;
}
