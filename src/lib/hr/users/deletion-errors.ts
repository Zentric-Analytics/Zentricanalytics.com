const safeDeletionMessages = new Set([
  "The primary administrator cannot delete their own account.",
  "Hard deletion is blocked while the user is linked to an employee record.",
  "Hard deletion is blocked because this user created invitation records that must remain attributable.",
  "Hard deletion is blocked because this account still owns retained HR records. Keep it soft-deleted.",
]);

export function userDeletionErrorMessage(error: unknown) {
  if (error instanceof Error && safeDeletionMessages.has(error.message)) return error.message;
  return "The user deletion could not be completed. Refresh the page and try again.";
}
