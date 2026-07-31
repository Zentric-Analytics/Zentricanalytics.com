const safeDeletionMessages = new Set([
  "The primary administrator cannot delete their own account.",
  "The permanent deletion could not be completed.",
]);

export function userDeletionErrorMessage(error: unknown) {
  if (error instanceof Error && safeDeletionMessages.has(error.message)) return error.message;
  return "The user deletion could not be completed. Refresh the page and try again.";
}
