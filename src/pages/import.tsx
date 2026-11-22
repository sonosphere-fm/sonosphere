import { useEffect, useRef, useState, type FormEvent } from "react";
import { IMPORT_CHUNK, IMPORT_MAX, type ImportJob, type ImportState } from "../../shared/imports";
import { Spinner } from "../icons";
import { Button, Input, Select } from "../kit";
import { importLastfm } from "../lastfm-import";
import { api, dateTime, num, plural, useTitle } from "../lib";
import { Section, useAction } from "../ui/base";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim())) rows.push(row);
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
    return j.flatMap((x) => {
      const nested = Array.isArray(x) || get(x, "recenttracks") || get(x, "lovedtracks") || isObj(get(x, "track"));
      return nested ? flatten(x) : [x];
    });
  }
  if (!isObj(j)) return [];
  return flatten(
    j.tracks ??
      j.scrobbles ??
      j.loved ??
      get(j.recenttracks, "track") ??
      j.recenttracks ??
      get(j.lovedtracks, "track") ??
      j.lovedtracks ??
      j.track ??
      []
  );
}

const text = (v: unknown) => String((isObj(v) ? (v["#text"] ?? v.name ?? v.title) : v) ?? "").trim();

function rawTime(r: Obj) {
  if (isObj(r.date)) return r.date.uts ?? r.date["#text"];
  return r.timestamp ?? r.date ?? r.played_at ?? r.playedAt ?? r.uts ?? r.endTime;
}

function parseImport(name: string, body: string): ImportRow[] {
  let rows: Obj[];
  if (name.toLowerCase().endsWith(".json") || /^\s*[[{]/.test(body)) {
    rows = flatten(JSON.parse(body))
      .filter(isObj)
      .filter((r) => get(r["@attr"], "nowplaying") !== "true");
  } else {
    const csv = parseCsv(body);
    if (!csv.length) return [];
    const head = csv[0].map((h) => h.trim().toLowerCase());
    const hasHead = head.includes("artist");
    const cols = hasHead ? head : ["artist", "album", "track", "timestamp"];
    rows = csv.slice(hasHead ? 1 : 0).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  }
  return rows
    .map((r) => ({
      artist: text(r.artist ?? r.artistName),
      track: text(r.track ?? r.title ?? r.name ?? r.trackName),
      album: text(r.album ?? r.albumName),
      timestamp: toStamp(rawTime(r)),
    }))
    .filter((r) => r.artist && r.track);
}

const active = (j: ImportJob | null | undefined) => !!j && ["uploading", "queued", "running"].includes(j.status);

// Polls every two seconds while an import is running on the server.
function useImportJob() {
  const [job, setJob] = useState<ImportJob | null | undefined>(undefined);
  const load = () =>
    api<ImportState>("/import")
      .then((r) => setJob(r.job))
      .catch(() => setJob((current) => (current === undefined ? null : current)));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!active(job)) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [job?.status, job?.id]);
  return [job, setJob] as const;
}

function importSource(job: ImportJob) {
  if (job.lastfmUser) return `Last.fm (${job.lastfmUser})`;
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
        Imported {plural(job.accepted, job.kind === "loved" ? "loved track" : "scrobble")} from {what}
        {skipped > 0 ? `, skipped ${num(skipped)} duplicates/errors` : ""}.
      </p>
    );
  }
  if (job.status === "failed") {
    return (
      <p className="form-error">
        The import from {what} stopped: {job.error}{" "}
        {job.accepted > 0 &&
          `${plural(job.accepted, job.kind === "loved" ? "loved track" : "scrobble")} imported before that stay.`}
      </p>
    );
  }
  if (job.status === "cancelled") {
    return (
      <p className="muted">
        The import from {what} was cancelled
        {job.accepted > 0 ? ` after ${plural(job.accepted, job.kind === "loved" ? "loved track" : "scrobble")}` : ""}.
      </p>
    );
  }

  if (job.status === "uploading") {
    return (
      <div className="import-progress">
        <p>An upload is pending. Keep its tab open, or cancel it to start over.</p>
        <Button kind="btn ghost small" type="button" onClick={onCancel}>
          Cancel import
        </Button>
      </div>
    );
  }

  let heading = `Matching ${what} to the catalogue…`;
  if (job.status === "queued") heading = `Waiting to start importing ${what}…`;
  else if (job.phase === "loved") heading = `Importing loved tracks from ${what}…`;

  return (
    <div className="import-progress" role="status">
      <div className="import-head">
        <Spinner />
        <b>{heading}</b>
      </div>
      <div className="import-track">
        <span style={{ width: `${job.status === "queued" ? 0 : Math.max(pct, 1)}%` }} />
      </div>
      <p className="muted small">
        {num(job.done)} of {job.total ? `about ${num(job.total)}` : "?"} done
        {job.accepted ? `, ${num(job.accepted)} added` : ""}. This carries on in the background: you can close the page
        and come back.
      </p>
      <Button kind="btn ghost small" type="button" onClick={onCancel}>
        Cancel import
      </Button>
    </div>
  );
}

