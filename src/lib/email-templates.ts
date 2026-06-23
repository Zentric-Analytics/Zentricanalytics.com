export type BrandedEmail = { subject: string; body: string; html: string };

type TemplateInput = {
  applicationId?: string;
  applicantName?: string;
  portalUrl?: string;
  code?: string;
  role?: string;
};

const brand = 'Zentric Analytics LTD';
const defaultPortalUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/track` : 'https://staging.zentricanalytics.com/track';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function greeting(name?: string) {
  return name ? `Hello ${name},` : 'Hello,';
}

function renderEmail({ title, intro, details = [], nextStep, portalUrl, buttonLabel = 'Open application portal' }: { title: string; intro: string; details?: string[]; nextStep?: string; portalUrl?: string; buttonLabel?: string }) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const detailHtml = details.length ? `<div style="margin:22px 0;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;">${details.map((item) => `<p style="margin:0 0 8px;">${escapeHtml(item)}</p>`).join('').replace(/<p style="margin:0 0 8px;">([^<]+)<\/p>$/, '<p style="margin:0;">$1</p>')}</div>` : '';
  const nextStepHtml = nextStep ? `<p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;"><strong>Next step:</strong> ${escapeHtml(nextStep)}</p>` : '';
  const buttonHtml = portalUrl ? `<p style="margin:26px 0 6px;"><a href="${escapeHtml(portalUrl)}" style="display:inline-block;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:700;font-size:14px;">${escapeHtml(buttonLabel)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;"><div style="display:none;max-height:0;overflow:hidden;">${safeTitle}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;margin:0;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;"><tr><td style="background:#0f172a;color:#ffffff;padding:22px 26px;font-weight:800;font-size:18px;letter-spacing:.2px;">${brand}</td></tr><tr><td style="padding:30px 26px;"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">${safeTitle}</h1><p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${safeIntro}</p>${detailHtml}${nextStepHtml}${buttonHtml}</td></tr><tr><td style="padding:18px 26px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">${brand}<br />This message was sent about your hiring application. If you did not request this, you can ignore it.</td></tr></table></td></tr></table></body></html>`;
}

function make(subject: string, lines: string[], options: { title?: string; details?: string[]; nextStep?: string; portalUrl?: string; buttonLabel?: string } = {}): BrandedEmail {
  const body = lines.filter(Boolean).join('\n\n');
  return { subject, body, html: renderEmail({ title: options.title ?? subject, intro: lines.join(' '), details: options.details, nextStep: options.nextStep, portalUrl: options.portalUrl, buttonLabel: options.buttonLabel }) };
}

function idDetail(applicationId?: string) { return applicationId ? [`Application ID: ${applicationId}`] : []; }
function portal(input: TemplateInput) { return input.portalUrl ?? defaultPortalUrl; }

