import { deflateRawSync } from "node:zlib";
import { describe, expect, test } from "bun:test";
import { parseListenBrainzZip, readExportFiles } from "./listenbrainz-import";

type Entry = { name: string; body: string; method?: number; declaredSize?: number };

/** A small ZIP writer so the tests do not depend on a real export being present. */
function makeZip(entries: Entry[]): ArrayBuffer {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const plain = enc.encode(e.body);
    const method = e.method ?? 8;
    const data = method === 0 ? plain : deflateRawSync(plain);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, plain.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, e.declaredSize ?? plain.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out.buffer;
}

const MBID = "7d2abe26-7733-4bb7-bc34-32895f1eb8d7";
const OTHER = "c6fad580-504a-4a0a-9ee4-19d63848b69c";

describe("ListenBrainz export parsing", () => {
  test("reads listens, recording IDs and feedback", async () => {
    const zip = makeZip([
      { name: "user.json", body: JSON.stringify({ user_id: 1, username: "Tester" }) },
      {
        name: "listens/2025/1.jsonl",
        body: [
          JSON.stringify({
            listened_at: 1735334599.0,
            inserted_at: 1757235240,
            track_metadata: {
              artist_name: "Kanye West",
              track_name: "Cold",
              release_name: "Cold",
              additional_info: { submission_client: "importer", duration_ms: 150000 },
              mbid_mapping: { recording_mbid: MBID, recording_name: "Cold" },
            },
          }),
          JSON.stringify({
            listened_at: 1735334802,
            track_metadata: { artist_name: "Someone", track_name: "A song", mbid_mapping: null },
          }),
          JSON.stringify({
            listened_at: 1735335000,
            track_metadata: { artist_name: "Other", track_name: "Title", additional_info: { recording_mbid: OTHER } },
          }),
        ].join("\n"),
      },
      {
        name: "feedback.jsonl",
        body: [
          JSON.stringify({ score: 1, created: 1774030004, recording_mbid: MBID, recording_msid: null }),
          JSON.stringify({ score: -1, created: 1774030005, recording_mbid: OTHER, recording_msid: null }),
        ].join("\n"),
      },
    ]);
    const result = await parseListenBrainzZip(zip);
    expect(result.username).toBe("Tester");
    expect(result.listens).toEqual([
      { artist: "Kanye West", track: "Cold", album: "Cold", timestamp: 1735334599, recordingMbid: MBID },
      { artist: "Someone", track: "A song", album: "", timestamp: 1735334802 },
      { artist: "Other", track: "Title", album: "", timestamp: 1735335000, recordingMbid: OTHER },
    ]);
    expect(result.feedback).toHaveLength(2);
    expect(result.feedback[0]).toMatchObject({ recordingMbid: MBID, score: 1, timestamp: 1774030004 });
    // Feedback has no names of its own; the matching listen supplies them for the preview.
    expect(result.feedback[0]).toMatchObject({ artist: "Kanye West", track: "Cold" });
    expect(result.feedback[1]!.score).toBe(-1);
  });

  test("reads stored entries and ignores unrelated or broken rows", async () => {
    const zip = makeZip([
      { name: "notes.txt", body: "ignore me", method: 0 },
      { name: "listens/old.csv", body: "artist,track" },
      {
        name: "listens/2025/2.jsonl",
        method: 0,
        body: [
          "not json",
          JSON.stringify({}),
          JSON.stringify({ track_metadata: { artist_name: "A", track_name: "T" }, listened_at: 1735334802 }),
        ].join("\n"),
      },
    ]);
    expect([...(await readExportFiles(zip)).keys()]).toEqual(["listens/2025/2.jsonl"]);
    const result = await parseListenBrainzZip(zip);
    expect(result.listens).toEqual([{ artist: "A", track: "T", album: "", timestamp: 1735334802 }]);
    expect(result.feedback).toEqual([]);
    expect(result.username).toBe(null);
  });

  test("rejects archives or entries it cannot read", async () => {
    await expect(parseListenBrainzZip(new TextEncoder().encode("not a zip").buffer)).rejects.toThrow(
      /isn't a ListenBrainz export ZIP/
    );
    await expect(
      parseListenBrainzZip(makeZip([{ name: "listens/2025/1.jsonl", body: "{}", method: 12 }]))
    ).rejects.toThrow(/unsupported compression/);
    await expect(
      parseListenBrainzZip(makeZip([{ name: "listens/2025/1.jsonl", body: "{}", declaredSize: 64 * 1024 * 1024 + 1 }]))
    ).rejects.toThrow(/too large/);
    await expect(parseListenBrainzZip(makeZip([{ name: "user.json", body: '{"username":"x"}' }]))).rejects.toThrow(
      /No listens or feedback/
    );
  });
});
