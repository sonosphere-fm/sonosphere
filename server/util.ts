export const now = () => Math.floor(Date.now() / 1000);
export const digest = (secret: string) => new Bun.CryptoHasher("sha256").update(secret).digest("hex");
export const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const clean = (s: unknown, max = 255) =>
  String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
export const rid = (bytes = 16) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("hex");
/** For a LIKE pattern with ESCAPE '\'. */
export const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
export const first = async <T>(rows: PromiseLike<T[]>): Promise<T | null> => (await rows)[0] ?? null;
