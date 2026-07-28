'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FeaturedSolutions.module.css';

type PreviewType = 'analytics' | 'support' | 'workflow' | 'research' | 'cloud';
type Solution = {
  id: string;
  category: string;
  title: string;
  description: string;
  challenge: string;
  build: string;
  impact: string;
  technologies: string[];
  previewType: PreviewType;
};

const solutions: Solution[] = [
  {
    id: 'business-intelligence', category: 'Data & Analytics', title: 'Business Intelligence Platform', previewType: 'analytics',
    description: 'An example of how we can bring fragmented operational data into one secure, decision-ready analytics environment.',
    challenge: 'Teams spend time reconciling disconnected reports, tools, and inconsistent performance metrics.',
    build: 'Custom analytics platforms, reporting systems, data pipelines, KPI dashboards, and decision-support tools.',
    impact: 'Clearer visibility, faster reporting, stronger governance, and more confident business decisions.',
    technologies: ['React', 'Next.js', 'Python', 'PostgreSQL'],
  },
  {
    id: 'ai-customer-support', category: 'Artificial Intelligence', title: 'AI Customer Support Assistant', previewType: 'support',
    description: 'An example of how intelligent automation can improve customer support while keeping human teams in control.',
    challenge: 'Support teams repeatedly handle similar requests while customers wait too long for straightforward answers.',
    build: 'AI assistants, knowledge-search systems, intelligent workflows, recommendation tools, and language-based applications.',
    impact: 'Faster responses, reduced repetitive work, improved service consistency, and better access to organizational knowledge.',
    technologies: ['Next.js', 'Python', 'OpenAI API', 'Vector Database'],
  },
  {
    id: 'workflow-automation', category: 'Custom Software', title: 'Workflow Automation Platform', previewType: 'workflow',
    description: 'An example of a custom business application designed around an organization’s exact processes and approval requirements.',
    challenge: 'Critical processes rely on spreadsheets, email chains, manual handoffs, and disconnected internal tools.',
    build: 'Web applications, mobile applications, customer portals, internal platforms, workflow systems, and enterprise integrations.',
    impact: 'More reliable processes, fewer manual errors, better accountability, and software that fits the organization instead of forcing the organization to fit the software.',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
  },
  {
    id: 'research-analytics', category: 'Research Platforms', title: 'Research Analytics Workspace', previewType: 'research',
    description: 'An example of a secure digital environment for collecting, managing, analyzing, and communicating research data.',
    challenge: 'Research teams often manage participants, datasets, analysis, and reporting across fragmented systems.',
    build: 'Research portals, study-management systems, data-collection tools, survey platforms, analytical workspaces, and reporting applications.',
    impact: 'Stronger data quality, clearer study oversight, easier collaboration, and more efficient research operations.',
    technologies: ['Python', 'Pandas', 'React', 'PostgreSQL'],
  },
  {
    id: 'cloud-operations', category: 'Cloud & Infrastructure', title: 'Cloud Operations Platform', previewType: 'cloud',
    description: 'An example of how we can improve the visibility, reliability, and management of cloud-based systems.',
    challenge: 'Organizations struggle to monitor services, deployments, infrastructure health, reliability, and operational risks across multiple environments.',
    build: 'Cloud architectures, deployment pipelines, monitoring systems, infrastructure automation, backend services, and platform integrations.',
    impact: 'More reliable systems, faster deployments, stronger operational visibility, and infrastructure that can scale with demand.',
    technologies: ['AWS', 'Docker', 'Kubernetes', 'Terraform'],
  },
];

function CountValue({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(value)}</>;
}

function PreviewFrame({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className={styles.previewFrame}>
      <header className={styles.previewHeader}>
        <span className={styles.windowDots} aria-hidden="true"><i /><i /><i /></span>
        <strong>{title}</strong><small>{meta}</small>
      </header>
      {children}
    </div>
  );
}

function AnalyticsPreview() {
  return (
    <PreviewFrame title="Analytics Overview" meta="Updated now">
      <div className={styles.analyticsMetrics}>
        <span>Revenue<strong><CountValue value={248} format={v => `$${Math.round(v)}K`} /></strong></span>
        <span>Active Users<strong><CountValue value={12.4} format={v => `${v.toFixed(1)}K`} /></strong></span>
        <span>Growth<strong className={styles.positive}><CountValue value={18} format={v => `+${Math.round(v)}%`} /></strong></span>
      </div>
      <div className={styles.analyticsBody}>
        <div className={styles.chart}><span>Revenue trend <b>Last 8 weeks</b></span><svg viewBox="0 0 420 116" role="img" aria-label="Revenue trending upward"><defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#138c8c" stopOpacity=".18"/><stop offset="1" stopColor="#138c8c" stopOpacity="0"/></linearGradient></defs><path className={styles.chartArea} d="M5 94 C45 90 60 72 100 76 S160 48 202 58 S260 35 300 40 S360 15 415 22 L415 112 L5 112 Z"/><path className={styles.chartLine} d="M5 94 C45 90 60 72 100 76 S160 48 202 58 S260 35 300 40 S360 15 415 22"/></svg></div>
        <div className={styles.reportList}><span>Recent reports</span>{[['Operations','Complete'],['Finance','Updated'],['Marketing','Processing']].map(([name,status], i) => <div style={{'--delay': `${i * 90 + 200}ms`} as React.CSSProperties} key={name}><i data-status={status}/><b>{name}</b><small>{status}</small></div>)}</div>
      </div>
    </PreviewFrame>
  );
}

