import { canDownloadDocument, type StageStatus } from '@/lib/hiring';
import { StatusBadge } from './StatusBadge';

type DocumentCardProps = {
  title: string;
  status: StageStatus;
  signed: boolean;
  submittedAt?: string | null;
};

export function DocumentCard({ title, status, signed, submittedAt }: DocumentCardProps) {
  const canDownload = canDownloadDocument(status, signed, submittedAt);
  const badgeStatus = canDownload ? 'Download Available' : status;

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {canDownload
              ? 'Signed copy is available for download.'
              : 'Download is locked until the form is electronically signed and submitted.'}
          </p>
        </div>
        <StatusBadge status={badgeStatus} />
      </div>

      <button className="btn btn-secondary mt-4 disabled:opacity-50" disabled={!canDownload}>
        Download PDF
      </button>
    </article>
  );
}
