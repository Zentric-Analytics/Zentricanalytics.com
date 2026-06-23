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

function renderBrandedEmail({ heading, preview, paragraphs, ctaLabel = 'Track your application', ctaHref = '/track' }: { heading: string; preview: string; paragraphs: string[]; ctaLabel?: string; ctaHref?: string }) {
  const paragraphHtml = paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join('');
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
              <p style="margin:24px 0 0;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">${escapeHtml(ctaLabel)}</a></p>
            </td></tr>
            <tr><td style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:13px;line-height:1.5;">This message was sent by Zentric Analytics Careers. If you were not expecting this email, you can safely ignore it.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function build(subject: string, heading: string, paragraphs: string[], ctaHref = '/track'): CandidateEmailTemplate {
  return { subject, body: paragraphs.join('\n\n'), html: renderBrandedEmail({ heading, preview: paragraphs[0] ?? heading, paragraphs, ctaHref }) };
}

export function accessCodeEmail(input: TemplateInput): CandidateEmailTemplate {
  const code = input.accessCode ?? '';
  const paragraphs = [
    `${greeting(input.candidateName)} Use this one-time access code to open your Zentric Analytics application tracker: ${code}`,
    'This code expires in 10 minutes. For your privacy, do not share it with anyone.',
    'If you did not request this code, you can safely ignore this email.',
  ];
  return build('Your Zentric Analytics access code', 'Your secure access code', paragraphs);
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
