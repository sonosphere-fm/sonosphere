import { expect, test } from "bun:test";
import { requiresApp } from "./access";

test("public reads do not require an API key", () => {
  for (const method of [
    "album.getinfo",
    "artist.getinfo",
    "chart.gettoptracks",
    "geo.gettoptracks",
    "library.getartists",
    "tag.gettoptracks",
    "track.getinfo",
    "user.getrecenttracks",
  ])
    expect(requiresApp(method, undefined)).toBe(false);
});

test("public reads with a session still require an API key", () => {
  expect(requiresApp("user.getinfo", "session-key")).toBe(true);
  expect(requiresApp("track.getinfo", "session-key")).toBe(true);
});

test("auth and write methods always require an API key", () => {
  for (const method of [
    "auth.gettoken",
    "auth.getsession",
    "auth.getmobilesession",
    "track.scrobble",
    "track.updatenowplaying",
    "track.love",
    "track.unlove",
    "artist.addtags",
    "album.removetag",
    "track.removetag",
  ])
    expect(requiresApp(method, undefined)).toBe(true);
});
