'use client';

import { useActionState, useState } from 'react';
import { countryPhoneOptions } from '@/lib/phone';
import { roleAppliedForOptions } from '@/lib/recruitment-options';
import { employmentTypeOptions, stage1WorkModeOptions } from '@/lib/stage1-fields';
import { submitStage1Application } from './actions';
import { initialStage1FormState, type Stage1Field, type Stage1FormState } from './form-state';

const uploadAccept = ['.pdf','.doc','.docx','.jpg','.jpeg','.png','.webp','image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'].join(',');
const experienceLevelOptions = ['Entry level', 'Intermediate', 'Experienced', 'Senior / Lead', 'Career switcher'] as const;
function errorFor(state: Stage1FormState, field: Stage1Field) { return state.fieldErrors[field]; }
function inputClass(state: Stage1FormState, field: Stage1Field) { return `input h-12 ${errorFor(state, field) ? 'border-red-400 bg-red-50/40' : ''}`; }
function FieldError({ state, field }: { state: Stage1FormState; field: Stage1Field }) { const error = errorFor(state, field); return error ? <p className="min-w-0 break-words text-sm font-medium text-red-700">{error}</p> : null; }
function Required() { return <span className="text-red-600" aria-label="required">*</span>; }
function FormSection({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) { return <section className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8"><div className="mb-6 max-w-3xl"><h2 className="text-xl font-bold text-ink sm:text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p></div><div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">{children}</div></section>; }
function SelectField({ state, name, label, options, required = true, span = '' }: { state: Stage1FormState; name: Stage1Field; label: string; options: readonly string[]; required?: boolean; span?: string }) { return <label className={`field ${span}`}>{label} {required ? <Required /> : null}<select className={inputClass(state, name)} name={name} required={required} defaultValue={state.values[name] || options[0]}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><FieldError state={state} field={name} /></label>; }

export function Stage1ApplicationForm() {
  const [state, formAction, pending] = useActionState(submitStage1Application, initialStage1FormState);
  const [selectedFile, setSelectedFile] = useState('');
  const values = state.values;
  const [selectedRole, setSelectedRole] = useState(values.role || roleAppliedForOptions[0]);
  const otherRoleIsSelected = selectedRole === 'Other';
  return <form action={formAction} className="w-full min-w-0 space-y-6 sm:space-y-8">
    {state.message ? <div className="min-w-0 break-words rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{state.message}</div> : null}

    <FormSection title="Personal details" helper="Tell us who you are and how we can contact you about this application.">
      <label className="field">First name <Required /><input className={inputClass(state,'firstName')} name="firstName" autoComplete="given-name" defaultValue={values.firstName} required /><FieldError state={state} field="firstName" /></label>
      <label className="field">Middle name / initial<input className={inputClass(state,'middleInitial')} name="middleInitial" autoComplete="additional-name" maxLength={50} defaultValue={values.middleInitial} /><FieldError state={state} field="middleInitial" /></label>
      <label className="field">Last name <Required /><input className={inputClass(state,'lastName')} name="lastName" autoComplete="family-name" defaultValue={values.lastName} required /><FieldError state={state} field="lastName" /></label>
      <label className="field">Preferred name<input className={inputClass(state,'preferredName')} name="preferredName" defaultValue={values.preferredName} /><FieldError state={state} field="preferredName" /></label>
      <label className="field">Email <Required /><input className={inputClass(state,'email')} name="email" type="email" autoComplete="email" defaultValue={values.email} required /><FieldError state={state} field="email" /></label>
      <div className="field"><span>Phone <Required /></span><div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"><select className={inputClass(state,'phoneCountryIso')} name="phoneCountryIso" aria-label="Phone country" required defaultValue={values.phoneCountryIso || 'NG'}>{countryPhoneOptions.map((country)=><option key={country.iso} value={country.iso}>{country.name} {country.dialCode}</option>)}</select><input className={inputClass(state,'phoneNational')} name="phoneNational" inputMode="tel" autoComplete="tel" defaultValue={values.phoneNational} required /></div><FieldError state={state} field="phoneCountryIso" /><FieldError state={state} field="phoneNational" /></div>
      <label className="field md:col-span-2">Current city/state or residential location <Required /><input className={inputClass(state,'residentialAddress')} name="residentialAddress" autoComplete="street-address" defaultValue={values.residentialAddress} placeholder="e.g. Ikeja, Lagos" required /><FieldError state={state} field="residentialAddress" /></label>
    </FormSection>

    <FormSection title="Role preference" helper="Choose the opportunity and working arrangement that best fit your application.">
      <label className="field md:col-span-2">Role applied for <Required /><select className={inputClass(state,'role')} name="role" required value={selectedRole} onChange={(event)=>setSelectedRole(event.currentTarget.value)}>{roleAppliedForOptions.map((role)=><option key={role} value={role}>{role}</option>)}</select><FieldError state={state} field="role" /></label>
      {otherRoleIsSelected ? <label className="field md:col-span-2">Other role <Required /><input className={inputClass(state,'otherRole')} name="otherRole" defaultValue={values.otherRole} required /><FieldError state={state} field="otherRole" /></label> : null}
      <SelectField state={state} name="employmentType" label="Employment type" options={employmentTypeOptions} />
      <SelectField state={state} name="workMode" label="Preferred work mode" options={stage1WorkModeOptions} />
    </FormSection>

    <FormSection title="Experience and links" helper="Share a concise snapshot of your experience, tools, and relevant work links.">
      <SelectField state={state} name="experienceLevel" label="Experience level" options={experienceLevelOptions} />
      <label className="field">Portfolio, GitHub, LinkedIn, or website<input className={inputClass(state,'portfolioUrl')} name="portfolioUrl" type="url" defaultValue={values.portfolioUrl} placeholder="https://" /><FieldError state={state} field="portfolioUrl" /></label>
      <label className="field md:col-span-2">Skills/tools <Required /><input className={inputClass(state,'skills')} name="skills" defaultValue={values.skills} placeholder="e.g. SQL, Excel, Python, Power BI" required /><FieldError state={state} field="skills" /></label>
      <label className="field md:col-span-2">Short application message <Required /><textarea className={`${inputClass(state,'message')} min-h-32 resize-y py-3 leading-6`} name="message" defaultValue={values.message} placeholder="Briefly tell us why you are interested and what you would bring to the role." required /><FieldError state={state} field="message" /></label>
    </FormSection>

    <FormSection title="Upload CV/resume" helper="Upload one current CV or resume. Private files remain restricted to recruitment review.">
      <div className="md:col-span-2 min-w-0 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6"><label className="field min-w-0 cursor-pointer gap-3"><span className="text-base font-bold text-ink">CV/resume <Required /></span><span className="text-sm leading-6 text-slate-600">Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP. Maximum file size: 20MB.</span><input className="sr-only" name="cv" type="file" accept={uploadAccept} required onChange={(event)=>setSelectedFile(event.currentTarget.files?.[0]?.name ?? '')} /><span className="btn btn-secondary w-fit">Choose file</span>{selectedFile ? <span className="max-w-full break-words rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm">Selected: {selectedFile}</span> : null}<FieldError state={state} field="cv" /></label></div>
    </FormSection>

    <FormSection title="Declaration and signature" helper="Confirm consent and sign electronically before submitting your application.">
      <label className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 leading-6 md:col-span-2"><input className="mt-1" name="privacyConsent" type="checkbox" defaultChecked={values.privacyConsent === 'on'} required /><span>I consent to Zentric Analytics Ltd processing my application data for recruitment review and records. <Required /><FieldError state={state} field="privacyConsent" /></span></label>
      <label className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 leading-6 md:col-span-2"><input className="mt-1" name="declarationAccuracy" type="checkbox" defaultChecked={values.declarationAccuracy === 'on'} required /><span>I declare that the information provided is true and complete. <Required /><FieldError state={state} field="declarationAccuracy" /></span></label>
      <label className="field md:col-span-2">Electronic signature typed name <Required /><input className={inputClass(state,'signatureName')} name="signatureName" defaultValue={values.signatureName} required /><FieldError state={state} field="signatureName" /></label>
      <label className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 leading-6 md:col-span-2"><input className="mt-1" name="signatureConsent" type="checkbox" defaultChecked={values.signatureConsent === 'on'} required /><span>I confirm this typed name is my electronic signature. <Required /><FieldError state={state} field="signatureConsent" /></span></label>
    </FormSection>

    <div className="flex w-full min-w-0 flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between"><p className="text-sm leading-6 text-slate-600">Review your details before submitting. Additional HR information may be requested in later stages.</p><button className="btn w-full min-w-0 justify-center px-8 py-4 text-base md:w-auto" type="submit" disabled={pending}>{pending ? 'Submitting...' : 'Submit Application'}</button></div>
  </form>;
}
