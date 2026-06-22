type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = getStatusTone(status);

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
      {status}
    </span>
  );
}

function getStatusTone(status: string) {
  if (status.includes('Locked')) {
    return 'bg-slate-100 text-slate-600';
  }

  if (
    status.includes('Approved') ||
    status.includes('Completed') ||
    status.includes('Download')
  ) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status.includes('Correction') || status.includes('Rejected')) {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-blue-50 text-blue-700';
}
