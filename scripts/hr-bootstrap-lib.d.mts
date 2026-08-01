export const HR_PERMISSION_KEYS: string[];
export const HR_ROLE_KEYS: string[];

export function validateBootstrapEnvironment(env: Record<string, string | undefined>): {
  appEnv: string;
  email: string;
  passwordHash: string;
};

export function runHrBootstrap(
  prisma: any,
  env: Record<string, string | undefined>,
  report?: (message: string) => void,
): Promise<{ status: "created" | "already_initialized"; environment: string }>;