function AISupportPreview() {
  return (
    <PreviewFrame title="AI Support Assistant" meta="Conversation #2841">
      <div className={styles.supportBody}>
        <div className={styles.messages}><div className={styles.customerMessage}><small>Customer</small>I need help resetting my password.</div><div className={styles.aiMessage}><small>Zentric assistant</small>I can help. Open your account settings, choose Security, then select “Reset password.” I can connect you with support if you cannot sign in.</div></div>
        <aside className={styles.supportStatus}><div className={styles.connected}><i />Knowledge Base Connected</div><div><i />Escalation Available</div><span>Response quality <strong>High · 94%</strong></span><em><i /></em></aside>
      </div>
    </PreviewFrame>
  );
}

function WorkflowPreview() {
  const stages = ['Submitted', 'Manager Review', 'HR Approval', 'Completed'];
  return (
    <PreviewFrame title="Employee Onboarding" meta="Workflow #108">
      <div className={styles.workflowBody}><div className={styles.workflowPath}>{stages.map((stage, i) => <div className={i < 2 ? styles.stageDone : i === 2 ? styles.stageActive : ''} style={{'--delay': `${i * 110}ms`} as React.CSSProperties} key={stage}><i>{i < 2 ? '✓' : i + 1}</i><span>{stage}</span></div>)}</div><div className={styles.approval}><span><small>Current task</small><strong>Review employment details</strong></span><span><small>Owner</small><strong>People Operations</strong></span><span><small>Due</small><strong>Today</strong></span></div></div>
    </PreviewFrame>
  );
}

function ResearchPreview() {
  return (
    <PreviewFrame title="Study Overview" meta="Cohort 04">
      <div className={styles.researchMetrics}><span>Participants<strong><CountValue value={1248} format={v => Math.round(v).toLocaleString()} /></strong></span><span>Completion<strong><CountValue value={86} format={v => `${Math.round(v)}%`} /></strong></span><span>Data quality<strong><CountValue value={96.4} format={v => `${v.toFixed(1)}%`} /></strong></span></div>
      <div className={styles.researchBody}><div className={styles.barChart}><span>Weekly completions <b>+12 this week</b></span><div>{[42,55,48,72,64,82,74,92].map((height,i) => <i key={i} style={{'--height': `${height}%`, '--delay': `${i * 45}ms`} as React.CSSProperties}/>)}</div></div><div className={styles.cohorts}><span>Dataset summary</span><div><b>Primary cohort</b><em>672</em></div><div><b>Control cohort</b><em>576</em></div><small>18 fields validated</small></div></div>
    </PreviewFrame>
  );
}

function CloudPreview() {
  return (
    <PreviewFrame title="Infrastructure Health" meta="Production">
      <div className={styles.cloudBody}><div className={styles.healthGrid}>{[['API','Healthy'],['Database','Healthy'],['Deployments','Running']].map(([name,status],i) => <span style={{'--delay': `${i * 100}ms`} as React.CSSProperties} key={name}><i/><small>{name}</small><strong>{status}</strong></span>)}<span><small>Latency</small><strong><CountValue value={42} format={v => `${Math.round(v)} ms`} /></strong></span></div><div className={styles.uptime}><span><small>30-day uptime</small><strong><CountValue value={99.98} format={v => `${v.toFixed(2)}%`} /></strong></span><svg viewBox="0 0 330 50" role="img" aria-label="Stable service health"><path d="M3 28 L40 27 L60 29 L82 25 L112 27 L134 13 L145 38 L158 26 L205 27 L230 24 L260 27 L290 22 L327 24"/></svg></div><div className={styles.timeline}><span>Deployment timeline</span><div><i/>API gateway updated <small>8 min ago</small></div><div><i/>Web services verified <small>21 min ago</small></div></div></div>
    </PreviewFrame>
  );
}

function SolutionPreview({ type }: { type: PreviewType }) {
  if (type === 'analytics') return <AnalyticsPreview />;
  if (type === 'support') return <AISupportPreview />;
  if (type === 'workflow') return <WorkflowPreview />;
  if (type === 'research') return <ResearchPreview />;
  return <CloudPreview />;
}

