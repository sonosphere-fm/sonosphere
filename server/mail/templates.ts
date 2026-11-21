// The messages the site sends. Each has a plain-text version and a simple HTML one built from table layout and inline
// styles, which is what mail programs reliably show. Everything put into the HTML is escaped.
import { SITE_URL, type Mail } from ".";
import { UNVERIFIED_DAYS } from "../../shared/auth";

const BLUE = "#2438d6", YELLOW = "#ffcf33", INK = "#171717", MUTED = "#4a4a4a", PAPER = "#f7f3ee";
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Part = { p: string } | { button: string; url: string } | { small: string } | { item: string; url: string; quote?: string };

function build(to: string, subject: string, heading: string, parts: Part[], optional = false): Mail {
  const manage = `${SITE_URL}/settings/notifications`;
  const text = [heading, "", ...parts.flatMap(x => "p" in x ? [x.p, ""] : "button" in x ? [`${x.button}: ${x.url}`, ""] : "item" in x ? [x.item, ...(x.quote ? [`  "${x.quote}"`] : []), `  ${x.url}`, ""] : [x.small, ""]),
    "-- ", `Sonosphere - ${SITE_URL}`, ...(optional ? [`Choose which emails you get: ${manage}`] : [])].join("\n");
  const body = parts.map(x => "p" in x
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${INK}">${esc(x.p)}</p>`
    : "item" in x
      ? `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:${INK}"><a href="${esc(x.url)}" style="color:${INK};text-decoration:none">${esc(x.item)}</a>${x.quote ? `<br><span style="color:${MUTED};font-size:14px">&ldquo;${esc(x.quote)}&rdquo;</span>` : ""}</p>`
    : "button" in x
      ? `<p style="margin:8px 0 24px"><a href="${esc(x.url)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:14px 26px">${esc(x.button)}</a></p>
         <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${MUTED}">Or paste this into your browser:<br><a href="${esc(x.url)}" style="color:${BLUE};word-break:break-all">${esc(x.url)}</a></p>`
      : `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${MUTED}">${esc(x.small)}</p>`).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${BLUE};padding:18px 28px"><a href="${esc(SITE_URL)}" style="color:${YELLOW};text-decoration:none;font-size:26px;font-weight:800;font-style:italic;letter-spacing:-.02em">sonosphere</a></td></tr>
<tr><td style="background:#ffffff;padding:32px 28px 16px">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:${INK}">${esc(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;line-height:1.5;color:${MUTED}">You are getting this because of an account at <a href="${esc(SITE_URL)}" style="color:${MUTED}">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>.${optional ? ` <a href="${esc(manage)}" style="color:${MUTED}">Choose which emails you get</a>.` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}

const link = (path: string, token: string) => `${SITE_URL}${path}?token=${token}`;

export const verifyMail = (to: string, username: string, token: string) => build(to, "Confirm your email for Sonosphere", `Hi ${username}, confirm your email`, [
  { p: "Thanks for joining Sonosphere. Confirm this is your email address so you can get back into your account if you ever forget your password." },
  { button: "Confirm email", url: link("/verify", token) },
  { small: `The link works for 3 days; you can ask for a new one from Settings. Accounts that are not confirmed within ${UNVERIFIED_DAYS} days are deleted. If you did not sign up, ignore this message and the account will be removed.` },
]);

export const welcomeMail = (to: string, username: string) => build(to, "Welcome to Sonosphere", `Welcome, ${username}`, [
  { p: "Your email is confirmed and your account is ready. A few things to try first:" },
  { p: "Connect a player so every song you play is scrobbled to your profile. Spotify, desktop players and phone apps all work." },
  { p: "Already have years of listening history somewhere else? Import it from Settings, under Import & export." },
  { p: "Follow friends and find your soundalikes: people whose taste is closest to yours." },
  { button: "Connect a player", url: `${SITE_URL}/settings/applications` },
  { small: `Your profile: ${SITE_URL}/user/${encodeURIComponent(username)}` },
]);

export const resetMail = (to: string, username: string, token: string) => build(to, "Reset your Sonosphere password", "Reset your password", [
  { p: `Someone (hopefully you) asked to reset the password for ${username} on Sonosphere.` },
  { button: "Choose a new password", url: link("/reset", token) },
  { small: "The link works for one hour and only once. If you did not ask for this, ignore this message: your password stays as it is." },
]);

export const changeMail = (to: string, username: string, token: string) => build(to, "Confirm your new email for Sonosphere", "Confirm your new email", [
  { p: `${username} on Sonosphere asked to use this address from now on. Confirm it to make the change.` },
  { button: "Confirm new email", url: link("/verify", token) },
  { small: "The link works for 3 days. Until it is used, the account keeps its old address. If this was not you, ignore this message." },
]);

export const emailChangedMail = (to: string, username: string, next: string) => build(to, "Your Sonosphere email was changed", "Your email was changed", [
  { p: `The email for ${username} on Sonosphere is now ${next}. Mail about the account will go there from now on.` },
  { p: "If you did not make this change, someone else may have your password. Reset it from the log-in page, and let the site staff know." },
]);

export const passwordChangedMail = (to: string, username: string) => build(to, "Your Sonosphere password was changed", "Your password was changed", [
  { p: `The password for ${username} on Sonosphere was just changed, and every other device was signed out.` },
  { p: "If this was not you, reset your password right away from the log-in page." },
  { button: "Reset password", url: `${SITE_URL}/forgot` },
]);

/** The first password on an account made through another site (Discord and the like). */
export const passwordSetMail = (to: string, username: string) => build(to, "You set a password on Sonosphere", "You set a password", [
  { p: `${username} on Sonosphere now has a password. You can log in with it, and use it in scrobbler apps that ask for one. Signing in with your other sites still works too.` },
  { p: "If this was not you, reset your password right away from the log-in page." },
  { button: "Reset password", url: `${SITE_URL}/forgot` },
]);

/** One thing that happened, as a notification email or a digest line shows it. */
export type NoticeLine = { line: string; url: string; quote?: string };

export const noticeMail = (to: string, n: NoticeLine & { button: string }) => build(to, n.line, n.line, [
  ...(n.quote ? [{ p: `“${n.quote}”` }] : []),
  { button: n.button, url: n.url },
], true);

export const digestMail = (to: string, username: string, weekly: boolean, lines: NoticeLine[], more: number) => build(to,
  `Your ${weekly ? "week" : "day"} on Sonosphere: ${lines.length + more} new`, `Hi ${username}, here's what you missed`, [
  ...lines.map(l => ({ item: l.line, url: l.url, quote: l.quote })),
  ...(more ? [{ small: `And ${more} more in your inbox.` }] : []),
  { button: "Open your inbox", url: `${SITE_URL}/inbox` },
], true);
