import Link from 'next/link';
import { PageShell } from '@/components/PageShell';

const sections = [
  ['Website purpose', 'This website provides general information about Zentric Analytics, its services, and recruitment process. Content is not a binding proposal, warranty, or professional advice. Project scope, responsibilities, fees, and outcomes are established only in a separate written agreement.'],
  ['Acceptable use', 'Do not misuse the website, attempt unauthorized access, interfere with its operation, submit unlawful or harmful material, or use application and tracking features for anyone else without authorization.'],
  ['Content and intellectual property', 'Website copy, branding, visual materials, and software are owned by Zentric Analytics or used with permission. You may view the site for legitimate personal or business evaluation, but may not reproduce or distribute its content as your own.'],
  ['Submissions and availability', 'You are responsible for information you submit and for ensuring you have permission to provide it. We may update, suspend, or correct website content and features. We do not promise uninterrupted availability or that all information will remain current.'],
  ['Third-party services and liability', 'The website may rely on or link to third-party services. Their terms and practices apply separately. To the extent permitted by applicable law, Zentric Analytics is not responsible for indirect loss resulting solely from reliance on general website content or third-party availability.'],
] as const;

export default function TermsPage() {
  return <PageShell><div className="za-container za-section-compact"><header className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Terms</p><h1 className="za-page-heading mt-3 text-ink">Terms for using this website</h1><p className="mt-4 text-sm leading-7 text-slate-700 sm:text-[0.9375rem]">These terms set practical expectations for visitors using the Zentric Analytics website, enquiry forms, and recruitment tools.</p></header><div className="mt-8 max-w-3xl divide-y divide-[#DCE3EA] border-y border-[#DCE3EA]">{sections.map(([title,body])=><section className="py-6" key={title}><h2 className="text-xl font-bold text-ink">{title}</h2><p className="mt-2 text-sm leading-7 text-slate-700 sm:text-[0.9375rem]">{body}</p></section>)}</div><section className="mt-8 max-w-3xl"><h2 className="text-xl font-bold text-ink">Questions about these terms</h2><p className="mt-2 text-sm leading-7 text-slate-700">Contact our team if you need clarification before using information or submitting material through the website.</p><Link className="btn btn-primary mt-5" href="/contact">Contact Us About These Terms</Link></section></div></PageShell>;
}
