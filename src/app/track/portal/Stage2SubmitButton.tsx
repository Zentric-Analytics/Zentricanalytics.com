'use client';

import { useFormStatus } from 'react-dom';

export function Stage2SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary w-full sm:w-auto" disabled={pending} type="submit">
      {pending ? 'Submitting...' : 'Submit Stage 2'}
    </button>
  );
}
