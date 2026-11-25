#!/usr/bin/env bun
/**
 * Fills in keys that exist in `en` but are missing from another locale, via the DeepL worker, and translates
 * values that are still a copy of the English. New keys go in just above the closing `} satisfies`; copies are
 * replaced where they stand. Anything already translated is left alone.
 *
 * Usage:
 *   TOKEN=... bun run scripts/translate.ts
 */

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Entry, LOCALES, type Namespace } from "../shared/i18n/core";

const API = "https://translate-api.edideaur.workers.dev/hi/translate";
const TOKEN = Bun.env.TOKEN ?? "didylate";
const DIR = "shared/i18n";

// DeepL target codes; locales without one are skipped.
const TARGET: Record<string, string> = {
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
};

// Values that are meant to read the same as the English, as "locale/namespace.key".
const KEEP_ENGLISH = new Set([
  "de/common.charts",
  "de/music.charts",
  "de/music.tags",
  "es/settings.musicServerKindSubsonic",
  "es/settings.musicServerKindJellyfin",
  "de/settings.musicServerKindSubsonic",
  "de/settings.musicServerKindJellyfin",
  "ro/settings.musicServerKindSubsonic",
  "ro/settings.musicServerKindJellyfin",
  "lv/settings.musicServerKindSubsonic",
  "lv/settings.musicServerKindJellyfin",
  "fr/settings.musicServerKindSubsonic",
  "fr/settings.musicServerKindJellyfin",
  "ja/settings.musicServerKindSubsonic",
  "ja/settings.musicServerKindJellyfin",
  "ko/settings.musicServerKindSubsonic",
  "ko/settings.musicServerKindJellyfin",
  "pt/settings.musicServerKindSubsonic",
  "pt/settings.musicServerKindJellyfin",
  "pl/settings.musicServerKindSubsonic",
  "pl/settings.musicServerKindJellyfin",
  "ru/settings.musicServerKindSubsonic",
  "ru/settings.musicServerKindJellyfin",
  "it/settings.musicServerKindSubsonic",
  "it/settings.musicServerKindJellyfin",
  "id/settings.musicServerKindSubsonic",
  "id/settings.musicServerKindJellyfin",
  "tr/settings.musicServerKindSubsonic",
  "tr/settings.musicServerKindJellyfin",
  "sv/settings.musicServerKindSubsonic",
  "sv/settings.musicServerKindJellyfin",
  "uk/settings.musicServerKindSubsonic",
  "uk/settings.musicServerKindJellyfin",
  "he/settings.musicServerKindSubsonic",
  "he/settings.musicServerKindJellyfin",
  "ar/settings.musicServerKindSubsonic",
  "ar/settings.musicServerKindJellyfin",
  "zh-Hans/settings.musicServerKindSubsonic",
  "zh-Hans/settings.musicServerKindJellyfin",
]);

const CONCURRENCY = 3;
const RETRIES = 3;

type Job = { locale: string; ns: string; key: string; form?: string; text: string; copy: boolean };

const load = async (path: string): Promise<Namespace> => (await import(resolve(path))).default;

const isFlat = (ns: Record<string, unknown>) =>
  Object.values(ns).every((v) => typeof v === "string" || (typeof v === "object" && v !== null && "other" in v));

const placeholders = (text: string) => (text.match(/\{[^}]+\}/g) ?? []).sort().join();

// Placeholders are swapped for tokens the translator leaves alone, then put back.
async function translate(text: string, target: string): Promise<string> {
  const tokens: string[] = [];
  const masked = text.replace(/\{[^}]+\}/g, (m) => `<x${tokens.push(m) - 1}>`);
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ sourceLang: "EN", targetLang: target, text: masked }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200 || typeof json.data !== "string") throw new Error(JSON.stringify(json));
      const out = json.data.replace(/<x(\d+)>/g, (_: string, i: string) => tokens[Number(i)]);
      if (placeholders(out) !== placeholders(text)) throw new Error(`placeholders lost: ${out}`);
      return out;
    } catch (err) {
      lastError = err;
      await Bun.sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

const line = (key: string, value: Entry) => `  ${key}: ${JSON.stringify(value)},`;

const hasWords = (text: string) => /\p{L}/u.test(text.replace(/\{[^}]+\}/g, ""));

