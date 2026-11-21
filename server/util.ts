// Small helpers with no dependencies, used across the server.
export const now = () => Math.floor(Date.now() / 1000);
/** SHA-256 of a secret, in hex: what the database keeps of sign-in tokens, so a copy of it cannot be used to sign in. */
export const digest = (secret: string) => new Bun.CryptoHasher("sha256").update(secret).digest("hex");
/** The form names are compared in: case, spacing and Unicode variants folded away. */
export const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
/** Tidies free text from a request: any value becomes a trimmed, single-spaced string of at most `max` characters. */
export const clean = (s: unknown, max = 255) => String(s ?? "").normalize("NFC").trim().replace(/\s+/g, " ").slice(0, max);
/** A random hex token. */
export const rid = (bytes = 16) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("hex");
/** Escapes a search term for use inside a LIKE pattern (with ESCAPE '\'). */
export const like = (s: string) => `%${s.replace(/[\\%_]/g, m => "\\" + m)}%`;
/** The first row of a query, or null when it matched nothing. */
export const first = async <T>(rows: PromiseLike<T[]>): Promise<T | null> => (await rows)[0] ?? null;
