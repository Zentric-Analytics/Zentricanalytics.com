import { stages } from '@/lib/hiring';
import styles from './application.module.css';

function StageList() {
  return (
    <ol className={styles.journey}>
      {stages.map((stage) => (
        <li key={stage.key} aria-current={stage.order === 1 ? 'step' : undefined}>
          <span className={styles.stageNumber}>{stage.order}</span>
          <span>{stage.title}{stage.order === 1 && <small>You are here</small>}</span>
        </li>
      ))}
    </ol>
  );
}

export function HiringProcess() {
  return (
    <aside className={styles.process} aria-label="Hiring process">
      <div className={styles.desktopProcess}>
        <p className={styles.processLabel}>The hiring process</p>
        <StageList />
        <p className={styles.processNote}><strong>One stage at a time.</strong>Stage 2 becomes available after your initial application is approved. Later stages follow the hiring review process.</p>
      </div>
      <details className={styles.mobileProcess}>
        <summary>The hiring process · {stages.length} stages</summary>
        <StageList />
      </details>
    </aside>
  );
}
