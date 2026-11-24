import { SITE_URL, type Mail } from ".";
import { UNVERIFIED_DAYS } from "../../shared/auth";
import { tr } from "../i18n";
import { RTL, type Locale } from "../../shared/i18n/core";

const BLUE = "#2438d6";
const YELLOW = "#ffcf33";
const INK = "#171717";
const MUTED = "#4a4a4a";
const PAPER = "#f7f3ee";
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

type Part =
  | { p: string }
  | { button: string; url: string }
  | { small: string }
  | { item: string; url: string; quote?: string };

function partText(x: Part): string[] {
  if ("p" in x) return [x.p, ""];
  if ("button" in x) return [`${x.button}: ${x.url}`, ""];
  if ("item" in x) return [x.item, ...(x.quote ? [`  "${x.quote}"`] : []), `  ${x.url}`, ""];
  return [x.small, ""];
}

function partHtml(locale: Locale, x: Part): string {
  if ("p" in x) return `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${INK}">${esc(x.p)}</p>`;
  if ("item" in x) {
    const quote = x.quote ? `<br><span style="color:${MUTED};font-size:14px">&ldquo;${esc(x.quote)}&rdquo;</span>` : "";
    return `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:${INK}"><a href="${esc(x.url)}" style="color:${INK};text-decoration:none">${esc(x.item)}</a>${quote}</p>`;
  }
  if ("button" in x) {
    return `<p style="margin:8px 0 24px"><a href="${esc(x.url)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:14px 26px">${esc(x.button)}</a></p>
         <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${MUTED}">${esc(tr(locale, "mail.pasteLink"))}<br><a href="${esc(x.url)}" style="color:${BLUE};word-break:break-all">${esc(x.url)}</a></p>`;
  }
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${MUTED}">${esc(x.small)}</p>`;
}

