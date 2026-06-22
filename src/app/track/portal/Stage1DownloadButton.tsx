'use client';

import { useState } from 'react';

export function Stage1DownloadButton({ session }: { session: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setMessage('Preparing download...');
    try {
      const response = await fetch(`/api/candidate/documents/stage-1?session=${encodeURIComponent(session)}`, { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        setMessage('Your secure session expired. Please request a new one-time passcode.');
        return;
      }
      if (!response.ok) {
        setMessage('Download failed. Please refresh and try again.');
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
      setMessage('Download failed. Please refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button className="btn btn-primary" type="button" onClick={download} disabled={busy}>
        {busy ? 'Preparing download...' : 'Download signed Stage 1 PDF'}
      </button>
      {message ? <p className="text-sm text-slate-600" role="status">{message}</p> : null}
    </div>
  );
}
