import { useEffect, useRef, useState, type FormEvent } from "react";
import { IMPORT_CHUNK, IMPORT_MAX, type ImportJob, type ImportRow, type ImportState } from "../../shared/imports";
import { Spinner } from "../icons";
import { Button, Input, Select } from "../kit";
import { importLastfm } from "../lastfm-import";
import { parseListenBrainzZip } from "../listenbrainz-import";
import { api, dateTime, num, TITLES, useTitle } from "../lib";
import { t, tx } from "../i18n";
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

export function parseImport(name: string, body: string): ImportRow[] {
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

export const active = (j: ImportJob | null | undefined) => !!j && ["uploading", "queued", "running"].includes(j.status);

// Polls every two seconds while an import is running on the server.
export function useImportJob() {
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
  if (job.lastfmUser) return t("player.sourceLastfm", { user: job.lastfmUser });
  if (job.kind === "listenbrainz") return t("player.sourceListenBrainz");
  if (job.kind === "loved") return t("player.sourceLoved");
  return t("player.sourceFile");
}

const countOf = (loved: boolean, count: number) => t(loved ? "player.lovedCount" : "player.scrobbleCount", { count });

function ImportProgress({ job, onCancel }: { job: ImportJob; onCancel: () => void }) {
  const what = importSource(job);
  const pct = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
  const skipped = job.done - job.accepted;
  const items = countOf(job.kind === "loved", job.accepted);

  if (job.status === "done") {
    return (
      <p className="form-ok">
        {skipped > 0
          ? t("player.importDoneSkipped", { items, what, skipped: num(skipped) })
          : t("player.importDone", { items, what })}
      </p>
    );
  }
  if (job.status === "failed") {
    return (
      <p className="form-error">
        {job.accepted > 0
          ? t("player.importFailedKept", { what, error: job.error ?? "", items })
          : t("player.importFailed", { what, error: job.error ?? "" })}
      </p>
    );
  }
  if (job.status === "cancelled") {
    return (
      <p className="muted">
        {job.accepted > 0 ? t("player.importCancelledAfter", { what, items }) : t("player.importCancelled", { what })}
      </p>
    );
  }

  if (job.status === "uploading") {
    return (
      <div className="import-progress">
        <p>{t("player.uploadPending")}</p>
        <Button kind="btn ghost small" type="button" onClick={onCancel}>
          {t("player.cancelImport")}
        </Button>
      </div>
    );
  }

  let heading = t("player.matching", { what });
  if (job.status === "queued") heading = t("player.waitingToStart", { what });
  else if (job.phase === "loved") heading = t("player.importingLoved", { what });
  const counts = { done: num(job.done), total: num(job.total), added: num(job.accepted) };
  let done = t("player.progressUnknown", counts);
  if (job.total) done = t(job.accepted ? "player.progressAboutAdded" : "player.progressAbout", counts);
  else if (job.accepted) done = t("player.progressUnknownAdded", counts);

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
        {done} {t("player.carriesOn")}
      </p>
      <Button kind="btn ghost small" type="button" onClick={onCancel}>
        {t("player.cancelImport")}
      </Button>
    </div>
  );
}

