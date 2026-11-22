import { IMPORT_CHUNK, IMPORT_MAX, type ImportState } from "../shared/imports";
import { api } from "./lib";

type Kind = "scrobbles" | "loved";
type Row = { artist: string; track: string; album: string; timestamp?: number };
type Text = string | { "#text"?: string; name?: string };
type Track = {
  artist?: Text;
  name?: string;
  album?: Text;
  date?: { uts?: string };
  "@attr"?: { nowplaying?: string };
};
type History = {
  track?: Track | Track[];
  "@attr"?: { page?: string; total?: string; totalPages?: string; perPage?: string };
};
type Reply = { recenttracks?: History; lovedtracks?: History; error?: number; message?: string };

const DOCUMENTED_PAGE_SIZE = 200;
const RECENT_PAGE_SIZE = 1000;
// Public Last.fm API keys for requests made directly from the browser.
const API_KEYS = ["6bcce5a46987bb93e7875b3142a74769", "308ad08f8211e5cbcd7cb886eb95a2db"] as const;
const stringOf = (text?: Text) => (typeof text === "string" ? text : (text?.["#text"] ?? text?.name ?? "")).trim();
const skip: Row = { artist: "", track: "", album: "" };

function rowsOf(history: History, to: number) {
  const tracks = history.track ? (Array.isArray(history.track) ? history.track : [history.track]) : [];
  return tracks
    .filter((track) => track["@attr"]?.nowplaying !== "true")
    .map((track): Row => {
      const artist = stringOf(track.artist);
      const title = stringOf(track.name);
      const timestamp = Number(track.date?.uts);
      // Preserve the reported row count even if Last.fm sends an incomplete record.
      if (!artist || !title || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > to) return skip;
      return { artist, track: title, album: stringOf(track.album), timestamp };
    });
}

export async function importLastfm(
  user: string,
  kind: Kind,
  signal: AbortSignal,
  progress: (done: number, total: number) => void
): Promise<ImportState> {
  const to = Math.floor(Date.now() / 1000);
  const method = kind === "scrobbles" ? "user.getrecenttracks" : "user.getlovedtracks";
  let key = 0;
  let limit = kind === "scrobbles" ? RECENT_PAGE_SIZE : DOCUMENTED_PAGE_SIZE;
  const read = async (page: number): Promise<History> => {
    const q = new URLSearchParams({ method, user, format: "json", page: String(page), limit: String(limit) });
    if (kind === "scrobbles") q.set("to", String(to));
    q.set("api_key", API_KEYS[key]!);
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    }).catch(() => {
      signal.throwIfAborted();
      throw new Error("Couldn't reach Last.fm. Try again in a moment.");
    });
    const body = (await response.json().catch(() => null)) as Reply | null;
    const error = Number(body?.error);
    if (response.status === 429 || error === 29)
      throw new Error("Last.fm is rate limiting requests. Wait and try again.");
    // Rotate only for an invalid credential, never to get around a rate limit.
    if (error === 10 && key + 1 < API_KEYS.length) {
      key++;
      return read(page);
    }
    if (
      page === 1 &&
      limit > DOCUMENTED_PAGE_SIZE &&
      (response.status === 400 || error === 6) &&
      /\blimit\b/i.test(body?.message ?? "")
    ) {
      limit = DOCUMENTED_PAGE_SIZE;
      return read(page);
    }
    if (error === 6) throw new Error("Last.fm couldn't find that username.");
    if (error === 17) throw new Error("That Last.fm history is private. Make it visible on Last.fm and try again.");
    const history = kind === "scrobbles" ? body?.recenttracks : body?.lovedtracks;
    if (!response.ok || error || !history)
      throw new Error("Last.fm couldn't return this history. Try again in a moment.");
    if (Number(history["@attr"]?.page) !== page && Number(history["@attr"]?.total) !== 0)
      throw new Error("Last.fm returned an unexpected page. Try again.");
    return history;
  };

  const first = await read(1);
  const reportedSize = Number(first["@attr"]?.perPage);
  // Keep the same page boundaries if Last.fm quietly clamps the first response.
  if (Number.isInteger(reportedSize) && reportedSize > 0 && reportedSize < limit) limit = reportedSize;
  const total = Number(first["@attr"]?.total);
  const pages = Number(first["@attr"]?.totalPages);
  if (total === 0) throw new Error("There is nothing to import from this Last.fm profile.");
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(pages) || pages < 1)
    throw new Error("Last.fm didn't report the size of this history. Try again.");
  if (total > IMPORT_MAX)
    throw new Error(`This history exceeds the ${IMPORT_MAX.toLocaleString()}-track import limit.`);

  signal.throwIfAborted();
  const { job } = await api<ImportState>("/import", { body: { kind, total, lastfmUser: user } });
  if (!job) throw new Error("Sonosphere couldn't start the upload. Try again.");

  let done = 0;
  let chunk = 0;
  let buffered: Row[] = [];
  try {
    for (let page = 1; page <= pages && done < total; page++) {
      if (page > 1) await new Promise((resolve) => setTimeout(resolve, 250));
      signal.throwIfAborted();
      const history = page === 1 ? first : await read(page);
      const pageSize = Number(history["@attr"]?.perPage);
      if (page > 1 && pageSize && pageSize !== limit)
        throw new Error("Last.fm changed the page size during the download. Try again.");
      const next = rowsOf(history, to);
      if (!next.length || done + next.length > total)
        throw new Error("Last.fm's history changed during the download. Try again.");
      buffered.push(...next);
      done += next.length;
      progress(done, total);
      while (buffered.length >= IMPORT_CHUNK || (done === total && buffered.length)) {
        await api(`/import/${job.id}/chunk`, {
          body: { n: chunk++, rows: buffered.splice(0, IMPORT_CHUNK) },
          signal,
        });
      }
    }
    if (done !== total || buffered.length) throw new Error("Last.fm's history changed during the download. Try again.");
    signal.throwIfAborted();
    return await api<ImportState>(`/import/${job.id}/start`, { body: {} });
  } catch (error) {
    // Allow a new attempt without waiting for an incomplete upload to expire.
    const current = await api<ImportState>("/import").catch(() => null);
    if (current?.job?.id === job.id && current.job.status === "uploading")
      await api(`/import/${job.id}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}
