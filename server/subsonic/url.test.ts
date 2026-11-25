import { describe, expect, test } from "bun:test";
import { isPrivateAddress, parseServerUrl, pickSongs } from "./url";

describe("parseServerUrl", () => {
  test("keeps a plain server address", () => {
    expect(parseServerUrl("https://music.example.com")).toEqual({
      ok: true,
      base: "https://music.example.com",
      host: "music.example.com",
    });
  });

  test("drops a trailing slash and a rest path", () => {
    expect(parseServerUrl("https://music.example.com/navidrome/rest/")).toMatchObject({
      ok: true,
      base: "https://music.example.com/navidrome",
    });
    expect(parseServerUrl("http://localhost:4533/rest/ping.view")).toMatchObject({
      ok: true,
      base: "http://localhost:4533",
    });
  });

  test("rejects addresses that hide something else", () => {
    expect(parseServerUrl("ftp://music.example.com").ok).toBe(false);
    expect(parseServerUrl("https://user:pass@music.example.com").ok).toBe(false);
    expect(parseServerUrl("https://music.example.com/?token=1").ok).toBe(false);
    expect(parseServerUrl("https://music.example.com/#x").ok).toBe(false);
    expect(parseServerUrl("not a url").ok).toBe(false);
    expect(parseServerUrl("").ok).toBe(false);
  });
});

describe("isPrivateAddress", () => {
  test.each([
    "127.0.0.1",
    "127.255.255.255",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::7f00:1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
  ])("blocks %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  test.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.15.0.1",
    "172.32.0.1",
    "100.63.255.255",
    "100.128.0.1",
    "64:ff9b::808:808",
    "2606:4700:4700::1111",
    "example.com",
  ])("allows %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("pickSongs", () => {
  test("keeps the closest audio matches and drops everything else", () => {
    const songs = [
      { id: "1", title: "Other", artist: "Someone" },
      { id: "2", title: "Song (Remastered)", artist: "The Artist" },
      { id: "3", title: "Song", artist: "Artist feat. X" },
      { id: "4", title: "Song", artist: "The Artist", isVideo: true },
      { id: "5", title: "Song", artist: "The Artist", type: "podcast" },
      { id: "6", title: "Song", artist: "The Artist" },
      { id: "2", title: "Song (Remastered)", artist: "The Artist" },
    ];
    expect(pickSongs(songs, "The Artist", "Song")).toEqual(["2", "6", "3"]);
  });

  test("returns nothing when the search found other music", () => {
    expect(pickSongs([{ id: "1", title: "Other", artist: "Someone" }], "The Artist", "Song")).toEqual([]);
  });

  test("accepts a single song object", () => {
    expect(pickSongs({ id: "7", title: "Song", artist: "The Artist" }, "The Artist", "Song")).toEqual(["7"]);
  });
});
