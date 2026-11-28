#!/usr/bin/env bun
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Entry, LOCALES, type Locale, type Namespace } from "../shared/i18n/core";

const API = Bun.env.TRANSLATE_API ?? "https://translate-api.edideaur.workers.dev/hi/translate";
const TOKEN = Bun.env.TOKEN;
if (!TOKEN) {
  console.error("TOKEN is required");
  process.exit(1);
}
const DIR = "shared/i18n";

const TARGET: Record<Exclude<Locale, "en">, string> = {
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

const CONCURRENCY = 3;
const RETRIES = 3;

type Job = { locale: Exclude<Locale, "en">; ns: string; key: string; form?: string; text: string };

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
    for (const [ns, source] of namespaces) {
      const path = `${DIR}/${locale}/${ns}.ts`;
      if (!(await Bun.file(path).exists())) continue;
      const have = await load(path);
      for (const [key, entry] of Object.entries(source)) {
        if (key in have) continue;
        if (typeof entry === "string") jobs.push({ locale, ns, key, text: entry });
        else for (const [form, text] of Object.entries(entry)) jobs.push({ locale, ns, key, form, text: text! });
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

  const byFile = new Map<string, Map<string, Entry>>();
  for (const job of jobs) {
    const path = `${DIR}/${job.locale}/${job.ns}.ts`;
    const entries = byFile.get(path) ?? new Map<string, Entry>();
    byFile.set(path, entries);
    if (!job.form) {
      if (done.has(job)) entries.set(job.key, done.get(job)!);
      continue;
    }
    const plural = (entries.get(job.key) ?? {}) as Record<string, string>;
    entries.set(job.key, plural);
    if (done.has(job)) plural[job.form] = done.get(job)!;
  }

  for (const [path, entries] of byFile) {
    const complete = [...entries].filter(([, v]) => typeof v === "string" || "other" in v);
    if (!complete.length) continue;
    const text = await Bun.file(path).text();
    const end = text.lastIndexOf("\n} satisfies");
    if (end === -1) {
      console.error(`skip ${path}: no closing "} satisfies" line`);
      continue;
    }
    const added = complete.map(([k, v]) => line(k, v)).join("\n");
    const before = text.slice(0, end).replace(/,?\s*$/, ",");
    await Bun.write(path, `${before}\n${added}${text.slice(end)}`);
    console.log(`added ${complete.length} to ${path}`);
  }

  console.log(`done: ${done.size} translated, ${jobs.length - done.size} failed`);
}

await main();
