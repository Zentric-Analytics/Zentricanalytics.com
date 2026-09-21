import type { StageStatus } from "./hiring";

export function isActionableStageStatus(status: StageStatus) {
  return (
    status === "Available" ||
    status === "In Progress" ||
    status === "Correction Requested"
  );
}

export function isReviewStageStatus(status: StageStatus) {
  return status === "Submitted" || status === "Under Review";
}

export function isCompletedStageStatus(status: StageStatus) {
  return status === "Approved" || status === "Completed";
}

export function isRejectedStageStatus(status: StageStatus) {
  return status === "Rejected";
}

export function isComplete(status: StageStatus) {
  return isCompletedStageStatus(status);
}

export function isCandidateActionable(status: StageStatus) {
  return isActionableStageStatus(status);
}

export function isSelectable(status: StageStatus) {
  return [
    "Available",
    "In Progress",
    "Correction Requested",
    "Submitted",
    "Under Review",
    "Approved",
    "Completed",
    "Rejected",
  ].includes(status);
}

export function stageCardActionLabel(status: StageStatus, selected: boolean) {
  if (selected) return "Selected";
  if (isCandidateActionable(status))
    return status === "Available" ? "Open form" : "Continue";
  if (isReviewStageStatus(status)) return "Under review";
  if (isCompletedStageStatus(status)) return "Completed";
  if (isRejectedStageStatus(status)) return "View decision";
  return "Locked";
}

