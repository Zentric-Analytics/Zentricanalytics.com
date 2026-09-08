'use server';
import { prisma } from '@/lib/prisma';
import { submitCandidateAssessmentResponse } from '@/lib/hr/recruitment/candidate-assessments';
import { revalidatePath } from 'next/cache';

export async function submitAssessmentResponse(_previous: { error?: string; success?: boolean }, form: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    await prisma.$transaction(tx => submitCandidateAssessmentResponse(tx, Object.fromEntries(form)), { isolationLevel: 'Serializable' });
    revalidatePath('/track/portal');
    return { success: true };
  } catch (error) {
    // Do not expose database errors or payloads to the applicant.
    const message = error instanceof Error ? error.message : '';
    const safe = ['Your session has expired.', 'This assessment', 'The assessment', 'Your response'];
    return { error: safe.some(prefix => message.startsWith(prefix)) ? message : 'Unable to submit. Reload the page and check your response before trying again.' };
  }
}
