'use client';

import { useState } from 'react';

export function Stage1DownloadButton({ session, label = 'Download PDF' }: { session: string; label?: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setMessage('Preparing PDF...');
    try {
      const response = await fetch(`/api/candidate/documents/stage-1?session=${encodeURIComponent(session)}`, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        setMessage('Session expired. Request a new passcode.');
        return;
      }
      if (!response.ok) {
        setMessage('Download failed. Please try again.');
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'stage-1-official.pdf';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('');
    } catch {
      setMessage('Download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <button className="btn btn-primary w-full justify-center sm:w-auto" type="button" onClick={download} disabled={busy}>
        {busy ? 'Preparing...' : label}
      </button>
      {message ? <p className="text-sm text-slate-600" role="status">{message}</p> : null}
    </div>
  );
}
