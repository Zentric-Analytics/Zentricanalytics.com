export class HrInvitationChangedError extends Error {
  constructor() {
    super("Invitation changed. Reload before requesting another resend.");
    this.name = "HrInvitationChangedError";
  }
}
