import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link } from "react-router-dom";
import { Arrow, Spinner } from "../icons";
import { api, dateTime, num, plural, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Art, Async, Section, useAction } from "../ui/base";
import { Suggest } from "../ui/suggest";
import { TrackList } from "../ui/lists";
import { DatePicker, toLocal } from "../datepicker";
import type { ScrobbleResponse } from "../../shared/listening";
import { IMPORT_CHUNK, IMPORT_MAX, type ImportJob, type ImportState } from "../../shared/imports";
import type { SearchResults } from "../../shared/search";
import type { UserRecent } from "../../shared/users";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some(c => c.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') {
        cell += ch;
      } else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  endRow();
  return rows;
}

// Import files are whatever the person uploads, so everything read from them starts out `unknown`.
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object";
const get = (v: unknown, k: string) => (isObj(v) ? v[k] : undefined);

type ImportRow = { artist: string; track: string; album: string; timestamp: number | undefined };

function toStamp(v: unknown) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

// Our export is a flat list; Last.fm API dumps are pages of recenttracks (arrays of arrays, or {recenttracks:{track}}).
function flatten(j: unknown): unknown[] {
  if (Array.isArray(j)) {
    return j.flatMap(x => {
      const nested = Array.isArray(x) || get(x, "recenttracks") || get(x, "lovedtracks") || isObj(get(x, "track"));
      return nested ? flatten(x) : [x];
    });
  }
  if (!isObj(j)) return [];
  return flatten(
    j.tracks ?? j.scrobbles ?? j.loved
      ?? get(j.recenttracks, "track") ?? j.recenttracks
      ?? get(j.lovedtracks, "track") ?? j.lovedtracks
      ?? j.track ?? [],
  );
}

const text = (v: unknown) => String((isObj(v) ? v["#text"] ?? v.name ?? v.title : v) ?? "").trim();

function rawTime(r: Obj) {
  if (isObj(r.date)) return r.date.uts ?? r.date["#text"];
  return r.timestamp ?? r.date ?? r.played_at ?? r.playedAt ?? r.uts ?? r.endTime;
}

function parseImport(name: string, body: string): ImportRow[] {
  let rows: Obj[];
  if (name.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(body)) {
    rows = flatten(JSON.parse(body))
      .filter(isObj)
      .filter(r => get(r["@attr"], "nowplaying") !== "true");
  } else {
    const csv = parseCsv(body);
    if (!csv.length) return [];
    const head = csv[0].map(h => h.trim().toLowerCase());
    const hasHead = head.includes("artist");
    const cols = hasHead ? head : ["artist", "album", "track", "timestamp"];
    rows = csv.slice(hasHead ? 1 : 0).map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  }
  return rows
    .map(r => ({
      artist: text(r.artist ?? r.artistName),
      track: text(r.track ?? r.title ?? r.name ?? r.trackName),
      album: text(r.album ?? r.albumName),
      timestamp: toStamp(rawTime(r)),
    }))
    .filter(r => r.artist && r.track);
}

const active = (j: ImportJob | null | undefined) => !!j && ["uploading", "queued", "running"].includes(j.status);

// Polls every two seconds while an import is running on the server.
function useImportJob() {
  const [job, setJob] = useState<ImportJob | null | undefined>(undefined);
  const load = () => api<ImportState>("/import").then(r => setJob(r.job)).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!active(job) || job?.status === "uploading") return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [job?.status, job?.id]);
  return [job, setJob] as const;
}

function importSource(job: ImportJob) {
  if (job.kind === "lastfm") return `Last.fm (${job.lastfmUser})`;
  if (job.kind === "loved") return "your loved tracks";
  return "your file";
}

function ImportProgress({ job, onCancel }: { job: ImportJob; onCancel: () => void }) {
  const what = importSource(job);
  const pct = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
  const skipped = job.done - job.accepted;

  if (job.status === "done") {
    return (
      <p className="form-ok">
        Imported {plural(job.accepted, "scrobble")} from {what}{skipped > 0 ? `, skipped ${num(skipped)} duplicates/errors` : ""}.
      </p>
    );
  }
  if (job.status === "failed") {
    return (
      <p className="form-error">
        The import from {what} stopped: {job.error} {job.accepted > 0 && `${plural(job.accepted, "scrobble")} imported before that stay.`}
      </p>
    );
  }
  if (job.status === "cancelled") {
    return <p className="muted">The import from {what} was cancelled{job.accepted > 0 ? ` after ${plural(job.accepted, "scrobble")}` : ""}.</p>;
  }

  let heading = `Matching ${what} to the catalogue…`;
  if (job.status === "queued") heading = `Waiting to start importing ${what}…`;
  else if (job.phase === "loved") heading = `Importing loved tracks from ${what}…`;

  return (
    <div className="import-progress" role="status">
      <div className="import-head"><Spinner />
        <b>{heading}</b>
      </div>
      <div className="import-track"><span style={{ width: `${job.status === "queued" ? 0 : Math.max(pct, 1)}%` }} /></div>
      <p className="muted small">
        {num(job.done)} of {job.total ? `about ${num(job.total)}` : "?"} done{job.accepted ? `, ${num(job.accepted)} added` : ""}.
        This carries on in the background: you can close the page and come back.
      </p>
      <Button kind="btn ghost small" onClick={onCancel}>Cancel import</Button>
    </div>
  );
}

