'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './FeaturedSolutions.module.css';

type PreviewType = 'analytics' | 'support' | 'workflow' | 'research' | 'cloud';
type Solution = {
  id: string;
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
    id: 'business-intelligence', title: 'Business Intelligence', previewType: 'analytics',
    description: 'Turn fragmented operational data into a trusted, decision-ready view of business performance.',
    challenge: 'Teams lose time reconciling disconnected reports and inconsistent metrics.',
    build: 'A secure analytics workspace that unifies data, reporting, and KPI monitoring.',
    impact: 'Clearer decisions, less manual reporting, and stronger operational visibility.',
    technologies: ['React', 'Next.js', 'Python', 'PostgreSQL'],
  },
  {
    id: 'ai-customer-support', title: 'AI Customer Support', previewType: 'support',
    description: 'Give customers useful, grounded answers while keeping human support close at hand.',
    challenge: 'Repeated requests and scattered knowledge slow response teams and create inconsistency.',
    build: 'A governed support assistant connected to approved knowledge and escalation workflows.',
    impact: 'Quicker routine support and more time for teams to handle nuanced requests.',
    technologies: ['Next.js', 'Python', 'OpenAI API', 'Vector Database'],
  },
  {
    id: 'workflow-automation', title: 'Workflow Automation', previewType: 'workflow',
    description: 'Replace manual handoffs with clear, trackable workflows built around how your teams operate.',
    challenge: 'Email approvals and spreadsheet tracking make ownership and progress difficult to see.',
    build: 'A tailored workflow system for routing, approvals, tasks, and status communication.',
    impact: 'More consistent processes, fewer missed handoffs, and clearer accountability.',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
  },
  {
    id: 'research-analytics', title: 'Research Analytics', previewType: 'research',
    description: 'Bring study data, quality checks, and analysis together in a focused research environment.',
    challenge: 'Complex datasets and manual validation make research analysis difficult to maintain.',
    build: 'A structured platform for collection, quality control, analysis, and reporting.',
    impact: 'More reliable datasets, repeatable analysis, and easier collaboration across teams.',
    technologies: ['Python', 'Pandas', 'React', 'PostgreSQL'],
  },
  {
    id: 'cloud-operations', title: 'Cloud Operations', previewType: 'cloud',
    description: 'Monitor infrastructure, services, and deployments through one calm operational view.',
    challenge: 'Infrastructure signals spread across tools make issues and deployments harder to follow.',
    build: 'A unified operations workspace for health, delivery activity, and service visibility.',
    impact: 'Faster investigation, clearer system ownership, and more dependable release operations.',
    technologies: ['AWS', 'Docker', 'Kubernetes', 'Terraform'],
  },
];

function CountValue({ value, format }: { value: number; format: (value: number) => string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [current, setCurrent] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) { setCurrent(value); return; }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 650, 1);
      setCurrent(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return <>{format(current)}</>;
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
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const vertical = window.matchMedia('(min-width: 900px)').matches;
    const previous = vertical ? 'ArrowUp' : 'ArrowLeft';
    const next = vertical ? 'ArrowDown' : 'ArrowRight';
    if (![previous, next, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? solutions.length - 1 : (index + (event.key === next ? 1 : -1) + solutions.length) % solutions.length;
    onSelect(target); tabRefs.current[target]?.focus();
  };
  return <div className={styles.navigation} role="tablist" aria-label="Featured solutions" aria-orientation="vertical" style={{'--active-index': active} as React.CSSProperties}><span className={styles.activeIndicator} aria-hidden="true"/>{solutions.map((solution,index) => <button key={solution.id} ref={node => {tabRefs.current[index] = node;}} id={`${solution.id}-tab`} role="tab" aria-controls={`${solution.id}-panel`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} onKeyDown={event => handleKeyDown(event,index)} onClick={() => onSelect(index)}><span>{solution.title}</span><small>0{index + 1}</small></button>)}</div>;
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
        <header className={styles.sectionHeader}><p>FEATURED SOLUTIONS</p><h2 id="featured-solutions-heading">Explore What We Can Build</h2><span>See how Zentric Analytics transforms complex business requirements into practical, scalable digital solutions.</span></header>
        <div className={styles.showcase}><SolutionNavigation active={active} onSelect={setActive} tabRefs={tabRefs}/><div className={styles.panel} key={solutions[active].id}><SolutionWorkspace solution={solutions[active]}/></div></div>
      </div>
    </section>
  );
}
