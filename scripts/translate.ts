#!/usr/bin/env bun
/**
 * Auto-translate missing i18n strings via the DeepL worker.
 *
 * Only fills empty / missing values — never overwrites human-translated
 * strings, and never touches `en` (the source of truth).
 *
 * Usage:
 *   TOKEN=... bun run scripts/translate.ts
 */

import { readdirSync } from "node:fs";
import { LOCALES } from "../shared/i18n/core";

const API = "https://translate-api.edideaur.workers.dev/hi/translate";
const TOKEN = Bun.env.TOKEN ?? "didylate";
const SOURCE = "en";

type Entry =
  | { kind: "string"; key: string; value: string }
  | { kind: "plural"; key: string; one: string; other: string };

// DeepL target codes. Locales with no DeepL target are mapped to null and skipped.
const TARGET: Record<string, string | null> = {
  es: "ES",
  de: "DE",
  ro: "RO",
  lv: "LV",
  fr: "FR",
  ja: "JA",
  ko: "KO",
  pt: "PT",
  pl: "PL",
  ru: "RU",
  it: "IT",
  id: "ID",
  tr: "TR",
  sv: "SV",
  uk: "UK",
  he: "HE",
  ar: "AR",
  "zh-Hans": "ZH",
  // No DeepL target: hi, bn, mr, te, ta, ur, "zh-Hant"
};

const CONCURRENCY = 3;
const RETRIES = 3;

function escapeJs(s: string): string {
  return s.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

function unescapeJs(s: string): string {
  return s.replace(/\\(["\\/bfnrt])/g, (_, ch) => {
    const m: Record<string, string> = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    };
    return m[ch] ?? ch;
  });
}

/** Mask `{name}` style placeholders so the translator never touches them. */
function maskPlaceholders(text: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(/\{[^}]+\}/g, (m) => {
    tokens.push(m);
    return `\x00PH${tokens.length - 1}\x00`;
  });
  return { text: masked, tokens };
}

function restorePlaceholders(text: string, tokens: string[]): string {
  return text.replace(/\x00PH(\d+)\x00/g, (_, i) => tokens[Number(i)]);
}

async function translateText(text: string, target: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const { text: masked, tokens } = maskPlaceholders(text);
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ sourceLang: "auto", targetLang: target, text: masked }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200 || typeof json.data !== "string") {
        throw new Error(JSON.stringify(json));
      }
      return restorePlaceholders(json.data, tokens);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function parseFile(text: string): {
  header: string;
  entries: Entry[];
  footer: string;
} {
  const lines = text.split("\n");
  let headerEnd = -1;
  let footerStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("export default {")) {
      headerEnd = i;
      break;
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("} satisfies")) {
      footerStart = i;
      break;
    }
  }

  const header = lines.slice(0, headerEnd + 1).join("\n");
  const footer = footerStart === -1 ? "" : lines.slice(footerStart).join("\n");
  const body = lines.slice(
    headerEnd + 1,
    footerStart === -1 ? lines.length : footerStart
  );

  const entries: Entry[] = [];
  const lineRe = /^(\s*)([\w$]+):\s*(.+?)\s*,?\s*$/;
  const keyOnlyRe = /^(\s*)([\w$]+):\s*$/;
  let i = 0;
  while (i < body.length) {
    const line = body[i];
    let m = line.match(lineRe) ?? line.match(keyOnlyRe);
    if (!m) { i++; continue; }
    const [, , key, restRaw] = m;
    let rest = restRaw ? restRaw.replace(/,\s*$/, "").trim() : "";

    if (rest === "") {
      // Multi-line value: collect following lines until the closing quote/brace.
      let acc = "";
      let j = i + 1;
      while (j < body.length) {
        const l2 = body[j];
        acc += l2 + "\n";
        if (/^\s*".*"\s*,?\s*$/.test(l2) || /^\s*\}\s*,?\s*$/.test(l2)) break;
        j++;
      }
      const trimmed = acc.trim().replace(/,\s*$/, "");
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        entries.push({ kind: "string", key, value: unescapeJs(trimmed.slice(1, -1)) });
      } else if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const inner = trimmed.slice(1, -1);
        const one = inner.match(/one:\s*"([^"]*)"/)?.[1] ?? "";
        const other = inner.match(/other:\s*"([^"]*)"/)?.[1] ?? "";
        entries.push({ kind: "plural", key, one: unescapeJs(one), other: unescapeJs(other) });
      }
      i = j + 1;
    } else if (rest.startsWith('"') && rest.endsWith('"')) {
      entries.push({ kind: "string", key, value: unescapeJs(rest.slice(1, -1)) });
      i++;
    } else if (rest.startsWith("{") && rest.endsWith("}")) {
      const inner = rest.slice(1, -1);
      const one = inner.match(/one:\s*"([^"]*)"/)?.[1] ?? "";
      const other = inner.match(/other:\s*"([^"]*)"/)?.[1] ?? "";
      entries.push({ kind: "plural", key, one: unescapeJs(one), other: unescapeJs(other) });
      i++;
    } else {
      i++;
    }
  }

  return { header, entries, footer };
}

