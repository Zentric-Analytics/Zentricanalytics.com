export const sourceRecovery: Readonly<{
  authoritativeCommit: string; originalArtifactPath: string; payloadPath: string;
  authoritativeGitBlobSha256: string; authoritativeGitBlobId: string;
  authoritativeGitBlobSize: number; recoveredSealedSha256: string;
  recoveredSealedSize: number; lineEndingTransformation: string;
  transformedLineEndingCount: number; recoveryStatus: string;
}>;
export function reconstructSourceRegister(raw: Buffer): Buffer;
export function recoverSourceRegister(root: string): Buffer;
