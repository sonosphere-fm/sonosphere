// Encrypts Spotify tokens before they reach the database (AES-256-GCM), so a copied database or backup holds
// nothing usable. The key comes from SPOTIFY_TOKEN_KEY, or else a random key file kept next to the database
// (not inside it, and not in backups). Losing the key only means listeners have to reconnect Spotify.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let cached: Buffer | null = null;
function key(): Buffer {
  if (cached) return cached;
  const fromEnv = process.env.SPOTIFY_TOKEN_KEY;
  if (fromEnv) return (cached = createHash("sha256").update(fromEnv).digest());
  const file = join(process.env.DATA_DIR || "data", "token.key");
  if (!existsSync(file)) {
    // "wx" fails if another process (the other half of a rolling deploy) wrote it first; then read theirs
    try { writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); chmodSync(file, 0o600); } catch { /* already there */ }
  }
  return (cached = Buffer.from(readFileSync(file, "utf8").trim(), "hex"));
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The token, or null when it was sealed with a different key or tampered with. */
export function unseal(sealed: string): string | null {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch { return null; }
}
