import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Secrets are encrypted so a copied database or backup holds nothing usable. The key file lives next to the
// database, not in it or its backups; losing the key only means listeners have to connect the service again.
let cached: Buffer | null = null;
function key(): Buffer {
  if (cached) return cached;
  // the Spotify name predates the other sealed secrets, so existing deployments keep their key
  const fromEnv = process.env.SPOTIFY_TOKEN_KEY || process.env.TOKEN_KEY;
  if (fromEnv) {
    cached = createHash("sha256").update(fromEnv).digest();
    return cached;
  }
  const file = join(process.env.DATA_DIR || "data", "token.key");
  if (!existsSync(file)) {
    // "wx" fails if another process (the other half of a rolling deploy) wrote it first; then read theirs
    try {
      writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
      chmodSync(file, 0o600);
    } catch {
      // already written by the other process
    }
  }
  cached = Buffer.from(readFileSync(file, "utf8").trim(), "hex");
  return cached;
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Null when it was sealed with a different key or tampered with. */
export function unseal(sealed: string): string | null {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
