'use server';

import { z } from 'zod';

const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.'),
  workEmail: z.string().trim().email('Enter a valid work email.'),
  phoneNumber: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  serviceNeed: z.string().trim().min(1, 'Select what we can help you with.'),
  projectBudget: z.string().trim().min(1, 'Select a project budget.'),
  message: z.string().trim().min(10, 'Tell us a little more about your enquiry.'),
});

export type ContactFormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof contactSchema>, string>>;
};

export async function submitContactEnquiry(_previousState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    fullName: formData.get('fullName'),
    workEmail: formData.get('workEmail'),
    phoneNumber: formData.get('phoneNumber'),
    organization: formData.get('organization'),
    serviceNeed: formData.get('serviceNeed'),
    projectBudget: formData.get('projectBudget'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please review the highlighted fields and try again.',
      fieldErrors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([field, errors]) => [field, errors?.[0] ?? 'This field needs attention.']),
      ),
    };
  }

  // TODO: Connect this validated payload to the production contact backend or CRM before enabling successful submissions.
  void parsed.data;

  return {
    status: 'error',
    message: 'We could not submit your enquiry. Please try again or contact us directly.',
  };
}
