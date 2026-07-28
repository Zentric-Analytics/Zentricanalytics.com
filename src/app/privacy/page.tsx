import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy | Zentric Analytics', description: 'How Zentric Analytics handles information submitted through this website.' };

const sections = [
  { heading: 'Information We Collect', paragraphs: ['We may collect information you provide through enquiry, application, and application-tracking forms, including contact details, professional information, uploaded documents, and the contents of your message. We may also receive limited technical information needed to operate, secure, and diagnose the website.'] },
  { heading: 'How We Use Information', paragraphs: ['We use submitted information to respond to enquiries, assess employment applications, administer candidate workflows, provide requested services, maintain website security, and meet applicable legal obligations. We do not use application information for unrelated marketing.'] },
  { heading: 'Sharing and Retention', paragraphs: ['Information may be shared with service providers that support hosting, email delivery, storage, and website operations, subject to appropriate safeguards. We retain information only for as long as reasonably necessary for the purpose for which it was collected or as required by law.'] },
  { heading: 'Security and Your Choices', paragraphs: ['We use reasonable administrative and technical safeguards designed to protect submitted information. No internet transmission or storage system is completely secure. You may contact us through the website contact form to ask about access, correction, or deletion rights that may apply in your jurisdiction.'] },
  { heading: 'Updates and Contact', paragraphs: ['This policy may be updated when our practices or legal obligations change. The revised date will appear at the top of this page. Questions about this placeholder policy may be submitted through our contact page.'] },
] as const;

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" introduction="This placeholder privacy policy describes, at a high level, how Zentric Analytics may collect, use, retain, and protect information received through this website." sections={sections} />;
}
