const TRANSIENT_CODES = new Set([
  "InternalError",
  "ServiceUnavailable",
  "SlowDown",
  "RequestTimeout",
  "RequestTimeoutException",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
]);

/** Deleting an object is idempotent; retry transient failures, preserving the final error. */
export async function retryS3Delete(op: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
      if (attempt >= 3 || typeof code !== "string" || !TRANSIENT_CODES.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 100 * attempt));
    }
  }
}
