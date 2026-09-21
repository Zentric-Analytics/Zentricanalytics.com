'use client';

import { useFormStatus } from 'react-dom';
import type { ComponentProps } from 'react';

export function PortalSubmitButton({ children, disabled, ...props }: ComponentProps<'button'>) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-disabled={disabled || pending} aria-busy={pending}>
    {pending ? 'Submitting...' : children}
  </button>;
}
