export function positionDecisionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Position requester cannot approve or reject their own request.") {
    return "You cannot approve or reject a position request that you created. Ask a different authorized administrator to review it.";
  }
  return "The position decision could not be completed. Refresh the page and try again.";
}
