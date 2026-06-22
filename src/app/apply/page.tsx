import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/Section';
import { workModes } from '@/lib/hiring';
import { countryPhoneOptions } from '@/lib/phone';
import { experienceLevelOptions, roleAppliedForOptions } from '@/lib/recruitment-options';
import { submitStage1Application } from './actions';

const uploadAccept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default async function Apply({ searchParams }: { searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const params = await searchParams;
  return <PageShell><Section eyebrow="Stage 1" title="Initial application">
    {params.submitted ? <div className="card p-6"><h2 className="text-2xl font-bold">Application received</h2><p className="mt-3">Your Application ID is <strong>{params.submitted}</strong>. Keep it safe; you will need it with your email to track your application.</p></div> : null}
    {params.error ? <p className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">Please check all required fields. Enter a valid phone number for the selected country and upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file up to 5MB.</p> : null}
    <form action={submitStage1Application} className="card grid gap-4 p-6 md:grid-cols-2">
      <label className="field">First Name<input className="input" name="firstName" autoComplete="given-name" required /></label>
      <label className="field">Initial / Middle Initial<input className="input" name="middleInitial" autoComplete="additional-name" maxLength={20} /></label>
      <label className="field">Last Name<input className="input" name="lastName" autoComplete="family-name" required /></label>
      <label className="field">Email<input className="input" name="email" type="email" required /></label>
      <label className="field">Phone country<select className="input" name="phoneCountryIso" required defaultValue="NG">{countryPhoneOptions.map((country)=><option key={country.iso} value={country.iso}>{country.name} {country.dialCode}</option>)}</select></label>
      <label className="field">Phone number<input className="input" name="phoneNational" inputMode="tel" autoComplete="tel-national" pattern="[0-9+() .-]{7,}" title="Enter a valid phone number for the selected country." required /><span className="text-xs text-slate-500">Enter a valid phone number for the selected country.</span></label>
      <label className="field">Location<input className="input" name="location" required /></label>
      <label className="field">Position / Role Applied For<select className="input" name="role" required>{roleAppliedForOptions.map((role)=><option key={role}>{role}</option>)}</select></label>
      <label className="field">If Other, specify role<input className="input" name="otherRole" /></label>
      <label className="field">Work mode preference<select className="input" name="workMode">{workModes.map(m=><option key={m}>{m}</option>)}</select></label>
      <label className="field">Experience level<select className="input" name="experienceLevel" required>{experienceLevelOptions.map((level)=><option key={level}>{level}</option>)}</select></label>
      <label className="field">Skills<input className="input" name="skills" required /></label>
      <label className="field md:col-span-2">CV/resume or supporting document<input className="input" name="cv" type="file" accept={uploadAccept} required /><span className="text-xs text-slate-500">Accepted formats: PDF, DOC, DOCX, JPG, PNG, or WEBP. You can choose a file or select an image from your gallery on mobile.</span></label>
      <label className="field md:col-span-2">Portfolio/GitHub/LinkedIn link<input className="input" name="portfolioUrl" type="url" /></label>
      <label className="field md:col-span-2">Short application message<textarea className="input" name="message" rows={5} required /></label>
      <label className="md:col-span-2 flex gap-2"><input name="privacyConsent" type="checkbox" required /> I consent to Zentric Analytics processing my application data for hiring review.</label>
      <label className="field md:col-span-2">Typed electronic signature<input className="input" name="signatureName" required placeholder="Type your full legal name" /></label>
      <label className="md:col-span-2 flex gap-2"><input name="signatureConsent" type="checkbox" required /> I confirm this typed name is my electronic signature and that the submitted information is accurate.</label>
      <button className="btn btn-primary md:col-span-2" type="submit">Submit Stage 1 Application</button>
    </form></Section></PageShell>;
}