// table layout and inline styles: what mail programs reliably show
function build(locale: Locale, to: string, subject: string, heading: string, parts: Part[], optional = false): Mail {
  const manage = `${SITE_URL}/settings/notifications`;
  const token = crypto.randomUUID().replaceAll("-", "");
  const tracked = `${SITE_URL}/api/mail/${token}`;
  const text = [
    heading,
    "",
    ...parts.flatMap(partText),
    "-- ",
    `Sonosphere - ${SITE_URL}`,
    ...(optional ? [tr(locale, "mail.manageEmailsLine", { url: manage })] : []),
  ].join("\n");
  const body = parts.map((x) => partHtml(locale, x)).join("\n");
  const siteName = esc(SITE_URL.replace(/^https?:\/\//, ""));
  const siteLink = `<a href="${esc(SITE_URL)}" style="color:${MUTED}">${siteName}</a>`;
  const footer = esc(tr(locale, "mail.footer")).replace("{site}", siteLink);
  const manageLink = optional
    ? ` <a href="${esc(manage)}" style="color:${MUTED}">${esc(tr(locale, "mail.manageEmails"))}</a>.`
    : "";
  const html = `<!doctype html><html lang="${locale}" dir="${RTL.has(locale) ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${BLUE};padding:18px 28px"><a href="${esc(tracked)}/go" style="text-decoration:none"><img src="${esc(tracked)}/logo.png" width="208" height="32" alt="Sonosphere" style="display:block;border:0;color:${YELLOW};font-size:24px;font-weight:800;font-style:italic"></a></td></tr>
<tr><td style="background:#ffffff;padding:32px 28px 16px">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:${INK}">${esc(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;line-height:1.5;color:${MUTED}">${footer}${manageLink}</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html, token };
}

const link = (path: string, token: string) => `${SITE_URL}${path}?token=${token}`;

export const verifyMail = (locale: Locale, to: string, username: string, token: string) =>
  build(locale, to, tr(locale, "mail.verifySubject"), tr(locale, "mail.verifyHeading", { username }), [
    { p: tr(locale, "mail.verifyBody") },
    { button: tr(locale, "mail.verifyButton"), url: link("/verify", token) },
    { small: tr(locale, "mail.verifyNote", { days: UNVERIFIED_DAYS }) },
  ]);

export const purgeWarningMail = (locale: Locale, to: string, username: string, days: number, token: string) =>
  build(locale, to, tr(locale, "mail.purgeSubject", { count: days }), tr(locale, "mail.purgeHeading", { username }), [
    { p: tr(locale, "mail.purgeBody", { count: days }) },
    { button: tr(locale, "mail.verifyButton"), url: link("/verify", token) },
    { small: tr(locale, "mail.purgeNote") },
  ]);

export const welcomeMail = (locale: Locale, to: string, username: string) =>
  build(locale, to, tr(locale, "mail.welcomeSubject"), tr(locale, "mail.welcomeHeading", { username }), [
    { p: tr(locale, "mail.welcomeIntro") },
    { p: tr(locale, "mail.welcomeImport") },
    { button: tr(locale, "mail.welcomeImportButton"), url: `${SITE_URL}/import` },
    { p: tr(locale, "mail.welcomeConnect") },
    { button: tr(locale, "mail.welcomeConnectButton"), url: `${SITE_URL}/settings/applications` },
    { p: tr(locale, "mail.welcomeFollow") },
    { small: tr(locale, "mail.welcomeProfile", { url: `${SITE_URL}/user/${encodeURIComponent(username)}` }) },
  ]);

export const resetMail = (locale: Locale, to: string, username: string, token: string) =>
  build(locale, to, tr(locale, "mail.resetSubject"), tr(locale, "mail.resetHeading"), [
    { p: tr(locale, "mail.resetBody", { username }) },
    { button: tr(locale, "mail.resetButton"), url: link("/reset", token) },
    { small: tr(locale, "mail.resetNote") },
  ]);

export const changeMail = (locale: Locale, to: string, username: string, token: string) =>
  build(locale, to, tr(locale, "mail.changeSubject"), tr(locale, "mail.changeHeading"), [
    { p: tr(locale, "mail.changeBody", { username }) },
    { button: tr(locale, "mail.changeButton"), url: link("/verify", token) },
    { small: tr(locale, "mail.changeNote") },
  ]);

export const approveEmailChangeMail = (locale: Locale, to: string, username: string, next: string, token: string) =>
  build(locale, to, tr(locale, "mail.approveSubject"), tr(locale, "mail.approveHeading"), [
    { p: tr(locale, "mail.approveBody", { username, email: next }) },
    { button: tr(locale, "mail.approveButton"), url: link("/verify", token) },
    { small: tr(locale, "mail.approveNote") },
  ]);

export const emailChangedMail = (locale: Locale, to: string, username: string, next: string) =>
  build(locale, to, tr(locale, "mail.emailChangedSubject"), tr(locale, "mail.emailChangedHeading"), [
    { p: tr(locale, "mail.emailChangedBody", { username, email: next }) },
    { p: tr(locale, "mail.emailChangedWarning") },
  ]);

export const passwordChangedMail = (locale: Locale, to: string, username: string) =>
  build(locale, to, tr(locale, "mail.passwordChangedSubject"), tr(locale, "mail.passwordChangedHeading"), [
    { p: tr(locale, "mail.passwordChangedBody", { username }) },
    { p: tr(locale, "mail.notYouReset") },
    { button: tr(locale, "mail.resetPasswordButton"), url: `${SITE_URL}/forgot` },
  ]);

export const passwordSetMail = (locale: Locale, to: string, username: string) =>
  build(locale, to, tr(locale, "mail.passwordSetSubject"), tr(locale, "mail.passwordSetHeading"), [
    { p: tr(locale, "mail.passwordSetBody", { username }) },
    { p: tr(locale, "mail.notYouReset") },
    { button: tr(locale, "mail.resetPasswordButton"), url: `${SITE_URL}/forgot` },
  ]);

export type NoticeLine = { line: string; url: string; quote?: string };

export const noticeMail = (locale: Locale, to: string, n: NoticeLine & { button: string }) =>
  build(
    locale,
    to,
    n.line,
    n.line,
    [...(n.quote ? [{ p: tr(locale, "mail.quoted", { text: n.quote }) }] : []), { button: n.button, url: n.url }],
    true
  );

export const digestMail = (
  locale: Locale,
  to: string,
  username: string,
  weekly: boolean,
  lines: NoticeLine[],
  more: number
) =>
  build(
    locale,
    to,
    tr(locale, weekly ? "mail.digestSubjectWeekly" : "mail.digestSubjectDaily", { count: lines.length + more }),
    tr(locale, "mail.digestHeading", { username }),
    [
      ...lines.map((l) => ({ item: l.line, url: l.url, quote: l.quote })),
      ...(more ? [{ small: tr(locale, "mail.digestMore", { count: more }) }] : []),
      { button: tr(locale, "mail.openInbox"), url: `${SITE_URL}/inbox` },
    ],
    true
  );
