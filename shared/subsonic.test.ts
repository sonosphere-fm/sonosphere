import { describe, expect, test } from "bun:test";
import { albumWebUrl, pickSongs } from "./subsonic";

describe("pickSongs", () => {
  test("keeps the closest audio matches and their albums", () => {
    const songs = [
      { id: "1", title: "Other", artist: "Someone", albumId: "x" },
      { id: "2", title: "Song (Remastered)", artist: "The Artist", albumId: "al2" },
      { id: "3", title: "Song", artist: "Artist feat. X" },
      { id: "4", title: "Song", artist: "The Artist", isVideo: true },
      { id: "5", title: "Song", artist: "The Artist", type: "podcast" },
      { id: "6", title: "Song", artist: "The Artist", albumId: 6 },
      { id: "2", title: "Song (Remastered)", artist: "The Artist", albumId: "al2" },
    ];
    expect(pickSongs(songs, "The Artist", "Song")).toEqual([
      { id: "2", albumId: "al2" },
      { id: "6", albumId: "6" },
      { id: "3", albumId: null },
    ]);
  });

  test("returns nothing when the search found other music", () => {
    expect(pickSongs([{ id: "1", title: "Other", artist: "Someone" }], "The Artist", "Song")).toEqual([]);
  });

  test("accepts a single song object", () => {
    expect(pickSongs({ id: "7", title: "Song", artist: "The Artist" }, "The Artist", "Song")).toEqual([
      { id: "7", albumId: null },
    ]);
  });
});

describe("albumWebUrl", () => {
  test("links the album in Navidrome", () => {
    expect(albumWebUrl("https://music.example.com", "navidrome", "al 1")).toBe(
      "https://music.example.com/app/#/album/al%201/show"
    );
    expect(albumWebUrl("https://music.example.com/music", "Navidrome", "al1")).toBe(
      "https://music.example.com/music/app/#/album/al1/show"
    );
  });

  test("falls back to the server when its web route is unknown", () => {
    expect(albumWebUrl("https://music.example.com", "gonic", "al1")).toBe("https://music.example.com");
    expect(albumWebUrl("https://music.example.com", "navidrome", null)).toBe("https://music.example.com");
  });
});
