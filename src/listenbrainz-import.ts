import { IMPORT_MAX, type ImportRow } from "../shared/imports";
import { t } from "./i18n";

export type ListenBrainzExport = {
  username: string | null;
  listens: ImportRow[];
  feedback: ImportRow[];
};

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;
const MAX_FILE = 64 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;

type Entry = { name: string; method: number; size: number; compressed: number; offset: number };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 512) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const mbidOf = (v: unknown) => {
  const s = str(v, 36).toLowerCase();
  return UUID.test(s) ? s : undefined;
};
const stamp = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

function directory(buffer: ArrayBuffer): Entry[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (view.getUint32(p, true) === EOCD) {
      end = p;
      break;
    }
  }
  if (end < 0) throw new Error(t("player.lbNotZip"));
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const entries: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error(t("player.lbDamaged"));
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: view.getUint16(p + 10, true),
      compressed: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(bytes: Uint8Array, method: number, size: number): Promise<Uint8Array> {
  if (method === 0) {
    if (bytes.length !== size) throw new Error(t("player.lbDamaged"));
    return bytes;
  }
  if (method !== 8) throw new Error(t("player.lbCompression"));
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Response(body).body!.pipeThrough(new DecompressionStream("deflate-raw"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.length !== size) throw new Error(t("player.lbDamaged"));
  return out;
}

export async function readExportFiles(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const files = new Map<string, string>();
  let total = 0;
  for (const e of directory(buffer)) {
    if (!/\.jsonl?$/.test(e.name)) continue;
    if (e.size > MAX_FILE || total + e.size > MAX_TOTAL) throw new Error(t("player.lbTooLarge"));
    if (view.getUint32(e.offset, true) !== LOCAL) throw new Error(t("player.lbDamaged"));
    const nameLen = view.getUint16(e.offset + 26, true);
    const extraLen = view.getUint16(e.offset + 28, true);
    const start = e.offset + 30 + nameLen + extraLen;
    const data = await inflate(bytes.subarray(start, start + e.compressed), e.method, e.size);
    total += e.size;
    files.set(e.name, new TextDecoder().decode(data));
  }
  return files;
}

function lines(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s || s[0] !== "{") continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // One broken line must not cost the rest of an export.
    }
  }
  return out;
}

function listen(v: unknown): ImportRow | null {
  if (!isObj(v)) return null;
  const meta = isObj(v.track_metadata) ? v.track_metadata : {};
  const info = isObj(meta.additional_info) ? meta.additional_info : {};
  const mapping = isObj(meta.mbid_mapping) ? meta.mbid_mapping : isObj(v.mbid_mapping) ? v.mbid_mapping : {};
  const artist = str(meta.artist_name);
  const track = str(meta.track_name);
  if (!artist || !track) return null;
  const recordingMbid = mbidOf(mapping.recording_mbid) ?? mbidOf(info.recording_mbid);
  const timestamp = stamp(v.listened_at) ?? stamp(v.inserted_at);
  return {
    artist,
    track,
    album: str(meta.release_name),
    ...(timestamp ? { timestamp } : {}),
    ...(recordingMbid ? { recordingMbid } : {}),
  };
}

function feedback(v: unknown): ImportRow | null {
  if (!isObj(v)) return null;
  const recordingMbid = mbidOf(v.recording_mbid);
  if (!recordingMbid) return null;
  const score = Number(v.score);
  if (score !== 1 && score !== -1) return null;
  const created = stamp(v.created);
  return {
    artist: "",
    track: "",
    album: "",
    recordingMbid,
    score,
    ...(created ? { timestamp: created } : {}),
  };
}

export async function parseListenBrainzZip(buffer: ArrayBuffer): Promise<ListenBrainzExport> {
  const files = await readExportFiles(buffer);
  const listens: ImportRow[] = [];
  const feedbackRows: ImportRow[] = [];
  // Month files sort chronologically, and feedback is kept apart so MBIDs are saved before loves are resolved.
  entries: for (const [name, text] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (/^listens\/.+\.jsonl$/.test(name)) {
      for (const row of lines(text)) {
        const r = listen(row);
        if (r) listens.push(r);
        if (listens.length + feedbackRows.length >= IMPORT_MAX) break entries;
      }
    } else if (name === "feedback.jsonl") {
      for (const row of lines(text)) {
        const r = feedback(row);
        if (r) feedbackRows.push(r);
      }
    }
  }
  // Feedback only names a recording, so borrow the names from the listens that carried the same MBID for the preview.
  const byMbid = new Map<string, ImportRow>();
  for (const l of listens) if (l.recordingMbid && !byMbid.has(l.recordingMbid)) byMbid.set(l.recordingMbid, l);
  for (const f of feedbackRows) {
    const source = f.recordingMbid && byMbid.get(f.recordingMbid);
    if (source) {
      f.artist = source.artist;
      f.track = source.track;
      f.album = source.album;
    }
  }
  let username: string | null = null;
  try {
    const user: unknown = JSON.parse(files.get("user.json") ?? "");
    if (isObj(user) && typeof user.username === "string") username = str(user.username, 64) || null;
  } catch {
    // The name is only used as a label; an absent or broken user.json is harmless.
  }
  if (!listens.length && !feedbackRows.length) throw new Error(t("player.lbEmpty"));
  return { username, listens, feedback: feedbackRows };
}