function serializeEntry(e: Entry): string {
  if (e.kind === "string") {
    return `  ${e.key}: "${escapeJs(e.value)}",`;
  }
  return `  ${e.key}: { one: "${escapeJs(e.one)}", other: "${escapeJs(e.other)}" },`;
}

async function readSourceNamespace(ns: string): Promise<Map<string, Entry>> {
  const text = await Bun.file(`shared/i18n/${SOURCE}/${ns}.ts`).text();
  const { entries } = parseFile(text);
  const map = new Map<string, Entry>();
  for (const e of entries) map.set(e.key, e);
  return map;
}

async function main() {
  const sourceFiles = readdirSync("shared/i18n/en")
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => `shared/i18n/en/${f}`);

  const sourceByNs = new Map<string, Map<string, Entry>>();
  for (const file of sourceFiles) {
    const ns = file.replace("shared/i18n/en/", "").replace(/\.ts$/, "");
    sourceByNs.set(ns, await readSourceNamespace(ns));
  }

  const queue: {
    locale: string;
    ns: string;
    key: string;
    text: string;
  }[] = [];
  const targetMaps = new Map<string, Map<string, Entry>>();

  for (const locale of LOCALES) {
    if (locale === SOURCE) continue;
    const target = TARGET[locale];
    if (!target) {
      console.log(`skip ${locale}: no DeepL target`);
      continue;
    }
    for (const ns of sourceByNs.keys()) {
      const path = `shared/i18n/${locale}/${ns}.ts`;
      if (!(await Bun.file(path).exists())) continue;
      const text = await Bun.file(path).text();
      const { entries } = parseFile(text);
      const map = new Map(entries.map((e) => [e.key, e]));
      targetMaps.set(`${locale}/${ns}`, map);

      const sourceMap = sourceByNs.get(ns)!;
      for (const [key, sEntry] of sourceMap) {
        const tEntry = map.get(key);
        const missing =
          !tEntry ||
          (tEntry.kind === "string" && tEntry.value === "") ||
          (tEntry.kind === "plural" && (tEntry.one === "" || tEntry.other === ""));
        if (!missing) continue;
        if (sEntry.kind === "string") {
          queue.push({ locale, ns, key, text: sEntry.value });
        } else {
          if (!tEntry || tEntry.one === "") queue.push({ locale, ns, key: `${key}.one`, text: sEntry.one });
          if (!tEntry || tEntry.other === "") queue.push({ locale, ns, key: `${key}.other`, text: sEntry.other });
        }
      }
    }
  }

  console.log(`queued ${queue.length} strings for translation`);

  const results = new Map<string, string>();
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const i = idx++;
      const item = queue[i];
      try {
        const translated = await translateText(item.text, TARGET[item.locale]!);
        results.set(`${item.locale}/${item.ns}/${item.key}`, translated);
      } catch (err) {
        console.error(`failed ${item.locale}/${item.ns}/${item.key}:`, err);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  await Promise.all(new Array(CONCURRENCY).fill(null).map(() => worker()));

  for (const [localeNs, targetMap] of targetMaps) {
    const [locale, ns] = localeNs.split("/");
    const sourceMap = sourceByNs.get(ns)!;
    const text = await Bun.file(`shared/i18n/${locale}/${ns}.ts`).text();
    const { header, entries, footer } = parseFile(text);

    const out: Entry[] = [];
    let changed = false;
    for (const e of entries) {
      if (e.kind === "string") {
        const t = results.get(`${locale}/${ns}/${e.key}`);
        if (t !== undefined && e.value === "") {
          out.push({ kind: "string", key: e.key, value: t });
          changed = true;
        } else {
          out.push(e);
        }
      } else {
        const one = results.get(`${locale}/${ns}/${e.key}.one`);
        const other = results.get(`${locale}/${ns}/${e.key}.other`);
        if ((one !== undefined && e.one === "") || (other !== undefined && e.other === "")) {
          out.push({
            kind: "plural",
            key: e.key,
            one: one !== undefined ? one : e.one,
            other: other !== undefined ? other : e.other,
          });
          changed = true;
        } else {
          out.push(e);
        }
      }
    }

    // Append brand-new keys (present in en, absent here) at the end.
    for (const [key, sEntry] of sourceMap) {
      if (targetMap.has(key)) continue;
      if (sEntry.kind === "string") {
        const t = results.get(`${locale}/${ns}/${key}`);
        if (t !== undefined) {
          out.push({ kind: "string", key, value: t });
          changed = true;
        }
      } else {
        const one = results.get(`${locale}/${ns}/${key}.one`);
        const other = results.get(`${locale}/${ns}/${key}.other`);
        if (one !== undefined || other !== undefined) {
          out.push({ kind: "plural", key, one: one ?? "", other: other ?? "" });
          changed = true;
        }
      }
    }

    if (!changed) continue;

    const body = out.map(serializeEntry).join("\n");
    const content = `${header}\n${body}\n${footer}\n`;
    await Bun.write(`shared/i18n/${locale}/${ns}.ts`, content);
    console.log(`updated shared/i18n/${locale}/${ns}.ts`);
  }

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
