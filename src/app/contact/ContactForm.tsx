'use client';

import { useActionState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { submitContactEnquiry, type ContactFormState } from './actions';

const serviceOptions = [
  'Software Engineering',
  'Artificial Intelligence',
  'Data and Analytics',
  'Cloud and Infrastructure',
  'Cybersecurity',
  'Digital Transformation',
  'Product Design',
  'Technology Consulting',
  'Other',
] as const;

const budgetOptions = ['Not sure yet', 'Under $5,000', '$5,000 – $15,000', '$15,000 – $50,000', '$50,000+', 'Prefer not to say'] as const;

const initialState: ContactFormState = { status: 'idle', message: '' };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-2 text-sm font-medium text-red-700">{message}</p>;
}

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactEnquiry, initialState);
  const inputClass = 'input mt-2';
  const labelClass = 'text-sm font-semibold text-ink transition-colors duration-200 ease-out';

  return (
    <form action={formAction} className="za-panel p-6 sm:p-8 lg:p-11" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass} htmlFor="fullName">Full Name<span className="text-red-700"> *</span><input id="fullName" name="fullName" required autoComplete="name" className={inputClass} aria-invalid={Boolean(state.fieldErrors?.fullName)} aria-describedby={state.fieldErrors?.fullName ? 'fullName-error' : undefined} /><FieldError id="fullName-error" message={state.fieldErrors?.fullName} /></label>
        <label className={labelClass} htmlFor="workEmail">Work Email<span className="text-red-700"> *</span><input id="workEmail" name="workEmail" required type="email" autoComplete="email" className={inputClass} aria-invalid={Boolean(state.fieldErrors?.workEmail)} aria-describedby={state.fieldErrors?.workEmail ? 'workEmail-error' : undefined} /><FieldError id="workEmail-error" message={state.fieldErrors?.workEmail} /></label>
        <label className={labelClass} htmlFor="phoneNumber">Phone Number<input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel" className={inputClass} /></label>
        <label className={labelClass} htmlFor="organization">Organization<input id="organization" name="organization" autoComplete="organization" className={inputClass} /></label>
        <label className={labelClass} htmlFor="serviceNeed">What can we help you with?<select id="serviceNeed" name="serviceNeed" required className={inputClass} defaultValue="" aria-invalid={Boolean(state.fieldErrors?.serviceNeed)} aria-describedby={state.fieldErrors?.serviceNeed ? 'serviceNeed-error' : undefined}><option value="" disabled>Select a capability</option>{serviceOptions.map((option) => <option key={option}>{option}</option>)}</select><FieldError id="serviceNeed-error" message={state.fieldErrors?.serviceNeed} /></label>
        <label className={labelClass} htmlFor="projectBudget">Project Budget<select id="projectBudget" name="projectBudget" required className={inputClass} defaultValue="" aria-invalid={Boolean(state.fieldErrors?.projectBudget)} aria-describedby={state.fieldErrors?.projectBudget ? 'projectBudget-error' : undefined}><option value="" disabled>Select a range</option>{budgetOptions.map((option) => <option key={option}>{option}</option>)}</select><FieldError id="projectBudget-error" message={state.fieldErrors?.projectBudget} /></label>
        <label className={`${labelClass} md:col-span-2`} htmlFor="message">Message<span className="text-red-700"> *</span><textarea id="message" name="message" required rows={7} className={`${inputClass} h-auto min-h-[180px] py-4 leading-6`} aria-invalid={Boolean(state.fieldErrors?.message)} aria-describedby={state.fieldErrors?.message ? 'message-error' : undefined} /></label>
        <div className="md:col-span-2"><FieldError id="message-error" message={state.fieldErrors?.message} /></div>
      </div>
      <p className="mt-5 text-sm leading-6 text-text-muted">By submitting this form, you agree that Zentric Analytics may contact you regarding your enquiry. Your information will be handled responsibly and will not be sold.</p>
      <button type="submit" disabled={isPending} className="btn zentric-primary-cta group mt-6 min-w-[10rem] w-full justify-center sm:w-auto">
        <span>{isPending ? 'Sending...' : 'Send Enquiry'}</span>{isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />}
      </button>
      <div className="mt-5" aria-live="polite" aria-busy={isPending}>
        {state.status !== 'idle' ? <p className={`rounded-2xl border p-4 text-sm font-semibold transition-[opacity,border-color,background-color,color] duration-200 ease-out ${state.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
