export type RuntimeEmailPolicy = Readonly<{
 decision: 'ALLOW'|'HOLD'|'CONFIGURATION_BLOCKED'|'INVALID_RECIPIENT'|'SIMULATED';
 reasonCode: string;
}>;
export function evaluateRuntimeEmailPolicy(env: Readonly<Record<string,string|undefined>>, recipient: unknown): RuntimeEmailPolicy;
