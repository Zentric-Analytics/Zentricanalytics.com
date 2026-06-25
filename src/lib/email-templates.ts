export type CandidateEmailTemplate = {
  subject: string;
  body: string;
  html: string;
};

type TemplateInput = {
  applicationId: string;
  candidateName?: string;
  accessCode?: string;
};

type BrandedEmailInput = {
  heading: string;
  preview: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaHref?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function greeting(candidateName?: string) {
  return candidateName ? `Hello ${candidateName},` : 'Hello,';
}

function validHttpUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.protocol === 'http:' && ['production', 'staging', 'preview'].includes(process.env.NODE_ENV ?? process.env.VERCEL_ENV ?? '')) {
      url.protocol = 'https:';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function emailBaseUrl() {
  return validHttpUrl(process.env.APP_BASE_URL) ?? validHttpUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export function buildEmailUrl(path: string, params?: Record<string, string>) {
  const baseUrl = emailBaseUrl();
  if (!baseUrl) return null;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url.toString();
}

function renderBrandedEmail({ heading, preview, paragraphs, ctaLabel = 'Track your application', ctaHref }: BrandedEmailInput) {
  const paragraphHtml = paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join('');
  const ctaHtml = ctaHref ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">${escapeHtml(ctaLabel)}</a></p>` : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
            <tr><td style="background:#0f172a;padding:24px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.2px;">Zentric Analytics</td></tr>
            <tr><td style="padding:32px 28px;">
              <h1 style="margin:0 0 18px;color:#0f172a;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
              ${paragraphHtml}
              ${ctaHtml}
            </td></tr>
            <tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:13px;line-height:1.5;">This message was sent by Zentric Analytics Careers. If you were not expecting this email, you can safely ignore it.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function build(subject: string, heading: string, paragraphs: string[], ctaHref: string | null = buildEmailUrl('/track'), ctaLabel?: string): CandidateEmailTemplate {
  const body = ctaHref ? `${paragraphs.join('\n\n')}\n\n${ctaLabel ?? 'Track your application'}: ${ctaHref}` : paragraphs.join('\n\n');
  return { subject, body, html: renderBrandedEmail({ heading, preview: paragraphs[0] ?? heading, paragraphs, ctaHref, ctaLabel }) };
}

export function accessCodeEmail(input: TemplateInput): CandidateEmailTemplate {
  const code = input.accessCode ?? '';
  const ctaHref = buildEmailUrl('/track/verify', { applicationId: input.applicationId, requested: '1', verified: '0' });
  const paragraphs = [
    `${greeting(input.candidateName)} Use this one-time access code to open your Zentric Analytics application tracker: ${code}`,
    'This code expires in 10 minutes. For your privacy, do not share it with anyone.',
    'If you did not request this code, you can safely ignore this email.',
  ];
  return build('Your Zentric Analytics access code', 'Your secure access code', paragraphs, ctaHref, 'Open verification page');
}

export function applicationReceivedEmail(input: TemplateInput): CandidateEmailTemplate {
  return build(`Application received: ${input.applicationId}`, 'We received your application', [
    `${greeting(input.candidateName)} Thank you for applying to Zentric Analytics.`,
    `Your application ${input.applicationId} has been received and is now in our review queue.`,
    'You can use Track Application to follow future updates when they are available.',
  ]);
}

export function stage2UnlockedEmail(input: TemplateInput) { return build(`Next stage unlocked: ${input.applicationId}`, 'Your next stage is available', [`${greeting(input.candidateName)} Stage 1 has been approved.`, 'Please return to Track Application to complete the next candidate information stage.', 'We appreciate your continued interest in Zentric Analytics.']); }
export function applicationRejectedEmail(input: TemplateInput) { return build(`Application update: ${input.applicationId}`, 'Application update', [`${greeting(input.candidateName)} Thank you for your interest in Zentric Analytics.`, 'After reviewing your application, we are unable to move it forward at this time.', 'We appreciate the time you invested in the process and wish you the best in your search.']); }
export function correctionRequestedEmail(input: TemplateInput) { return build(`Correction requested: ${input.applicationId}`, 'A correction is requested', [`${greeting(input.candidateName)} We need a correction before we can continue reviewing your application.`, 'Please return to Track Application to review the request and submit the updated information.', 'Once submitted, our team will continue the review.']); }
export function stage3UnlockedEmail(input: TemplateInput) { return build(`Next stage unlocked: ${input.applicationId}`, 'Your next stage is available', [`${greeting(input.candidateName)} Stage 2 has been approved.`, 'Please return to Track Application to view your next unlocked stage.', 'Thank you for keeping your application information current.']); }
export function stage2RejectedEmail(input: TemplateInput) { return build(`Application update: ${input.applicationId}`, 'Application update', [`${greeting(input.candidateName)} Thank you for completing the identity review step.`, 'After review, we are unable to move your application forward.', 'We appreciate your time and interest in Zentric Analytics.']); }
export function stage2CorrectionRequestedEmail(input: TemplateInput) { return build(`Stage 2 correction requested: ${input.applicationId}`, 'Stage 2 correction requested', [`${greeting(input.candidateName)} We need an update to your Stage 2 information.`, 'Please return to Track Application to review the request and submit the corrected details.', 'Our team will resume review after your update is received.']); }
export function stage3InstructionsAvailableEmail(input: TemplateInput) { return build(`Stage 3 instructions are available: ${input.applicationId}`, 'Stage 3 instructions are available', [`${greeting(input.candidateName)} Your Stage 3 instructions are ready.`, 'Please return to Track Application to review the details and respond by any listed deadline.', 'If the stage asks for an upload or response, submit it through the portal only.']); }
export function stage4UnlockedEmail(input: TemplateInput) { return build(`Offer stage available: ${input.applicationId}`, 'Offer stage available', [`${greeting(input.candidateName)} Stage 3 has been approved.`, 'The Offer Stage is now available in Track Application.', 'Please sign in to review the next steps when convenient.']); }
export function stage3RejectedEmail(input: TemplateInput) { return build(`Application update: ${input.applicationId}`, 'Application update', [`${greeting(input.candidateName)} Thank you for participating in Stage 3.`, 'After review, we are unable to move your application forward.', 'We appreciate the time and effort you shared with Zentric Analytics.']); }
export function stage3CorrectionRequestedEmail(input: TemplateInput) { return build(`Stage 3 correction requested: ${input.applicationId}`, 'Stage 3 correction requested', [`${greeting(input.candidateName)} We need an update to your Stage 3 response.`, 'Please return to Track Application to review the request and submit the corrected response.', 'Our team will continue review after your update is received.']); }
export function offerReadyEmail(input: TemplateInput) { return build(`Your offer is ready for review: ${input.applicationId}`, 'Your offer is ready for review', [`${greeting(input.candidateName)} Your Zentric Analytics offer is ready.`, 'Please return to Track Application to review the offer details and submit your decision.', 'If an expiry date is listed, please respond before that deadline.']); }
export function offerAcceptedEmail(input: TemplateInput) { return build(`Offer accepted: ${input.applicationId}`, 'Offer acceptance recorded', [`${greeting(input.candidateName)} Your offer acceptance has been recorded.`, 'The employment agreement stage is now available in Track Application.', 'Thank you for confirming your decision.']); }
export function stage5AgreementReleasedEmail(input: TemplateInput) { return build(`Employment agreement ready: ${input.applicationId}`, 'Employment agreement ready for review', [`${greeting(input.candidateName)} Your Employment Agreement + Role Schedule is ready in the secure candidate portal.`, 'Please review the agreement carefully and submit your electronic signature if you agree to continue the employment process.', 'This does not mean onboarding is complete or that final HR approval has been issued.']); }
export function stage5CorrectionRequestedEmail(input: TemplateInput) { return build(`Stage 5 correction requested: ${input.applicationId}`, 'Employment agreement correction requested', [`${greeting(input.candidateName)} We need an update to your Stage 5 employment agreement submission.`, 'Please return to the secure candidate portal to review the request and resubmit Stage 5.', 'Our team will continue review after your update is received.']); }
export function stage5RejectedEmail(input: TemplateInput) { return build(`Application update: ${input.applicationId}`, 'Employment agreement update', [`${greeting(input.candidateName)} Thank you for reviewing the employment agreement.`, 'Stage 5 was not approved, and further action depends on Zentric Analytics LTD.', 'We appreciate the time you invested in the process.']); }
export function stage6UnlockedEmail(input: TemplateInput) { return build(`Onboarding stage available: ${input.applicationId}`, 'Onboarding stage available', [`${greeting(input.candidateName)} Stage 5 has been approved.`, 'The next onboarding stage is now available in Track Application.', 'Employment remains subject to completion of required onboarding, policy acknowledgements, and final HR approval.']); }
