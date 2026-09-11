/** Retry only PostgreSQL serialization/deadlock aborts, never arbitrary failures. */
export async function withOfferAcceptanceRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } } | null;
      const retryable = failure?.code === "P2034" ||
        (failure?.code === "P2010" && ["40001", "40P01"].includes(failure.meta?.code ?? ""));
      if (!retryable || attempt >= 2) throw error;
    }
  }
}
