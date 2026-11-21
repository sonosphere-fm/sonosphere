import { useState, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link } from "react-router-dom";
import { api, dateTime, num, plural, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Art, Async, Section, useAction } from "../ui/base";
import { Suggest } from "../ui/suggest";
import { TrackList } from "../ui/lists";
import { DatePicker, toLocal } from "../datepicker";
import type { LovedImported, ScrobbleResponse } from "../../shared/listening";
import type { SearchResults } from "../../shared/search";
import type { UserRecent } from "../../shared/users";

// ---------- manual scrobbling & import ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}
// Import files are whatever the person uploads, so everything read from them starts out `unknown`.
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object";
const get = (v: unknown, k: string) => (isObj(v) ? v[k] : undefined);
const list = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
type ImportRow = { artist: string; track: string; album: string; timestamp: number | undefined };
const toStamp = (v: unknown) => { if (v === undefined || v === null || v === "") return undefined; const n = Number(v); if (Number.isFinite(n)) return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n); const t = Date.parse(String(v)); return Number.isFinite(t) ? Math.floor(t / 1000) : undefined; };
function parseImport(name: string, text: string): ImportRow[] {
  let rows: Obj[];
  if (name.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(text)) {
    // ours is a flat list; Last.fm API dumps are pages of recenttracks (arrays of arrays, or {recenttracks:{track}})
    const flat = (j: unknown): unknown[] => list(j)?.flatMap(x => Array.isArray(x) || get(x, "recenttracks") || get(x, "lovedtracks") || isObj(get(x, "track")) ? flat(x) : [x])
      ?? (isObj(j) ? flat(j.tracks ?? j.scrobbles ?? j.loved ?? get(j.recenttracks, "track") ?? j.recenttracks ?? get(j.lovedtracks, "track") ?? j.lovedtracks ?? j.track ?? []) : []);
    rows = flat(JSON.parse(text)).filter(isObj).filter(r => get(r["@attr"], "nowplaying") !== "true");
  } else {
    const csv = parseCsv(text); if (!csv.length) return [];
    const head = csv[0].map(h => h.trim().toLowerCase()), hasHead = head.includes("artist");
    const cols = hasHead ? head : ["artist", "album", "track", "timestamp"];
    rows = csv.slice(hasHead ? 1 : 0).map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  }
  const str = (v: unknown) => String((isObj(v) ? v["#text"] ?? v.name ?? v.title : v) ?? "").trim();
  return rows.map(r => ({ artist: str(r.artist ?? r.artistName), track: str(r.track ?? r.title ?? r.name ?? r.trackName), album: str(r.album ?? r.albumName),
    timestamp: toStamp(isObj(r.date) ? r.date.uts ?? r.date["#text"] : r.timestamp ?? r.date ?? r.played_at ?? r.playedAt ?? r.uts ?? r.endTime) })).filter(r => r.artist && r.track);
}
export function ScrobblePage() {
  const { me } = useAuth();
  const local = () => toLocal(new Date()), minsAgo = (m: number) => () => new Date(Date.now() - m * 60000);
  // matches by the artist already typed come first
  const mine = <T extends { artist: string }>(items: T[]) => { const a = f.artist.trim().toLowerCase(); return a ? [...items].sort((x, y) => Number(y.artist.toLowerCase() === a) - Number(x.artist.toLowerCase() === a)) : items; };
  const search = (q: string, type: "artists" | "albums" | "tracks") => api<SearchResults>(`/search${qs({ q, type, limit: type === "artists" ? 6 : 12 })}`);
  const findArtists = (q: string) => search(q, "artists").then(r => r.artists);
  const findAlbums = (q: string) => search(q, "albums").then(r => mine(r.albums).slice(0, 6));
  const findTracks = (q: string) => search(q, "tracks").then(r => mine(r.tracks).slice(0, 6));
  const [f, setF] = useState({ artist: "", track: "", album: "", when: local() }), act = useAction(), imp = useAction();
  const [rows, setRows] = useState<ImportRow[] | null>(null), [fileName, setFileName] = useState(""), [progress, setProgress] = useState("");
  const [what, setWhat] = useState<"scrobbles" | "loved">("scrobbles"), noun = what === "loved" ? "loved track" : "scrobble";
  const recent = useApi<UserRecent>(`/user/recent${qs({ name: me!.username, limit: 5 })}`);
  useTitle("Scrobble");
  const submit = (e: FormEvent) => { e.preventDefault(); act.run(async () => {
    const r = await api<ScrobbleResponse>("/scrobble", { body: { artist: f.artist, track: f.track, album: f.album, timestamp: f.when ? Math.floor(new Date(f.when).getTime() / 1000) : undefined, source: "manual" } });
    if (!r.accepted) throw new Error(r.details[0]?.reason || "That scrobble was ignored");
    setF({ ...f, track: "", when: local() }); recent.reload(); return `Scrobbled “${f.track}” by ${f.artist}.`;
  }); };
  const pick = async (file?: File) => {
    if (!file) return;
    setFileName(file.name); setRows(null); setProgress("");
    imp.run(async () => {
      const text = await file.text(), parsed = parseImport(file.name, text);
      if (!parsed.length) throw new Error("Nothing found in that file. Expected columns: artist, album, track, timestamp.");
      if (/loved/i.test(file.name) || /"lovedtracks"/.test(text.slice(0, 2000))) setWhat("loved"); // a loved-tracks dump, by its name or shape
      setRows(parsed);
    });
  };
  const runImport = () => imp.run(async () => {
    let accepted = 0, ignored = 0;
    for (let i = 0; i < rows!.length; i += 2000) {
      setProgress(`Importing ${num(Math.min(i + 2000, rows!.length))} of ${num(rows!.length)}…`);
      const r = await api<ScrobbleResponse | LovedImported>(what === "loved" ? "/love/import" : "/scrobble", { body: { tracks: rows!.slice(i, i + 2000), source: "import" } });
      accepted += r.accepted; ignored += r.ignored;
    }
    setRows(null); setProgress(""); recent.reload();
    if (what === "loved") return `Imported ${plural(accepted, "loved track")}${ignored ? `; ${num(ignored)} skipped (already loved, or missing an artist or title)` : ""}.`;
    return `Imported ${plural(accepted, "scrobble")}${ignored ? `; ${num(ignored)} skipped (duplicates, missing fields or dates in the future)` : ""}.`;
  });
  return (
    <div className="wrap page">
      <h1 className="page-title">Scrobble</h1>
      <div className="cols even">
        <div>
          <Section title="Scrobble a track manually">
            <form className="form card" onSubmit={submit}>
              <label>Track
                <Suggest label="Track" autoFocus placeholder="Start typing a song…" value={f.track} onChange={v => setF({ ...f, track: v })} search={findTracks} text={t => t.title}
                  onPick={t => setF({ ...f, track: t.title, artist: t.artist, album: t.album || "" })}
                  row={t => <><Art image={t.image} /><span><strong>{t.title}</strong><span>{t.artist}{t.album && ` · ${t.album}`}</span></span></>} />
              </label>
              <div className="pair">
              <label>Artist
                <Suggest label="Artist" value={f.artist} onChange={v => setF({ ...f, artist: v })} search={findArtists} text={a => a.name} onPick={a => setF({ ...f, artist: a.name })}
                  row={a => <><Art image={a.image} kind="artist" /><span><strong>{a.name}</strong><span>{num(a.listeners)} listeners</span></span></>} />
              </label>
              <label><span>Album <span className="muted opt">optional</span></span>
                <Suggest label="Album" value={f.album} onChange={v => setF({ ...f, album: v })} search={findAlbums} text={a => a.title} onPick={a => setF({ ...f, album: a.title, artist: f.artist.trim() ? f.artist : a.artist })}
                  row={a => <><Art image={a.image} /><span><strong>{a.title}</strong><span>{a.artist}</span></span></>} />
              </label>
              </div>
              <label>Listened at
                <DatePicker time label="Listened at" value={f.when} onChange={v => setF({ ...f, when: v || local() })} max="now"
                  presets={[["Just now", minsAgo(0)], ["5 min ago", minsAgo(5)], ["30 min ago", minsAgo(30)], ["1 hour ago", minsAgo(60)], ["Yesterday", minsAgo(1440)]]} />
              </label>
              {act.note}
              <Button kind="btn" loading={act.busy} disabled={!f.artist.trim() || !f.track.trim()}>Scrobble</Button>
            </form>
            <p className="muted small">Pick a match to fill in the rest, or type anything: music that isn't in the catalogue yet is added automatically.</p>
          </Section>
          <Section title="Your latest scrobbles" more={`${userUrl(me!.username)}/library`}><Async q={recent}>{d => <TrackList items={d.items} time />}</Async></Section>
        </div>
        <div>
          <Section title="Import scrobbles or loved tracks">
            <div className="card form">
              <p>Upload a CSV or JSON file of past listens or loved tracks. CSV columns: <code>artist, album, track, timestamp</code> (Unix seconds or an ISO date; only artist and track are required). This is the same format as <Link to="/settings/data">your data export</Link>. JSON dumps of Last.fm’s recent-tracks and loved-tracks API work too.</p>
              <div className="tabs sub" role="group" aria-label="What the file contains">
                <button type="button" className={what === "scrobbles" ? "active" : ""} aria-pressed={what === "scrobbles"} onClick={() => setWhat("scrobbles")}>Scrobbles</button>
                <button type="button" className={what === "loved" ? "active" : ""} aria-pressed={what === "loved"} onClick={() => setWhat("loved")}>Loved tracks</button>
              </div>
              <label>File<Input type="file" accept=".csv,.json,text/csv,application/json" onChange={e => pick(e.target.files?.[0])} /></label>
              {rows && (
                <>
                  <p><b>{plural(rows.length, noun)}</b> found in {fileName}. First rows:</p>
                  <table className="chartlist compact"><tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}><td className="c-name"><span className="strong">{r.track}</span><span className="muted">{r.artist}{r.album && ` · ${r.album}`}</span></td><td className="c-time">{r.timestamp ? dateTime(r.timestamp) : what === "loved" ? "" : "now"}</td></tr>)}</tbody></table>
                  <Button kind="btn" loading={imp.busy} onClick={runImport}>{imp.busy ? progress || "Importing…" : `Import ${plural(rows.length, noun)}`}</Button>
                </>
              )}
              {imp.note}
            </div>
          </Section>
          <Section title="Scrobble from other apps">
            <p>Sonosphere speaks the Last.fm 2.0 scrobbling protocol at <code>/2.0/</code>. Create an API key under <Link to="/settings/applications">Settings → Applications</Link> and see the <Link to="/developers">API docs</Link>.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
