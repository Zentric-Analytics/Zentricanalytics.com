export const rightToWorkOptions = ['Yes', 'No', 'N/A'] as const;
export const genderOptions = ['Male', 'Female', 'Prefer not to say'] as const;
export const employmentTypeOptions = ['Full-time', 'Part-time', 'Fixed-term', 'Internship or Trainee', 'Contract or Other'] as const;
export const stage1WorkModeOptions = ['Office-based', 'Remote', 'Hybrid', 'Flexible'] as const;
export const yesNoOptions = ['Yes', 'No'] as const;

export const stage1ApplicantFieldNames = [
  'firstName','middleInitial','lastName','preferredName','residentialAddress','email','phoneCountryIso','phoneNational','stateOfResidence','lgaOfResidence','nationality','rightToWorkNigeria','genderForHr','role','otherRole','experienceLevel','employmentType','workMode','availableStartDate','noticePeriod','salaryExpectation','salaryNegotiable','canWorkMondayFriday','preferredWorkingTime','heardAboutUs','skills','portfolioUrl','portfolioAvailable','certificatesAvailable','certificatesNote','otherDocumentNote','educationHistory','employmentHistory','message','referee1Name','referee1CompanyRole','referee1Relationship','referee1Phone','referee1Email','referee1MayContact','referee2Name','referee2CompanyRole','referee2Relationship','referee2Phone','referee2Email','referee2MayContact','declarationAccuracy','privacyConsent','signatureName','signatureConsent'
] as const;
