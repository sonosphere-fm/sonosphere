import { digits, NUMBER_WORDS } from "./numbers";

// Elasticsearch on the machine that holds the MusicBrainz copy, reached like it through a tunnel.
// mb_* indexes are built there after each MusicBrainz export (sonomb/scripts/index.sh); ours_* are kept here (sync.ts).
const raw = process.env.ES_URL ? new URL(process.env.ES_URL) : null;
const auth = raw?.username
  ? `Basic ${btoa(`${decodeURIComponent(raw.username)}:${decodeURIComponent(raw.password)}`)}`
  : "";
const base = raw ? `${raw.protocol}//${raw.host}` : "";

export const esOn = !!raw;

export async function es<T>(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
  const ndjson = Array.isArray(body);
  const res = await fetch(base + path, {
    method,
    headers: {
      authorization: auth,
      "content-type": ndjson ? "application/x-ndjson" : "application/json",
    },
    body:
      body === undefined
        ? undefined
        : ndjson
          ? body.map((l) => JSON.stringify(l)).join("\n") + "\n"
          : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`elasticsearch ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

const TEMPLATE = {
  index_patterns: ["mb_*", "ours_*"],
  priority: 100,
  template: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        char_filter: { amp: { type: "mapping", mappings: ["& => \\u0020and\\u0020"] } },
        filter: { numbers: { type: "synonym", synonyms: NUMBER_WORDS.map(([w, d]) => `${w} => ${d}`) } },
        analyzer: {
          sono: { tokenizer: "standard", char_filter: ["amp"], filter: ["lowercase", "asciifolding", "numbers"] },
        },
      },
    },
    mappings: {
      dynamic: false,
      properties: {
        name: { type: "text", analyzer: "sono" },
        artist: { type: "text", analyzer: "sono" },
        aliases: { type: "text", analyzer: "sono" },
        pop: { type: "float" },
        seen: { type: "long" },
      },
    },
  },
};

export const putTemplate = () => es("PUT", "/_index_template/sono", TEMPLATE);

export type Ask = { index: string; term: string; size: number; from?: number };
export type Hit<T> = { id: string; doc: T };

const words = (term: string) =>
  digits(
    term
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  )
    .split(" ")
    .filter(Boolean);

// Every word typed must be in the name or the artist (the last word as a prefix), so "radiohead creep" finds Creep.
// The whole phrase as the name or the artist lifts a result, and how well known it is decides among the rest.
function search({ index, term, size, from = 0 }: Ask) {
  const artists = index === "mb_artists" || index === "ours_artists";
  const fields = artists ? ["name^1.5", "aliases"] : ["name^1.5", "artist"];
  const ws = words(term);
  return {
    from,
    size,
    _source: { excludes: ["seen"] },
    query: {
      function_score: {
        query: {
          bool: {
            must: ws.map((w, i) => ({
              multi_match: { query: w, fields, type: i === ws.length - 1 ? "bool_prefix" : "best_fields" },
            })),
            should: [
              { match_phrase: { name: { query: term, boost: 3 } } },
              { match_phrase: { [artists ? "aliases" : "artist"]: { query: term, boost: 3 } } },
            ],
          },
        },
        field_value_factor: { field: "pop", modifier: "log2p", missing: 0 },
        boost_mode: "multiply",
      },
    },
  };
}

/** All the searches in one request, as the tunnel costs ~200ms a trip; a search that failed comes back null. */
export async function findAll(asks: Ask[]): Promise<(Hit<unknown>[] | null)[]> {
  if (!asks.length) return [];
  const r = await es<{ responses: { status: number; hits?: { hits: { _id: string; _source: unknown }[] } }[] }>(
    "POST",
    "/_msearch?filter_path=responses.hits.hits._id,responses.hits.hits._source,responses.status",
    asks.flatMap((a) => [{ index: a.index }, search(a)]),
    1500
  );
  return r.responses.map((x) =>
    x.status === 200 ? (x.hits?.hits ?? []).map((h) => ({ id: h._id, doc: h._source })) : null
  );
}
