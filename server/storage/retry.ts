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

const ATTEMPTS = 4;

export function isTransientS3(e: unknown): boolean {
  const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

export async function retryS3<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      if (attempt >= ATTEMPTS || !isTransientS3(e)) throw e;
      // 250ms, 500ms, 1s: provider-side hiccups often outlast a couple of quick retries
      await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
    }
  }
}

export async function retryS3Delete(op: () => Promise<void>): Promise<void> {
  return retryS3(op);
}