export function ImportPage() {
  useTitle("Import listening history");
  const [job, setJob] = useImportJob();
  const [username, setUsername] = useState("");
  const [kind, setKind] = useState<"scrobbles" | "loved">("scrobbles");
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lastfm = useAction();
  const imp = useAction();
  const cancel = useAction();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const [what, setWhat] = useState<"scrobbles" | "loved">("scrobbles");
  const noun = what === "loved" ? "loved track" : "scrobble";
  const busy = job === undefined || active(job) || !!download || imp.busy;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!download && !imp.busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [!!download, imp.busy]);

  const fromLastfm = (event: FormEvent) => {
    event.preventDefault();
    if (busy || controller.current) return;
    lastfm.run(async () => {
      const aborter = new AbortController();
      controller.current = aborter;
      setDownload({ done: 0, total: 0 });
      try {
        const result = await importLastfm(username.trim(), kind, aborter.signal, (done, total) => {
          setDownload({ done, total });
        });
        setJob(result.job);
      } catch (error) {
        if (!aborter.signal.aborted) throw error;
      } finally {
        controller.current = null;
        setDownload(null);
      }
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
      if (!parsed.length)
        throw new Error("Nothing found in that file. Expected columns: artist, album, track, timestamp.");
      if (parsed.length > IMPORT_MAX) {
        throw new Error(
          `That file has ${num(parsed.length)} rows; an import can hold up to ${num(IMPORT_MAX)}. Split it and import it in parts.`
        );
      }
      if (/loved/i.test(file.name) || /"lovedtracks"/.test(body.slice(0, 2000))) setWhat("loved");
      setRows(parsed);
    });
  };

  // Rows go up in chunks; once all are there the server takes over and the page can be closed.
  const runImport = () =>
    imp.run(async () => {
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

  return (
    <div className="wrap page">
      <div className="mx-auto max-w-[700px]">
        <h1 className="page-title">Import listening history</h1>
        {job && !download && (
          <ImportProgress
            job={job}
            onCancel={() =>
              cancel.run(async () => {
                const result = await api<ImportState>(`/import/${job.id}`, { method: "DELETE" });
                setJob(result.job);
              })
            }
          />
        )}
        {cancel.note}
        <Section title="Import from Last.fm">
          <div className="card form">
            <form className="lastfm-import" onSubmit={fromLastfm}>
              <label>
                Last.fm username
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  required
                  maxLength={31}
                  disabled={busy}
                />
              </label>
              <Select
                label="What to import"
                disabled={busy}
                value={kind}
                onChange={(value) => setKind(value === "loved" ? "loved" : "scrobbles")}
                options={[
                  ["scrobbles", "Scrobbles"],
                  ["loved", "Loved tracks"],
                ]}
              />
              <Button kind="btn" disabled={busy || !username.trim()}>
                Import from Last.fm
              </Button>
            </form>
            {download && (
              <div className="import-progress">
                <p>
                  Keep this tab open until the upload finishes. Afterwards, Sonosphere can finish in the background.
                </p>
                <p role="status" className="tabular-nums">
                  {download.total
                    ? `Downloaded ${num(download.done)} of ${num(download.total)} tracks`
                    : "Connecting to Last.fm…"}
                </p>
                {download.total > 0 && (
                  <progress
                    className="w-full accent-site-accent"
                    aria-label="Last.fm download progress"
                    value={download.done}
                    max={download.total}
                  />
                )}
                <Button kind="btn ghost small" type="button" onClick={() => controller.current?.abort()}>
                  Cancel download
                </Button>
              </div>
            )}
            {lastfm.note}
            <a className="muted small" href="https://www.last.fm/">
              Powered by AudioScrobbler
            </a>
          </div>
        </Section>
        <Section title="Import a file">
          <fieldset className="card form" disabled={busy}>
            <p>
              Import scrobbles or loved tracks from a CSV or JSON file. CSV columns:{" "}
              <code>artist, album, track, timestamp</code> (Unix seconds or ISO date; only artist and track are
              required).
            </p>
            <div className="tabs sub" role="group" aria-label="What the file contains">
              <button
                type="button"
                className={what === "scrobbles" ? "active" : ""}
                aria-pressed={what === "scrobbles"}
                onClick={() => setWhat("scrobbles")}
              >
                Scrobbles
              </button>
              <button
                type="button"
                className={what === "loved" ? "active" : ""}
                aria-pressed={what === "loved"}
                onClick={() => setWhat("loved")}
              >
                Loved tracks
              </button>
            </div>
            <label>
              File
              <Input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            {rows && (
              <>
                <p>
                  <b>{plural(rows.length, noun)}</b> found in {fileName}. First rows:
                </p>
                <table className="chartlist compact">
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="c-name">
                          <span className="strong">{r.track}</span>
                          <span className="muted">
                            {r.artist}
                            {r.album && ` · ${r.album}`}
                          </span>
                        </td>
                        <td className="c-time">
                          {r.timestamp ? dateTime(r.timestamp) : what === "loved" ? "" : "now"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button kind="btn" type="button" loading={imp.busy} onClick={runImport}>
                  {imp.busy ? progress || "Uploading…" : `Import ${plural(rows.length, noun)}`}
                </Button>
                {imp.busy && (
                  <p className="muted small">
                    Keep this page open until the upload finishes; after that it carries on without it.
                  </p>
                )}
              </>
            )}

            {imp.note}
          </fieldset>
        </Section>
      </div>
    </div>
  );
}
