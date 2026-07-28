import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms & Conditions | Zentric Analytics', description: 'Terms governing use of the Zentric Analytics website.' };

const sections = [
  { heading: 'Use of This Website', paragraphs: ['You may use this website for lawful informational, enquiry, and employment-application purposes. You must not interfere with its operation, attempt unauthorized access, submit malicious material, or use the website in a manner that violates applicable law.'] },
  { heading: 'Information and Availability', paragraphs: ['Website content is provided for general information and may be changed without notice. We aim to keep the website accurate and available, but do not warrant that all content is complete, current, error-free, or continuously accessible.'] },
  { heading: 'Applications and Enquiries', paragraphs: ['Submitting an employment application does not guarantee an interview, offer, or employment relationship. Submitting a business enquiry does not create a client, advisory, partnership, or other contractual relationship. Any engagement requires a separate written agreement.'] },
  { heading: 'Intellectual Property', paragraphs: ['Unless otherwise stated, website text, design, and original materials are owned by or licensed to Zentric Analytics. You may view and retain reasonable copies for personal or internal business reference, but may not reproduce or distribute materials for commercial use without permission.'] },
  { heading: 'Liability and External Services', paragraphs: ['To the extent permitted by law, Zentric Analytics is not liable for losses arising solely from reliance on general website information, service interruptions, or third-party services outside our control. Nothing in these terms excludes liability that cannot lawfully be excluded.'] },
  { heading: 'Changes and Contact', paragraphs: ['These placeholder terms may be revised as the website and our operations evolve. The revised date will appear at the top of this page. Questions may be submitted through our contact page.'] },
] as const;

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" introduction="These placeholder terms govern access to and use of the Zentric Analytics website. By using the website, you agree to comply with these terms." sections={sections} />;
}