const local = () => toLocal(new Date());
const minsAgo = (m: number) => () => new Date(Date.now() - m * 60000);
const PRESETS: [string, () => Date][] = [
  ["Just now", minsAgo(0)],
  ["5 min ago", minsAgo(5)],
  ["30 min ago", minsAgo(30)],
  ["1 hour ago", minsAgo(60)],
  ["Yesterday", minsAgo(1440)],
];

const search = (q: string, type: "artists" | "albums" | "tracks") =>
  api<SearchResults>(`/search${qs({ q, type, limit: type === "artists" ? 6 : 12 })}`);

export function ScrobblePage() {
  const { me } = useAuth();
  const [f, setF] = useState({ artist: "", track: "", album: "", when: local() });
  const act = useAction();
  const imp = useAction();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const [job, setJob] = useImportJob();
  const [lfm, setLfm] = useState("");
  const lfmAct = useAction();
  const busy = active(job);
  const [what, setWhat] = useState<"scrobbles" | "loved">("scrobbles");
  const noun = what === "loved" ? "loved track" : "scrobble";
  const recent = useApi<UserRecent>(`/user/recent${qs({ name: me!.username, limit: 5 })}`);
  useTitle("Scrobble");

  // Matches by the artist already typed come first.
  const byTypedArtist = <T extends { artist: string }>(items: T[]) => {
    const a = f.artist.trim().toLowerCase();
    if (!a) return items;
    const matches = (x: T) => Number(x.artist.toLowerCase() === a);
    return [...items].sort((x, y) => matches(y) - matches(x));
  };
  const findArtists = (q: string) => search(q, "artists").then(r => r.artists);
  const findAlbums = (q: string) => search(q, "albums").then(r => byTypedArtist(r.albums).slice(0, 6));
  const findTracks = (q: string) => search(q, "tracks").then(r => byTypedArtist(r.tracks).slice(0, 6));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const timestamp = f.when ? Math.floor(new Date(f.when).getTime() / 1000) : undefined;
      const r = await api<ScrobbleResponse>("/scrobble", {
        body: { artist: f.artist, track: f.track, album: f.album, timestamp, source: "manual" },
      });
      if (!r.accepted) throw new Error(r.details[0]?.reason || "That scrobble was ignored");
      setF({ ...f, track: "", when: local() });
      recent.reload();
      return `Scrobbled “${f.track}” by ${f.artist}.`;
    });
  };

  const pick = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setRows(null);
    setProgress("");
    imp.run(async () => {
      const body = await file.text();
      const parsed = parseImport(file.name, body);
      if (!parsed.length) throw new Error("Nothing found in that file. Expected columns: artist, album, track, timestamp.");
      if (parsed.length > IMPORT_MAX) {
        throw new Error(`That file has ${num(parsed.length)} rows; an import can hold up to ${num(IMPORT_MAX)}. Split it and import it in parts.`);
      }
      if (/loved/i.test(file.name) || /"lovedtracks"/.test(body.slice(0, 2000))) setWhat("loved");
      setRows(parsed);
    });
  };

  // Rows go up in chunks; once all are there the server takes over and the page can be closed.
  const runImport = () => imp.run(async () => {
    const all = rows!;
    const { job: j } = await api<ImportState>("/import", { body: { kind: what, total: all.length } });
    for (let n = 0; n * IMPORT_CHUNK < all.length; n++) {
      const end = (n + 1) * IMPORT_CHUNK;
      setProgress(`Uploading ${num(Math.min(end, all.length))} of ${num(all.length)}…`);
      await api(`/import/${j!.id}/chunk`, { body: { n, rows: all.slice(n * IMPORT_CHUNK, end) } });
    }
    const started = await api<ImportState>(`/import/${j!.id}/start`, { body: {} });
    setJob(started.job);
    setRows(null);
    setProgress("");
  });

  const fromLastfm = (e: FormEvent) => {
    e.preventDefault();
    lfmAct.run(async () => {
      const r = await api<ImportState>("/import/lastfm", { body: { user: lfm.trim() } });
      setJob(r.job);
    });
  };

  const cancel = async () => {
    if (!job) return;
    const r = await api<ImportState>(`/import/${job.id}`, { method: "DELETE" });
    setJob(r.job);
    recent.reload();
  };

  useEffect(() => {
    if (job?.status === "done") recent.reload();
  }, [job?.status]);

  return (
    <div className="wrap page">
      <h1 className="page-title">Scrobble</h1>
      <div className="cols even">
        <div>
          <Section title="Scrobble a track manually">
            <form className="form card" onSubmit={submit}>
              <label>Track
                <Suggest
                  label="Track"
                  autoFocus
                  placeholder="Start typing a song…"
                  value={f.track}
                  onChange={v => setF({ ...f, track: v })}
                  search={findTracks}
                  text={t => t.title}
                  onPick={t => setF({ ...f, track: t.title, artist: t.artist, album: t.album || "" })}
                  row={t => (
                    <>
                      <Art image={t.image} />
                      <span><strong>{t.title}</strong><span>{t.artist}{t.album && ` · ${t.album}`}</span></span>
                    </>
                  )}
                />
              </label>
              <div className="pair">
                <label>Artist
                  <Suggest
                    label="Artist"
                    value={f.artist}
                    onChange={v => setF({ ...f, artist: v })}
                    search={findArtists}
                    text={a => a.name}
                    onPick={a => setF({ ...f, artist: a.name })}
                    row={a => (
                      <>
                        <Art image={a.image} kind="artist" />
                        <span><strong>{a.name}</strong><span>{num(a.listeners)} listeners</span></span>
                      </>
                    )}
                  />
                </label>
                <label><span>Album <span className="muted opt">optional</span></span>
                  <Suggest
                    label="Album"
                    value={f.album}
                    onChange={v => setF({ ...f, album: v })}
                    search={findAlbums}
                    text={a => a.title}
                    onPick={a => setF({ ...f, album: a.title, artist: f.artist.trim() ? f.artist : a.artist })}
                    row={a => (
                      <>
                        <Art image={a.image} />
                        <span><strong>{a.title}</strong><span>{a.artist}</span></span>
                      </>
                    )}
                  />
                </label>
              </div>
              <label>Listened at
                <DatePicker
                  time
                  label="Listened at"
                  value={f.when}
                  onChange={v => setF({ ...f, when: v || local() })}
                  max="now"
                  presets={PRESETS}
                />
              </label>
              {act.note}
              <Button kind="btn" loading={act.busy} disabled={!f.artist.trim() || !f.track.trim()}>Scrobble</Button>
            </form>
            <p className="muted small">Pick a match to fill in the rest, or type anything: music that isn't in the catalogue yet is added automatically.</p>
          </Section>
          <Section title="Your latest scrobbles" more={`${userUrl(me!.username)}/library`}>
            <Async q={recent}>{d => <TrackList items={d.items} time />}</Async>
          </Section>
        </div>
        <div>
          <Section title="Import your history">
            <div className="card form">
              {job && job.status !== "uploading" && <ImportProgress job={job} onCancel={cancel} />}
              {!busy && (
                <>
                  <form className="lastfm-import" onSubmit={fromLastfm}>
                    <label>
                      Last.fm username
                      <Input value={lfm} onChange={e => setLfm(e.target.value)} placeholder="Your Last.fm username" autoComplete="off" maxLength={40} />
                    </label>
                    <Button kind="btn" loading={lfmAct.busy} disabled={!lfm.trim()}>Import from Last.fm</Button>
                  </form>
                  {lfmAct.note}
                  <p className="muted small">
                    Scrobbles and loved tracks are imported to your profile. Large imports may take a while but you are free to close the page
                    once the import starts.
                  </p>
                  <p>
                    Or import scrobbles or loved tracks from a CSV/JSON file. CSV columns: <code>artist, album, track, timestamp</code> (Unix
                    seconds or ISO date; only artist and track are required).
                  </p>
                  <div className="tabs sub" role="group" aria-label="What the file contains">
                    <button type="button" className={what === "scrobbles" ? "active" : ""} aria-pressed={what === "scrobbles"} onClick={() => setWhat("scrobbles")}>
                      Scrobbles
                    </button>
                    <button type="button" className={what === "loved" ? "active" : ""} aria-pressed={what === "loved"} onClick={() => setWhat("loved")}>
                      Loved tracks
                    </button>
                  </div>
                  <label>File<Input type="file" accept=".csv,.json,text/csv,application/json" onChange={e => pick(e.target.files?.[0])} /></label>
                  {rows && (
                    <>
                      <p><b>{plural(rows.length, noun)}</b> found in {fileName}. First rows:</p>
                      <table className="chartlist compact">
                        <tbody>
                          {rows.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              <td className="c-name">
                                <span className="strong">{r.track}</span>
                                <span className="muted">{r.artist}{r.album && ` · ${r.album}`}</span>
                              </td>
                              <td className="c-time">{r.timestamp ? dateTime(r.timestamp) : what === "loved" ? "" : "now"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button kind="btn" loading={imp.busy} onClick={runImport}>
                        {imp.busy ? progress || "Uploading…" : `Import ${plural(rows.length, noun)}`}
                      </Button>
                      {imp.busy && <p className="muted small">Keep this page open until the upload finishes; after that it carries on without it.</p>}
                    </>
                  )}
                  {imp.note}
                </>
              )}
            </div>
          </Section>
          <Section title="Scrobble from other apps">
            <p>
              Sonosphere's API is compatible with applications that support the Last.fm 2.0 protocol. To scrobble from another app, create an
              API key under <Link to="/settings/applications">Settings<Arrow say=", " />Applications</Link> and refer to
              the <Link to="/developers">API docs</Link>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
