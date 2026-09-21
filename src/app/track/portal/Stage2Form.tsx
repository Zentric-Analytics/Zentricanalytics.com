import { submitStage2 } from '../actions';
import { stage2IdTypeOptions } from '@/lib/hiring';
import { countryPhoneOptions } from '@/lib/phone';
import { PortalForm } from './PortalForm';
import { Stage2SubmitButton } from './Stage2SubmitButton';

export function Stage2Form({ email }: { email: string }) {
  return (
<PortalForm
  action={submitStage2}
  className="mt-6 space-y-5 rounded-2xl border border-slate-200 p-4 sm:p-5"
>

  <h3 className="text-lg font-bold text-ink">
    Candidate Information / Identity Verification
  </h3>
  <div className="grid gap-4 md:grid-cols-2">
    <label className="block text-sm font-semibold">
      Full legal name
      <input
        className="input mt-1"
        name="fullLegalName"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      Date of birth
      <input
        className="input mt-1"
        name="dateOfBirth"
        type="date"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      Gender
      <select className="input mt-1" name="gender" required>
        <option value="">Select</option>
        <option>Male</option>
        <option>Female</option>
        <option>Prefer not to say</option>
      </select>
    </label>
    <label className="block text-sm font-semibold">
      Nationality
      <input
        className="input mt-1"
        name="nationality"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      State of origin
      <input
        className="input mt-1"
        name="stateOfOrigin"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      State of residence
      <input
        className="input mt-1"
        name="stateOfResidence"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      LGA
      <input className="input mt-1" name="lga" required />
    </label>
    <label className="block text-sm font-semibold">
      Current city/location
      <input
        className="input mt-1"
        name="currentCity"
        required
      />
    </label>
    <label className="block text-sm font-semibold md:col-span-2">
      Residential address
      <textarea
        className="input mt-1 min-h-24"
        name="residentialAddress"
        required
      />
    </label>
    <div className="block text-sm font-semibold md:col-span-2">
      <span>Applicant phone</span>
      <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <select
          className="input"
          name="applicantPhoneCountryIso"
          aria-label="Applicant phone country"
          required
          defaultValue="NG"
        >
          {countryPhoneOptions.map((country) => (
            <option key={country.iso} value={country.iso}>
              {country.name} {country.dialCode}
            </option>
          ))}
        </select>
        <input
          className="input"
          name="applicantPhoneNational"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Applicant national phone number"
          required
        />
      </div>
    </div>
    <label className="block text-sm font-semibold">
      Email
      <input
        className="input mt-1"
        name="email"
        type="email"
        required
        defaultValue={email}
      />
    </label>
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
      <div className="mb-4">
        <h4 className="font-bold text-ink">
          Primary ID{" "}
          <span className="text-red-600">required</span>
        </h4>
        <p className="mt-1 text-sm font-normal text-slate-600">
          Maximum 20 MB per file and 24 MB combined. Only your Primary ID is required. Add a Secondary ID
          only if you choose to provide one.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">
          Primary ID type
          <select
            className="input mt-1"
            name="primaryIdType"
            required
          >
            <option value="">Select</option>
            {stage2IdTypeOptions.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Primary ID number
          <input
            className="input mt-1"
            name="primaryIdNumber"
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Issuing authority
          <input
            className="input mt-1"
            name="primaryIdIssuingAuthority"
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Issue date{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="primaryIdIssueDate"
            type="date"
          />
        </label>
        <label className="block text-sm font-semibold">
          Expiry date{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="primaryIdExpiryDate"
            type="date"
          />
        </label>
        <label className="block text-sm font-semibold">
          Primary ID document upload
          <input
            className="input mt-1"
            name="primaryIdDocument"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            required
          />
        </label>
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
      <h4 className="font-bold text-ink">
        Secondary ID{" "}
        <span className="font-normal text-slate-500">
          optional
        </span>
      </h4>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">
          Secondary ID type{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <select className="input mt-1" name="secondaryIdType">
            <option value="">Not provided</option>
            {stage2IdTypeOptions.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Secondary ID number{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="secondaryIdNumber"
          />
        </label>
        <label className="block text-sm font-semibold">
          Secondary issuing authority{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="secondaryIdIssuingAuthority"
          />
        </label>
        <label className="block text-sm font-semibold">
          Secondary issue date{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="secondaryIdIssueDate"
            type="date"
          />
        </label>
        <label className="block text-sm font-semibold">
          Secondary expiry date{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="secondaryIdExpiryDate"
            type="date"
          />
        </label>
        <label className="block text-sm font-semibold">
          Secondary ID document upload{" "}
          <span className="font-normal text-slate-500">
            optional
          </span>
          <input
            className="input mt-1"
            name="secondaryIdDocument"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
          />
        </label>
      </div>
    </section>
    <label className="block text-sm font-semibold md:col-span-2">
      Passport/profile photo, optional
      <input
        className="input mt-1"
        name="passportPhoto"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
      />
    </label>
    <label className="block text-sm font-semibold">
      Emergency contact name
      <input
        className="input mt-1"
        name="emergencyContactName"
        required
      />
    </label>
    <label className="block text-sm font-semibold">
      Emergency contact relationship
      <input
        className="input mt-1"
        name="emergencyContactRelationship"
        required
      />
    </label>
    <div className="block text-sm font-semibold md:col-span-2">
      <span>Emergency contact phone</span>
      <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <select
          className="input"
          name="emergencyContactPhoneCountryIso"
          aria-label="Emergency contact phone country"
          required
          defaultValue="NG"
        >
          {countryPhoneOptions.map((country) => (
            <option key={country.iso} value={country.iso}>
              {country.name} {country.dialCode}
            </option>
          ))}
        </select>
        <input
          className="input"
          name="emergencyContactPhoneNational"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Emergency contact national phone number"
          required
        />
      </div>
    </div>
    <label className="block text-sm font-semibold">
      Emergency contact address
      <input
        className="input mt-1"
        name="emergencyContactAddress"
      />
    </label>
  </div>
  <label className="flex gap-2 text-sm font-semibold">
    <input
      name="declarationAccuracy"
      type="checkbox"
      required
    />{" "}
    I declare the information provided is accurate.
  </label>
  <label className="flex gap-2 text-sm font-semibold">
    <input
      name="identityProcessingConsent"
      type="checkbox"
      required
    />{" "}
    I consent to identity verification processing.
  </label>
  <label className="block text-sm font-semibold">
    Typed electronic signature
    <input
      className="input mt-1"
      name="signatureName"
      required
    />
  </label>
  <label className="flex gap-2 text-sm font-semibold">
    <input name="signatureConsent" type="checkbox" required /> I
    confirm this electronic signature.
  </label>
  <Stage2SubmitButton />
</PortalForm>
  );
}
