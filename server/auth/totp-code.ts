import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(value >>> bits) & 31];
    }
  }
  return result;
}

function decode(secret: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const letter of secret) {
    const n = ALPHABET.indexOf(letter);
    if (n < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const number = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** digits).padStart(digits, "0");
}

export function totpStep(secret: string, code: unknown, seconds = Date.now() / 1000): number | null {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(seconds / 30);
  for (const offset of [0, -1, 1]) {
    const candidate = step + offset;
    if (candidate < 0) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, candidate)), Buffer.from(code))) return candidate;
  }
  return null;
}

export const recoveryCodes = () => Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));

export function authenticatorUri(secret: string, username: string): string {
  const params = new URLSearchParams({ secret, issuer: "Sonosphere", algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(`Sonosphere:${username}`)}?${params}`;
}