export function ImportPage() {
  useTitle(TITLES.import);
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
  const [fromUser, setFromUser] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [what, setWhat] = useState<"scrobbles" | "loved" | "listenbrainz">("scrobbles");
  const items = (count: number) => countOf(what === "loved", count);
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
    setFromUser(null);
    setProgress("");
    const zip = file.name.toLowerCase().endsWith(".zip");
    imp.run(async () => {
      let parsed: ImportRow[];
      if (zip) {
        setProgress(t("player.readingListenBrainz"));
        const exportData = await parseListenBrainzZip(await file.arrayBuffer());
        // Feedback goes last: the scrobbles above it save the recording IDs that loves are matched against.
        parsed = [...exportData.listens, ...exportData.feedback];
        setFromUser(exportData.username);
        setWhat("listenbrainz");
      } else {
        const body = await file.text();
        parsed = parseImport(file.name, body);
        if (/loved/i.test(file.name) || /"lovedtracks"/.test(body.slice(0, 2000))) setWhat("loved");
        else setWhat("scrobbles");
      }
      if (!parsed.length) throw new Error(zip ? t("player.lbNoListens") : t("player.fileNothingFound"));
      if (parsed.length > IMPORT_MAX) {
        throw new Error(t("player.fileTooBig", { rows: num(parsed.length), max: num(IMPORT_MAX) }));
      }
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
        setProgress(t("player.uploadingOf", { done: num(Math.min(end, all.length)), total: num(all.length) }));
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
        <h1 className="page-title">{t("player.importTitle")}</h1>
        <div className="import-status">
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
        </div>
        <Section title={t("player.importFromLastfm")}>
          <div className="card form">
            <form className="import-row" onSubmit={fromLastfm}>
              <label>
                {t("player.lastfmUsername")}
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
                label={t("player.whatToImport")}
                disabled={busy}
                value={kind}
                onChange={(value) => setKind(value === "loved" ? "loved" : "scrobbles")}
                options={[
                  ["scrobbles", t("player.scrobbles")],
                  ["loved", t("player.lovedTracks")],
                ]}
              />
              <Button kind="btn" disabled={busy || !username.trim()}>
                {t("player.importFromLastfm")}
              </Button>
            </form>
            {download && (
              <div className="import-progress">
                <p>{t("player.keepTabOpen")}</p>
                <p role="status" className="tabular-nums">
                  {download.total
                    ? t("player.downloaded", { done: num(download.done), total: num(download.total) })
                    : t("player.connectingLastfm")}
                </p>
                {download.total > 0 && (
                  <progress
                    className="w-full accent-site-accent"
                    aria-label={t("player.lastfmDownloadProgress")}
                    value={download.done}
                    max={download.total}
                  />
                )}
                <Button kind="btn ghost small" type="button" onClick={() => controller.current?.abort()}>
                  {t("player.cancelDownload")}
                </Button>
              </div>
            )}
            {lastfm.note}
          </div>
        </Section>
        <Section title={t("player.importFile")}>
          <fieldset className="card form" disabled={busy}>
            <p>
              {tx("player.fileIntro", {
                artist: <code>artist</code>,
                album: <code>album</code>,
                track: <code>track</code>,
                timestamp: <code>timestamp</code>,
              })}
            </p>
            <div className="import-row">
              <label>
                {t("player.file")}
                <Input
                  type="file"
                  accept=".csv,.json,.zip,text/csv,application/json,application/zip,application/x-zip-compressed"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
              </label>
              <Select
                label={t("player.whatFileContains")}
                disabled={busy}
                value={what}
                onChange={(value) =>
                  setWhat(value === "loved" ? "loved" : value === "listenbrainz" ? "listenbrainz" : "scrobbles")
                }
                options={[
                  ["scrobbles", t("player.scrobbles")],
                  ["loved", t("player.lovedTracks")],
                  ["listenbrainz", t("player.listenBrainzExport")],
                ]}
              />
            </div>
            {rows && (
              <>
                <p>
                  {tx(fromUser ? "player.foundFromUser" : "player.found", {
                    items: <b>{items(rows.length)}</b>,
                    file: fileName,
                    user: fromUser ?? "",
                  })}
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
                          {r.timestamp ? dateTime(r.timestamp) : r.score || what === "loved" ? "" : t("player.now")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button kind="btn" type="button" loading={imp.busy} onClick={runImport}>
                  {imp.busy
                    ? progress || t("player.uploading")
                    : t("player.importItems", { items: items(rows.length) })}
                </Button>
                {imp.busy && <p className="muted small">{t("player.keepPageOpen")}</p>}
              </>
            )}

            {imp.note}
          </fieldset>
        </Section>
      </div>
    </div>
  );
}
