'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BrainCircuit, ChartNoAxesCombined, CloudCog, Code2, PanelsTopLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './ServicesHero.module.css';

const capabilities = [
  { label: 'Custom Software', Icon: Code2 },
  { label: 'Artificial Intelligence', Icon: BrainCircuit },
  { label: 'Data & Analytics', Icon: ChartNoAxesCombined },
  { label: 'Cloud Solutions', Icon: CloudCog },
  { label: 'Enterprise Platforms', Icon: PanelsTopLeft },
];

function EngineeringWorkspace({ active }: { active: boolean }) {
  return (
    <div className={`${styles.workspace} ${active ? styles.workspaceActive : ''}`} aria-label="Zentric engineering workspace preview">
      <header className={styles.toolbar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandText}>
            <strong className={styles.workspaceWordmark}>Zentric Workspace</strong>
            <span className={styles.online}><i aria-hidden="true" />Online</span>
          </div>
        </div>
        <div className={styles.search} aria-hidden="true">
          <svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
          Search workspace
          <kbd>⌘ K</kbd>
        </div>
      </header>

      <div className={styles.workspaceBody}>
        <div className={styles.primaryGrid}>
          <section className={`${styles.workspaceCard} ${styles.analyticsCard}`} aria-label="Revenue analytics">
            <div className={styles.cardHeading}>
              <div><span>Analytics</span><strong>Revenue trend</strong></div>
              <span className={styles.period}>Last 30 days</span>
            </div>
            <div className={styles.metricRow}>
              <strong>$284.6k</strong>
              <span>↗ 18.4%</span>
            </div>
            <svg className={styles.chart} viewBox="0 0 320 100" role="img" aria-label="Revenue trend increasing over time">
              <defs><linearGradient id="services-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#138c8c" stopOpacity=".18"/><stop offset="1" stopColor="#138c8c" stopOpacity="0"/></linearGradient></defs>
              <path className={styles.chartGrid} d="M0 20H320M0 50H320M0 80H320" />
              <path className={styles.chartArea} d="M0 84C24 77 35 78 55 69S87 55 108 60s32 13 51 2 31-30 50-24 29 17 49 5 37-23 62-27V100H0Z" />
              <path className={styles.chartLine} d="M0 84C24 77 35 78 55 69S87 55 108 60s32 13 51 2 31-30 50-24 29 17 49 5 37-23 62-27" />
              <circle className={styles.chartPoint} cx="320" cy="16" r="4" />
            </svg>
          </section>

          <section className={`${styles.workspaceCard} ${styles.aiCard}`} aria-label="AI assistant">
            <div className={styles.cardHeading}>
              <div><span>AI Assistant</span><strong>Operations copilot</strong></div>
              <span className={styles.aiIcon} aria-hidden="true">✦</span>
            </div>
            <div className={styles.chatMessage}>Summarize this week&apos;s delivery risks.</div>
            <div className={`${styles.chatMessage} ${styles.assistantMessage}`}><i aria-hidden="true">✦</i><span>Two items need review. The data migration is ready for approval.</span></div>
            <div className={styles.connected}><i aria-hidden="true" />Knowledge connected <span>12 sources</span></div>
          </section>
        </div>

        <section className={`${styles.workspaceCard} ${styles.workflowCard}`} aria-label="Deployment workflow">
          <div className={styles.cardHeading}>
            <div><span>Workflow</span><strong>Deployment pipeline</strong></div>
            <span className={styles.deploying}>Deploying</span>
          </div>
          <div className={styles.workflowSteps}>
            {['Build', 'Test', 'Security', 'Deploy'].map((step, index) => <span key={step} className={index < 3 ? styles.stepComplete : ''}><i>{index < 3 ? '✓' : '4'}</i>{step}</span>)}
            <div className={styles.progressTrack}><i /></div>
          </div>
        </section>

        <div className={styles.secondaryGrid}>
          <section className={`${styles.workspaceCard} ${styles.infrastructureCard}`} aria-label="Cloud infrastructure health">
            <div className={styles.cardHeading}><div><span>Infrastructure</span><strong>Cloud health</strong></div><span className={styles.healthy}>All systems healthy</span></div>
            <div className={styles.healthItems}>
              {['API', 'Database', 'Deployments'].map((item, index) => <div key={item}><i style={{ '--delay': `${650 + index * 100}ms` } as React.CSSProperties} /><span>{item}<small>{index === 0 ? '42ms' : index === 1 ? '99.99%' : 'Current'}</small></span></div>)}
            </div>
          </section>

          <section className={`${styles.workspaceCard} ${styles.activityCard}`} aria-label="Recent activity">
            <div className={styles.cardHeading}><div><span>Recent activity</span><strong>Today</strong></div></div>
            <ul>
              {['Deployment Complete', 'Dashboard Updated', 'Workflow Approved'].map((item, index) => <li key={item} style={{ '--delay': `${760 + index * 110}ms` } as React.CSSProperties}><i aria-hidden="true">✓</i><span>{item}<small>{index === 0 ? '2 min ago' : index === 1 ? '18 min ago' : '42 min ago'}</small></span></li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ServicesHero() {
  const heroRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.hero} ref={heroRef} aria-labelledby="services-hero-heading">
      <Image
        className={styles.heroBackground}
        src="/images/services/services-hero-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden="true"
      />
      <div className={styles.heroOverlay} aria-hidden="true" />
      <div className={styles.heroInner}>
        <div className={`${styles.content} ${active ? styles.contentActive : ''}`}>
          <p className={styles.eyebrow}>Services</p>
          <h1 id="services-hero-heading">Custom Software, AI, and Data Solutions Built Around Your Business</h1>
          <p className={styles.description}>We partner with organizations to design, build, and scale secure digital products—from business applications and AI-powered solutions to analytics platforms and cloud infrastructure.</p>
          <div className={styles.actions}>
            <Link className="btn hero-cta-primary" href="/contact">Start a Project <span aria-hidden="true">→</span></Link>
            <a className="btn hero-cta-secondary" href="#technologies-heading">Explore Our Capabilities <span aria-hidden="true">↓</span></a>
          </div>
          <ul className={styles.capabilities} aria-label="Core capabilities">
            {capabilities.map(({ label, Icon }) => (
              <li key={label}>
                <span className={styles.capabilityIcon} aria-hidden="true"><Icon size={19} strokeWidth={1.9} /></span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.visual}>
          <EngineeringWorkspace active={active} />
        </div>
      </div>
    </section>
  );
}
