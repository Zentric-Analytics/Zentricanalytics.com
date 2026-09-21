'use client';

import { useRef, useState, type ComponentProps } from 'react';
import { candidateUploadsTooLarge, CANDIDATE_UPLOAD_MESSAGE } from '@/lib/candidate-upload-limits';

export function PortalForm({ children, ...props }: ComponentProps<'form'>) {
  const [error, setError] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  return <form {...props} onSubmit={event => {
    if (candidateUploadsTooLarge(new FormData(event.currentTarget))) {
      event.preventDefault();
      setError(CANDIDATE_UPLOAD_MESSAGE);
      requestAnimationFrame(() => feedback.current?.focus());
    } else setError('');
  }}>
    {error && <p ref={feedback} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    {children}
  </form>;
}