export const candidateEmailTemplates = {
  applicationReceived: (input: TemplateInput) => make(`Application received: ${input.applicationId}`, [greeting(input.applicantName), `Thank you for applying to Zentric Analytics. We have received your application and our hiring team will review it carefully.`], { title: 'Your application has been received', details: idDetail(input.applicationId), nextStep: 'Use the application portal when you want to check your progress or continue any unlocked stage.', portalUrl: portal(input) }),
  accessCode: (input: TemplateInput & { code: string }) => make('Your Zentric Analytics access code', ['Use the one-time code below to continue to your secure application portal.', `Access code: ${input.code}`, 'This code expires in 10 minutes. If you did not request it, you can ignore this email.'], { title: 'Your secure access code', details: [`One-time code: ${input.code}`, 'Expires in 10 minutes'], nextStep: 'Return to the portal and enter this code to continue.', portalUrl: portal(input), buttonLabel: 'Return to portal' }),
  stage2Unlocked: (input: TemplateInput) => make(`Next stage unlocked: ${input.applicationId}`, [greeting(input.applicantName), 'Your Stage 1 application review is approved. Stage 2 is now available in your application portal.'], { title: 'Stage 2 is now available', details: idDetail(input.applicationId), nextStep: 'Sign in to the portal and complete the Stage 2 identity information request.', portalUrl: portal(input) }),
  stage1CorrectionRequested: (input: TemplateInput) => make(`Correction requested: ${input.applicationId}`, [greeting(input.applicantName), 'We need a correction before we can continue reviewing your Stage 1 application. The request is available in your portal.'], { title: 'Stage 1 correction requested', details: idDetail(input.applicationId), nextStep: 'Review the requested update and resubmit your information in the portal.', portalUrl: portal(input) }),
  applicationRejected: (input: TemplateInput) => make(`Application update: ${input.applicationId}`, [greeting(input.applicantName), 'Thank you for your interest in Zentric Analytics. After reviewing your Stage 1 application, we are not able to move it forward at this time.'], { title: 'Application update', details: idDetail(input.applicationId) }),
  stage3Unlocked: (input: TemplateInput) => make(`Next stage unlocked: ${input.applicationId}`, [greeting(input.applicantName), 'Your Stage 2 review is approved. Stage 3 is now available in your application portal.'], { title: 'Stage 3 is now available', details: idDetail(input.applicationId), nextStep: 'Open the portal to review the next stage and any instructions from our team.', portalUrl: portal(input) }),
  stage2CorrectionRequested: (input: TemplateInput) => make(`Stage 2 correction requested: ${input.applicationId}`, [greeting(input.applicantName), 'We need a correction to your Stage 2 submission before review can continue.'], { title: 'Stage 2 correction requested', details: idDetail(input.applicationId), nextStep: 'Please review the request in the portal and upload or update the requested information.', portalUrl: portal(input) }),
  stage2Rejected: (input: TemplateInput) => make(`Application update: ${input.applicationId}`, [greeting(input.applicantName), 'After reviewing your Stage 2 submission, we are not able to move your application forward at this time.'], { title: 'Stage 2 application update', details: idDetail(input.applicationId) }),
  stage3InstructionsAvailable: (input: TemplateInput) => make(`Stage 3 instructions are available: ${input.applicationId}`, [greeting(input.applicantName), 'The instructions for Stage 3 are now available in your application portal.'], { title: 'Stage 3 instructions are ready', details: idDetail(input.applicationId), nextStep: 'Review the instructions carefully and submit your response through the portal.', portalUrl: portal(input) }),
  stage4Unlocked: (input: TemplateInput) => make(`Offer stage available: ${input.applicationId}`, [greeting(input.applicantName), 'Your Stage 3 review is approved. The offer stage is now available in your application portal.'], { title: 'Offer stage is now available', details: idDetail(input.applicationId), nextStep: 'Open the portal to review the offer stage when you are ready.', portalUrl: portal(input) }),
  stage3CorrectionRequested: (input: TemplateInput) => make(`Stage 3 correction requested: ${input.applicationId}`, [greeting(input.applicantName), 'We need a correction to your Stage 3 response before review can continue.'], { title: 'Stage 3 correction requested', details: idDetail(input.applicationId), nextStep: 'Please review the request and submit the requested update in the portal.', portalUrl: portal(input) }),
  stage3Rejected: (input: TemplateInput) => make(`Application update: ${input.applicationId}`, [greeting(input.applicantName), 'After reviewing your Stage 3 response, we are not able to move your application forward at this time.'], { title: 'Stage 3 application update', details: idDetail(input.applicationId) }),
  offerReady: (input: TemplateInput) => make(`Your offer is ready for review: ${input.applicationId}`, [greeting(input.applicantName), 'Your offer is ready to review in the application portal.'], { title: 'Your offer is ready', details: idDetail(input.applicationId), nextStep: 'Open the portal to review the offer details and record your decision.', portalUrl: portal(input), buttonLabel: 'Review offer' }),
  offerAccepted: (input: TemplateInput) => make(`Offer accepted: ${input.applicationId}`, [greeting(input.applicantName), 'Your offer acceptance has been recorded. The employment agreement stage is now available in your portal.'], { title: 'Offer acceptance recorded', details: idDetail(input.applicationId), nextStep: 'Return to the portal to continue with the employment agreement stage.', portalUrl: portal(input) }),
};
