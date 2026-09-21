// Reserve 1 MiB for multipart headers and non-file fields below Next's 25 MiB limit.
export const CANDIDATE_TOTAL_UPLOAD_BYTES = 24 * 1024 * 1024;
export const CANDIDATE_UPLOAD_MESSAGE = 'Keep the combined size of your uploads at 24 MB or less. Choose smaller files and try again.';

export function candidateUploadsTooLarge(form: FormData) {
  let total = 0;
  for (const value of form.values()) {
    if (typeof value !== 'string') total += value.size;
  }
  return total > CANDIDATE_TOTAL_UPLOAD_BYTES;
}
