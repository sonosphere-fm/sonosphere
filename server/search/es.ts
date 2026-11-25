import { NUMBER_WORDS } from "./numbers";

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

// every word typed, the last one as a prefix; the whole phrase and how well known it is lift a result
export async function find<T>(index: string, term: string, size: number, from = 0): Promise<{ id: string; doc: T }[]> {
  const fields = index === "mb_artists" ? ["name", "aliases"] : ["name"];
  const r = await es<{ hits: { hits: { _id: string; _source: T }[] } }>(
    "POST",
    `/${index}/_search?filter_path=hits.hits._id,hits.hits._source`,
    {
      from,
      size,
      query: {
        function_score: {
          query: {
            bool: {
              should: fields.flatMap((f) => [
                { match_bool_prefix: { [f]: { query: term, operator: "and" } } },
                { match_phrase: { [f]: { query: term, boost: 3 } } },
              ]),
              minimum_should_match: 1,
            },
          },
          field_value_factor: { field: "pop", modifier: "log2p", missing: 0 },
          boost_mode: "multiply",
        },
      },
    },
    3000
  );
  return (r.hits?.hits ?? []).map((h) => ({ id: h._id, doc: h._source }));
}