function SolutionNavigation({ active, onSelect, tabRefs }: { active: number; onSelect: (index: number) => void; tabRefs: React.MutableRefObject<(HTMLButtonElement | null)[]> }) {
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const navigationShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    const shell = navigationShellRef.current;
    if (!navigation || !shell) return;

    let frame = 0;
    const updateOverflowIndicators = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const vertical = window.matchMedia('(min-width: 900px)').matches;
        const overflow = vertical && navigation.scrollHeight > navigation.clientHeight + 1;
        shell.dataset.scrollable = String(overflow);
        shell.dataset.atTop = String(!overflow || navigation.scrollTop <= 1);
        shell.dataset.atBottom = String(!overflow || navigation.scrollTop + navigation.clientHeight >= navigation.scrollHeight - 1);
      });
    };

    updateOverflowIndicators();
    navigation.addEventListener('scroll', updateOverflowIndicators, { passive: true });
    window.addEventListener('resize', updateOverflowIndicators, { passive: true });
    const observer = new ResizeObserver(updateOverflowIndicators);
    observer.observe(navigation);
    Array.from(navigation.children).forEach(child => observer.observe(child));

    return () => {
      cancelAnimationFrame(frame);
      navigation.removeEventListener('scroll', updateOverflowIndicators);
      window.removeEventListener('resize', updateOverflowIndicators);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const navigation = navigationRef.current;
    const selected = tabRefs.current[active];
    if (!navigation || !selected) return;

    const vertical = window.matchMedia('(min-width: 900px)').matches;
    const containerRect = navigation.getBoundingClientRect();
    const itemRect = selected.getBoundingClientRect();
    const before = vertical ? itemRect.top < containerRect.top : itemRect.left < containerRect.left;
    const after = vertical ? itemRect.bottom > containerRect.bottom : itemRect.right > containerRect.right;
    if (!before && !after) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    navigation.scrollTo({
      [vertical ? 'top' : 'left']: (vertical ? navigation.scrollTop : navigation.scrollLeft)
        + (before ? (vertical ? itemRect.top - containerRect.top : itemRect.left - containerRect.left) : (vertical ? itemRect.bottom - containerRect.bottom : itemRect.right - containerRect.right)),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [active, tabRefs]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const vertical = window.matchMedia('(min-width: 900px)').matches;
    const previous = vertical ? 'ArrowUp' : 'ArrowLeft';
    const next = vertical ? 'ArrowDown' : 'ArrowRight';
    if (![previous, next, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? solutions.length - 1 : (index + (event.key === next ? 1 : -1) + solutions.length) % solutions.length;
    onSelect(target); tabRefs.current[target]?.focus();
  };
  return <div className={styles.navigationShell} ref={navigationShellRef} data-scrollable="false" data-at-top="true" data-at-bottom="true"><div className={styles.navigation} ref={navigationRef} role="tablist" aria-label="Solution examples" aria-orientation="vertical" style={{'--active-index': active} as React.CSSProperties}><span className={styles.activeIndicator} aria-hidden="true"/>{solutions.map((solution,index) => <button key={solution.id} ref={node => {tabRefs.current[index] = node;}} id={`${solution.id}-tab`} role="tab" aria-controls={`${solution.id}-panel`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} onKeyDown={event => handleKeyDown(event,index)} onClick={() => onSelect(index)}><span>{solution.category}</span></button>)}</div><span className={`${styles.scrollFade} ${styles.scrollFadeTop}`} aria-hidden="true"/><span className={`${styles.scrollFade} ${styles.scrollFadeBottom}`} aria-hidden="true"/></div>;
}

function SolutionWorkspace({ solution }: { solution: Solution }) {
  return (
    <article className={styles.workspace} id={`${solution.id}-panel`} role="tabpanel" aria-labelledby={`${solution.id}-tab`} tabIndex={0}>
      <header className={styles.workspaceIntro}><h3>{solution.title}</h3><p>{solution.description}</p></header>
      <SolutionPreview type={solution.previewType}/>
      <div className={styles.businessSummary}><div><h4>Challenge</h4><p>{solution.challenge}</p></div><div><h4>What We Build</h4><p>{solution.build}</p></div><div><h4>Expected Impact</h4><p>{solution.impact}</p></div></div>
      <div className={styles.technologies} aria-label="Technologies">{solution.technologies.map((technology,index) => <span key={technology}>{technology}{index < solution.technologies.length - 1 && <i aria-hidden="true">·</i>}</span>)}</div>
    </article>
  );
}

export function FeaturedSolutions() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <section className={styles.section} aria-labelledby="featured-solutions-heading">
      <div className={styles.container}>
        <header className={styles.sectionHeader}><h2 id="featured-solutions-heading">Examples of Solutions We Deliver</h2><span>Explore a selection of digital products and platforms we can design and build. These examples illustrate our capabilities, while every solution is tailored to each organization’s unique goals, users, and technical requirements.</span></header>
        <div className={styles.showcase}><SolutionNavigation active={active} onSelect={setActive} tabRefs={tabRefs}/><div className={styles.panel} key={solutions[active].id}><SolutionWorkspace solution={solutions[active]}/></div></div>
        <p className={styles.scopeStatement}>These are representative examples, not a fixed catalogue. Zentric Analytics designs custom solutions across industries, platforms, and business functions.</p>
      </div>
    </section>
  );
}
