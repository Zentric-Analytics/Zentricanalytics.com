export function hrEnvironmentChecks(env: Record<string, string | undefined>): {
  appEnv: string;
  issues: string[];
  emailMode: string;
  workerMode: string;
};

export function runHrPreflight(
  prisma: any,
  env: Record<string, string | undefined>,
  report?: (message: string) => void,
  options?: { allowInitialMfaEnrollment?: boolean },
): Promise<{ ready: boolean; issues: string[] }>;
