import en from "../shared/i18n/en";
import { acceptLanguage, type Namespace } from "../shared/i18n/core";
import {
  type Block,
  catalogText,
  type DocKey,
  type DocPage,
  docPages,
  interpolate,
  isNested,
  type Item,
  type Span,
} from "../shared/docs";
import { SITE_URL } from "./mail";
import { absolute, landing } from "./seo";

type Text = (key: DocKey) => string;
const english = catalogText("en", en);
const headers = (type: string) => ({
  "Content-Type": `${type}; charset=utf-8`,
  "Cache-Control": "public, max-age=3600",
});

function inline(span: Span, text: Text): string {
  if (typeof span === "string") return span;
  if (Array.isArray(span)) return span.map((part) => inline(part, text)).join("");
  if ("t" in span) return inline(interpolate(text(span.t), span.with), text);
  if ("code" in span) return `\`${span.code}\``;
  if ("b" in span) return `**${inline(span.b, text)}**`;
  if ("to" in span) return `[${inline(span.label, text)}](${absolute(span.to)})`;
  if ("href" in span) return `[${inline(span.label, text)}](${absolute(span.href)})`;
  return " > ";
}

function items(list: Item[], ordered: boolean, indent: string, text: Text): string[] {
  return list.flatMap((item, i) => {
    const marker = ordered ? `${i + 1}.` : "-";
    if (!isNested(item)) return [`${indent}${marker} ${inline(item, text)}`];
    const inner = `${indent}${" ".repeat(marker.length + 1)}`;
    return [`${indent}${marker} ${inline(item.text, text)}`, ...items(item.list, false, inner, text)];
  });
}

function block(b: Block, text: Text): string {
  if ("h2" in b) return `## ${inline(b.h2, text)}`;
  if ("p" in b) return inline(b.p, text);
  if ("pre" in b) return `\`\`\`${b.lang}\n${b.pre}\n\`\`\``;
  if ("ul" in b) return items(b.ul, false, "", text).join("\n");
  return items(b.ol, true, "", text).join("\n");
}

const markdown = (doc: DocPage, text: Text) =>
  [`# ${text(doc.title)}`, ...[...doc.body, ...doc.reference].map((b) => block(b, text))].join("\n\n") + "\n";

export async function docMarkdown(req: Request, path: DocPage["path"]) {
  const locale = acceptLanguage(req.headers.get("accept-language"));
  const catalog: Record<string, Namespace> =
    locale === "en" ? en : (await import(`../shared/i18n/${locale}/index.ts`)).default;
  const doc = docPages(SITE_URL).find((page) => page.path === path)!;
  return new Response(markdown(doc, catalogText(locale, catalog)), {
    headers: {
      ...headers("text/markdown"),
      "Content-Language": locale,
      Link: `<${absolute(path)}>; rel="canonical"`,
      Vary: "Accept-Language",
    },
  });
}

export function llmsTxt() {
  const pages = docPages(SITE_URL).map(
    (doc) => `- [${english(doc.title)}](${absolute(`${doc.path}.md`)}): ${landing[doc.path][1]}`
  );
  const body = [
    "# Sonosphere",
    "> Sonosphere is a scrobbling service and music community. It exposes Last.fm-compatible and ListenBrainz-compatible APIs, plus public now-playing snapshots and streams.",
    "Every documentation page is available as Markdown by adding .md to its URL.",
    ["## Docs", ...pages].join("\n"),
    [
      "## Optional",
      `- [Full documentation](${absolute("/llms-full.txt")}): Every documentation page in one file.`,
      `- [Applications](${absolute("/settings/applications")}): Create API keys, shared secrets and ListenBrainz tokens (login required).`,
    ].join("\n"),
  ];
  return new Response(body.join("\n\n") + "\n", { headers: headers("text/plain") });
}

function llmsFullTxt() {
  const body = docPages(SITE_URL)
    .map((doc) => markdown(doc, english))
    .join("\n---\n\n");
  return new Response(body, { headers: headers("text/plain") });
}

export const docsRoutes = {
  "/llms.txt": llmsTxt,
  "/llms-full.txt": llmsFullTxt,
  "/developers.md": (req: Request) => docMarkdown(req, "/developers"),
  "/help.md": (req: Request) => docMarkdown(req, "/help"),
};
