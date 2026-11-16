type TestBody = () => unknown | Promise<unknown>;
export const describe: (name: string, body: TestBody) => unknown;
export const it: (name: string, body: TestBody) => unknown;
