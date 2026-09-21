const errors: Record<string, string> = {
  offer_changed: 'The offer has changed. Reload and review the current offer when available before submitting your decision. No decision was saved.',
  offer_expired: 'This offer has expired. Contact the hiring team for an updated offer.',
  stage3_response_required: 'Enter your availability or confirmation before submitting.',
  stage3_upload_required: 'Choose a valid assessment file before submitting.',
  uploads_too_large: 'Keep the combined size of your uploads at 24 MB or less. Choose smaller files and try again.',
  replacement_file_invalid: 'Choose a supported document of 20 MB or less.',
};
const successes: Record<string, string> = {
  stage2_submitted: 'Your candidate information has been submitted for review.',
  stage3_submitted: 'Your screening response has been submitted for review.',
  stage5_submitted: 'Your signed agreement has been submitted for review.',
  stage6_submitted: 'Your onboarding information has been submitted for review.',
  stage7_submitted: 'Your acknowledgements have been submitted for review.',
  offer_accepted: 'Your offer acceptance has been recorded.',
  offer_declined: 'Your offer decision has been recorded.',
  replacement_submitted: 'Your replacement document has been submitted for review.',
};
export function portalErrorMessage(code: string) {
  if (errors[code]) return errors[code];
  if (code.endsWith('_validation')) return 'We could not submit this form. Check the required fields and uploaded files, then try again.';
  if (/_locked$|_not_open$|_not_released$|_required$/.test(code)) return 'This step is not currently open for submission. Review your application status or contact the hiring team.';
  return 'We could not complete your submission. Review the current status before trying again. If the problem continues, contact the hiring team.';
}
export function PortalFeedback({ error, success }: { error?: string; success?: string }) {
  const message = error ? portalErrorMessage(error) : success ? successes[success] : undefined;
  if (!message) return null;
  return <p role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{message}</p>;
}