const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/;

/** Swaps the strings of `key` in place: the one string, or the plural forms given. */
function replaceValue(text: string, key: string, value: string | Record<string, string>) {
  const start = text.search(new RegExp(`^  ${key}:`, "m"));
  if (start === -1) return text;
  const rest = text.slice(start + 1).search(/^ {2}[\w$]+:|^\} satisfies/m);
  const end = rest === -1 ? text.length : start + 1 + rest;
  const span =
    typeof value === "string"
      ? text.slice(start, end).replace(LITERAL, JSON.stringify(value))
      : text
          .slice(start, end)
          .replace(new RegExp(`(\\w+)(:\\s*)(${LITERAL.source})`, "g"), (m, form, gap) =>
            form in value ? `${form}${gap}${JSON.stringify(value[form])}` : m
          );
  return text.slice(0, start) + span + text.slice(end);
}

async function main() {
  const namespaces: [string, Namespace][] = [];
  for (const file of readdirSync(`${DIR}/en`)) {
    if (!file.endsWith(".ts") || file === "index.ts") continue;
    const ns = file.slice(0, -3);
    const source = await load(`${DIR}/en/${file}`);
    if (isFlat(source)) namespaces.push([ns, source]);
  }

  const jobs: Job[] = [];
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    if (!TARGET[locale]) {
      console.log(`skip ${locale}: no DeepL target`);
      continue;
    }
    for (const [ns, source] of namespaces) {
      const path = `${DIR}/${locale}/${ns}.ts`;
      if (!(await Bun.file(path).exists())) continue;
      const have = await load(path);
      for (const [key, entry] of Object.entries(source)) {
        const copy = key in have;
        if (copy && JSON.stringify(have[key]) !== JSON.stringify(entry)) continue;
        if (copy && KEEP_ENGLISH.has(`${locale}/${ns}.${key}`)) continue;
        if (typeof entry === "string") {
          if (!copy || hasWords(entry)) jobs.push({ locale, ns, key, text: entry, copy });
          continue;
        }
        for (const [form, text] of Object.entries(entry)) jobs.push({ locale, ns, key, form, text: text!, copy });
      }
    }
  }
  console.log(`queued ${jobs.length} strings for translation`);

  const done = new Map<Job, string>();
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        done.set(job, await translate(job.text, TARGET[job.locale]));
      } catch (err) {
        console.error(`failed ${job.locale}/${job.ns}.${job.key}${job.form ? `.${job.form}` : ""}:`, err);
      }
      await Bun.sleep(250);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  type Found = { copy: boolean; value: string | Record<string, string> };
  const byFile = new Map<string, Map<string, Found>>();
  for (const job of jobs) {
    const translated = done.get(job);
    if (translated === undefined || (job.copy && translated === job.text)) continue;
    const path = `${DIR}/${job.locale}/${job.ns}.ts`;
    const found = byFile.get(path) ?? new Map<string, Found>();
    byFile.set(path, found);
    if (!job.form) {
      found.set(job.key, { copy: job.copy, value: translated });
      continue;
    }
    const plural = found.get(job.key) ?? { copy: job.copy, value: {} };
    (plural.value as Record<string, string>)[job.form] = translated;
    found.set(job.key, plural);
  }

  for (const [path, found] of byFile) {
    let text = await Bun.file(path).text();
    const added: string[] = [];
    let replaced = 0;
    for (const [key, { copy, value }] of found) {
      if (copy) {
        text = replaceValue(text, key, value);
        replaced++;
      } else if (typeof value === "string" || "other" in value) {
        added.push(line(key, value));
      }
    }
    if (added.length) {
      const end = text.lastIndexOf("\n} satisfies");
      if (end === -1) {
        console.error(`skip ${path}: no closing "} satisfies" line`);
        continue;
      }
      text = `${text.slice(0, end).replace(/,?\s*$/, ",")}\n${added.join("\n")}${text.slice(end)}`;
    }
    if (!added.length && !replaced) continue;
    await Bun.write(path, text);
    console.log(`${path}: ${added.length} added, ${replaced} translated from English`);
  }

  console.log(`done: ${done.size} translated, ${jobs.length - done.size} failed`);
}

await main();
