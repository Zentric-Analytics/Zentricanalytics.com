'use client';

import { useActionState, useState } from 'react';
import { workModes } from '@/lib/hiring';
import { countryPhoneOptions } from '@/lib/phone';
import { experienceLevelOptions, roleAppliedForOptions } from '@/lib/recruitment-options';
import { submitStage1Application } from './actions';
import { initialStage1FormState, type Stage1Field, type Stage1FormState } from './form-state';

const uploadAccept = [
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
].join(',');

function errorFor(state: Stage1FormState, field: Stage1Field) {
  return state.fieldErrors[field];
}

function inputClass(state: Stage1FormState, field: Stage1Field) {
  return `input ${errorFor(state, field) ? 'border-red-400 bg-red-50/40' : ''}`;
}

function FieldError({ state, field }: { state: Stage1FormState; field: Stage1Field }) {
  const error = errorFor(state, field);
  return error ? <p className="min-w-0 break-words text-sm font-medium text-red-700">{error}</p> : null;
}

function Required() {
  return <span className="text-red-600" aria-label="required">*</span>;
}

type FormSectionProps = {
  number: string;
  title: string;
  helper: string;
  children: React.ReactNode;
};

function FormSection({ number, title, helper, children }: FormSectionProps) {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-7">
      <div className="mb-6 flex min-w-0 gap-3 border-b border-slate-100 pb-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {number}
        </span>
        <div className="min-w-0">
          <h2 className="min-w-0 break-words text-xl font-bold text-ink">{title}</h2>
          <p className="mt-1 min-w-0 break-words text-sm leading-6 text-slate-600">{helper}</p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">{children}</div>
    </section>
  );
}

