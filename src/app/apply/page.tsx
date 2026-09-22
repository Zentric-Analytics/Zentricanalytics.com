import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { HiringProcess } from './HiringProcess';
import styles from './application.module.css';
import { Stage1ApplicationForm } from './Stage1ApplicationForm';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

export default async function Apply({ searchParams }: { searchParams: Promise<{ submitted?: string; vacancy?: string }> }) {
  const params = await searchParams;
  const vacancy = params.vacancy ? await prisma.hrVacancy.findFirst({
    where: { publicSlug: params.vacancy, status: "OPEN", careersVisible: true },
    select: { publicSlug: true, title: true, vacancyNumber: true, applicationDeadline: true },
  }) : null;

  return (
    <PageShell
      header={
        <header className={styles.masthead}>
          <div className={styles.mastheadInner}>
            <div className={styles.brandArea}>
              <Link href="/" className={styles.wordmark}>Zentric <span>Analytics</span></Link>
              <span className={styles.careersLabel}>Careers</span>
            </div>
            <Link href="/careers" className={styles.back}>← <span>Back to careers</span></Link>
          </div>
        </header>
      }
      footer={
        <footer className={styles.footer}>
          <span>Zentric Analytics</span>
          <span>Candidate application · Initial application</span>
        </footer>
      }
    >
      <div className={styles.page}>
        <div className={styles.workspace}>
          <HiringProcess />
          <div className={styles.formColumn}>
            <header className={styles.intro}>
              <p className={styles.stageLabel}>Stage 1 of 8</p>
              <h1>Initial application</h1>
              <p className={styles.introText}>Share your details, experience and CV. <strong>This submits Stage 1 for review.</strong> You can proceed to Stage 2 after approval.</p>
              {!params.submitted && <p className={styles.requiredNote}><span>*</span> Required fields</p>}
            </header>
            {params.submitted ? (
              <div className={styles.received} role="status">
                <h2 className="break-words text-2xl font-bold">Stage 1 application received</h2>
                <p className="mt-3 break-words">Your Application ID is <strong className="break-all">{params.submitted}</strong>. Keep it safe; you will need it with your email to track your application. Recruitment updates and any next steps will be sent to that email.</p>
              </div>
            ) : <Stage1ApplicationForm vacancy={vacancy} />}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
