import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { asc, eq, lte } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "../db/client";
import { outbox } from "../db/schema";
import { bump, exclusive } from "../kv";
import { now } from "../util";

const env = process.env;
export const SITE_URL = (env.SITE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, "");
const FROM = env.MAIL_FROM || "Sonosphere <no-reply@localhost>";
const DAILY = Number(env.MAIL_DAILY_LIMIT) > 0 ? Math.floor(Number(env.MAIL_DAILY_LIMIT)) : null;

function smtpConfig() {
  if (env.SMTP_URL) return { url: env.SMTP_URL };
  if (!env.SMTP_HOST) return null;
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === "true" || env.SMTP_PORT === "465",
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || "" } : undefined,
  };
}

const smtp = smtpConfig();
const transport = smtp
  ? nodemailer.createTransport({
    ...smtp,
    // the EHLO name; otherwise it would be this machine's host name
    name: new URL(SITE_URL).hostname,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
const DEV_DIR = join(env.DATA_DIR || "data", "mail");

export type Mail = { to: string; subject: string; text: string; html: string };

export async function send(m: Mail): Promise<void> {
  await db.insert(outbox).values({ ...m, nextAt: now(), createdAt: now() });
  queueMicrotask(() => {
    deliver().catch(e => console.error("mail:", e));
  });
}

// seconds between tries; after the last one the message is dropped
const RETRY = [60, 300, 900, 3600, 3 * 3600, 6 * 3600, 12 * 3600];
const day = () => new Date().toISOString().slice(0, 10);

// Composed here rather than by nodemailer, whose composer stamps X-Mailer, its name in part boundaries and its own Message-ID style.
const DOMAIN = (/@([^>\s]+)>?\s*$/.exec(FROM)?.[1] || new URL(SITE_URL).hostname).toLowerCase();
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
const word = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const addressOf = (s: string) => /<([^>]+)>/.exec(s)?.[1] ?? s.trim();
const named = (s: string) => {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  return m && m[1] ? `${word(m[1])} <${m[2]}>` : s.trim();
};

function compose(m: Mail): string {
  const boundary = hex(14);
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=utf-8`, "Content-Transfer-Encoding: base64", "", b64(body)].join("\r\n");
  return [
    `From: ${named(FROM)}`,
    `To: ${m.to}`,
    `Subject: ${word(m.subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${hex(16)}@${DOMAIN}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    part("text/plain", m.text),
    part("text/html", m.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function sendOne(m: Mail): Promise<void> {
  const info = await transport.sendMail({ envelope: { from: addressOf(FROM), to: [m.to] }, raw: compose(m) });
  if (smtp) return;
  await mkdir(DEV_DIR, { recursive: true });
  const file = join(DEV_DIR, `${Date.now()}-${m.to.replace(/[^a-z0-9@.-]/gi, "_")}.eml`);
  await Bun.write(file, (info as unknown as { message: Buffer }).message);
  console.log(`mail (not sent, no SMTP set): "${m.subject}" to ${m.to} -> ${file}`);
}

async function holdUntilTomorrow() {
  const t = new Date();
  t.setUTCHours(24, 5, 0, 0);
  await db.update(outbox).set({ nextAt: Math.floor(t.getTime() / 1000) }).where(lte(outbox.nextAt, now()));
  console.error("mail: daily limit reached, holding the rest until tomorrow");
}

export async function deliver(): Promise<void> {
  await exclusive("mail", 5 * 60_000, async () => {
    for (;;) {
      const due = await db.select().from(outbox).where(lte(outbox.nextAt, now())).orderBy(asc(outbox.id)).limit(20);
      if (!due.length) return;
      for (const r of due) {
        if (DAILY !== null && (await bump(`mail:${day()}`, 1, 26 * 3600_000)) > DAILY) {
          await holdUntilTomorrow();
          return;
        }
        try {
          await sendOne(r);
          await db.delete(outbox).where(eq(outbox.id, r.id));
        } catch (e) {
          const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
          const gap = RETRY[r.attempts];
          if (gap === undefined) {
            console.error(`mail: giving up on "${r.subject}" after ${r.attempts + 1} tries: ${msg}`);
            await db.delete(outbox).where(eq(outbox.id, r.id));
          } else {
            console.error(`mail: "${r.subject}" failed (try ${r.attempts + 1}), retrying in ${gap}s: ${msg}`);
            await db.update(outbox)
              .set({ attempts: r.attempts + 1, nextAt: now() + gap, error: msg })
              .where(eq(outbox.id, r.id));
          }
        }
      }
    }
  });
}