export function Stage1ApplicationForm() {
  const [state, formAction, pending] = useActionState(
    submitStage1Application,
    initialStage1FormState,
  );
  const [selectedFile, setSelectedFile] = useState('');
  const values = state.values;
  const selectedRole = values.role || roleAppliedForOptions[0];
  const otherRoleIsSelected = selectedRole === 'Other';

  return (
    <form action={formAction} className="w-full min-w-0 space-y-6">
      {state.message ? (
        <div
          className="min-w-0 break-words rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <FormSection
        number="1"
        title="Candidate Identity"
        helper="Use your legal name as it should appear on recruitment records."
      >
        <label className="field md:col-span-5">
          First Name <Required />
          <input className={inputClass(state, 'firstName')} name="firstName" autoComplete="given-name" defaultValue={values.firstName} required />
          <FieldError state={state} field="firstName" />
        </label>
        <label className="field md:col-span-2">
          Initial / Middle Initial
          <input className={inputClass(state, 'middleInitial')} name="middleInitial" autoComplete="additional-name" maxLength={20} defaultValue={values.middleInitial} />
          <FieldError state={state} field="middleInitial" />
        </label>
        <label className="field md:col-span-5">
          Last Name <Required />
          <input className={inputClass(state, 'lastName')} name="lastName" autoComplete="family-name" defaultValue={values.lastName} required />
          <FieldError state={state} field="lastName" />
        </label>
        <label className="field md:col-span-8">
          Email <Required />
          <input className={inputClass(state, 'email')} name="email" type="email" autoComplete="email" defaultValue={values.email} required />
          <FieldError state={state} field="email" />
        </label>
      </FormSection>

      <FormSection
        number="2"
        title="Contact Information"
        helper="Select the country for the phone number and enter national or international format."
      >
        <div className="field md:col-span-8">
          <span>Phone <Required /></span>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <select className={inputClass(state, 'phoneCountryIso')} name="phoneCountryIso" aria-label="Phone country" required defaultValue={values.phoneCountryIso || 'NG'}>
              {countryPhoneOptions.map((country) => (
                <option key={country.iso} value={country.iso}>{country.name} {country.dialCode}</option>
              ))}
            </select>
            <input className={inputClass(state, 'phoneNational')} name="phoneNational" inputMode="tel" autoComplete="tel" placeholder="0801 234 5678" defaultValue={values.phoneNational} required />
          </div>
          <span className="text-xs leading-5 text-slate-500">Spaces, hyphens, parentheses, local leading zero, and international prefixes are accepted when valid.</span>
          <FieldError state={state} field="phoneCountryIso" />
          <FieldError state={state} field="phoneNational" />
        </div>
        <label className="field md:col-span-7">
          Location <Required />
          <input className={inputClass(state, 'location')} name="location" autoComplete="address-level2" defaultValue={values.location} required />
          <FieldError state={state} field="location" />
        </label>
      </FormSection>

      <FormSection
        number="3"
        title="Role Interest"
        helper="Tell us the role, experience level, and work setting you are applying for."
      >
        <label className="field md:col-span-7">
          Position / Role Applied For <Required />
          <select className={inputClass(state, 'role')} name="role" required defaultValue={selectedRole}>
            {roleAppliedForOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <FieldError state={state} field="role" />
        </label>
        <label className={`field md:col-span-5 ${otherRoleIsSelected ? '' : 'opacity-75'}`}>
          If Other, specify role
          <input className={inputClass(state, 'otherRole')} name="otherRole" defaultValue={values.otherRole} placeholder="Only required when Other is selected" />
          <FieldError state={state} field="otherRole" />
        </label>
        <label className="field md:col-span-4">
          Experience Level <Required />
          <select className={inputClass(state, 'experienceLevel')} name="experienceLevel" required defaultValue={values.experienceLevel || experienceLevelOptions[0]}>
            {experienceLevelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <FieldError state={state} field="experienceLevel" />
        </label>
        <label className="field md:col-span-4">
          Work Mode Preference <Required />
          <select className={inputClass(state, 'workMode')} name="workMode" required defaultValue={values.workMode || workModes[0]}>
            {workModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <FieldError state={state} field="workMode" />
        </label>
      </FormSection>

      <FormSection
        number="4"
        title="Skills and Professional Links"
        helper="Summarize the capabilities and links that help reviewers understand your fit."
      >
        <label className="field md:col-span-12">
          Skills <Required />
          <input className={inputClass(state, 'skills')} name="skills" defaultValue={values.skills} placeholder="SQL, Python, React, research writing..." required />
          <FieldError state={state} field="skills" />
        </label>
        <label className="field md:col-span-10">
          Portfolio / GitHub / LinkedIn
          <input className={inputClass(state, 'portfolioUrl')} name="portfolioUrl" type="url" defaultValue={values.portfolioUrl} placeholder="https://" />
          <FieldError state={state} field="portfolioUrl" />
        </label>
        <label className="field md:col-span-12">
          Short application message <Required />
          <textarea className={`${inputClass(state, 'message')} min-h-36 resize-y leading-6`} name="message" rows={6} defaultValue={values.message} required />
          <FieldError state={state} field="message" />
        </label>
      </FormSection>

      <FormSection
        number="5"
        title="Document Upload"
        helper="Upload your CV/resume or a supporting document for the Stage 1 review."
      >
        <div className="min-w-0 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 sm:p-5 md:col-span-12 md:p-6">
          <label className="field min-w-0 cursor-pointer gap-3">
            <span className="text-base font-bold text-ink">CV/resume or supporting document <Required /></span>
            <input className="sr-only" name="cv" type="file" accept={uploadAccept} required onChange={(event) => setSelectedFile(event.currentTarget.files?.[0]?.name ?? '')} />
            <span className="btn btn-secondary w-fit">Choose file</span>
            <span className="min-w-0 break-words text-sm leading-6 text-slate-600">Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP. Maximum file size: 20MB (20,971,520 bytes). On mobile, you can upload a document or select an image from your gallery.</span>
            {selectedFile ? <span className="max-w-full break-words rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm">Selected: {selectedFile}</span> : null}
            <FieldError state={state} field="cv" />
          </label>
        </div>
      </FormSection>

      <FormSection
        number="6"
        title="Declaration and E-Signature"
        helper="Confirm consent and sign the Stage 1 application electronically."
      >
        <label className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 leading-6 md:col-span-12">
          <input name="privacyConsent" type="checkbox" defaultChecked={values.privacyConsent === 'on'} required />
          <span className="min-w-0 break-words">I consent to Zentric Analytics processing my application data for hiring review. <Required /><FieldError state={state} field="privacyConsent" /></span>
        </label>
        <label className="field md:col-span-7">
          Typed legal name <Required />
          <input className={inputClass(state, 'signatureName')} name="signatureName" defaultValue={values.signatureName} required placeholder="Type your full legal name" />
          <FieldError state={state} field="signatureName" />
        </label>
        <label className="flex min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 leading-6 md:col-span-12">
          <input name="signatureConsent" type="checkbox" defaultChecked={values.signatureConsent === 'on'} required />
          <span className="min-w-0 break-words">I confirm this typed name is my electronic signature and that the submitted information is accurate. <Required /><FieldError state={state} field="signatureConsent" /></span>
        </label>
        <div className="min-w-0 rounded-2xl bg-ink p-4 text-white sm:p-5 md:col-span-12 md:flex md:items-center md:justify-between md:gap-6">
          <p className="min-w-0 break-words text-sm leading-6 text-slate-200">Your upload remains private and is used only for recruitment review.</p>
          <button className="btn mt-4 w-full min-w-0 bg-white text-ink md:mt-0 md:w-auto" type="submit" disabled={pending}>{pending ? 'Submitting...' : 'Submit Stage 1 Application'}</button>
        </div>
      </FormSection>
    </form>
  );
}
