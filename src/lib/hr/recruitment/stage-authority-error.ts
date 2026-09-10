/** Expected authority denial, not a database or authentication failure. */
export class StageAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StageAuthorityError';
  }
}
