import { describe, expect, test } from "bun:test";
import { jellyfinAlbumUrl, pickJellyfin } from "./jellyfin";

describe("pickJellyfin", () => {
  test("keeps the closest audio items and their albums", () => {
    const items = [
      { Id: "1", Name: "Other", Artists: ["Someone"], AlbumId: "x", Type: "Audio" },
      { Id: "2", Name: "Song (Remastered)", Artists: ["The Artist"], AlbumId: "al2", Type: "Audio" },
      { Id: "3", Name: "Song", Artists: ["Artist feat. X"], Type: "Audio" },
      { Id: "4", Name: "Song", Artists: ["The Artist"], Type: "MusicVideo" },
      { Id: "5", Name: "Song", Artists: ["The Artist"], AlbumId: 5, Type: "Audio" },
      { Id: "2", Name: "Song (Remastered)", Artists: ["The Artist"], AlbumId: "al2", Type: "Audio" },
    ];
    expect(pickJellyfin(items, "The Artist", "Song")).toEqual([
      { id: "2", albumId: "al2" },
      { id: "5", albumId: "5" },
      { id: "3", albumId: null },
    ]);
  });

  test("falls back to the album artist", () => {
    const items = [{ Id: "7", Name: "Song", AlbumArtist: "The Artist", Type: "Audio" }];
    expect(pickJellyfin(items, "The Artist", "Song")).toEqual([{ id: "7", albumId: null }]);
  });

  test("returns nothing when the search found other music", () => {
    expect(
      pickJellyfin([{ Id: "1", Name: "Other", Artists: ["Someone"], Type: "Audio" }], "The Artist", "Song")
    ).toEqual([]);
  });
});

describe("jellyfinAlbumUrl", () => {
  test("links the album in the web interface", () => {
    expect(jellyfinAlbumUrl("https://media.example.com", "al 1")).toBe(
      "https://media.example.com/web/index.html#!/details?id=al%201"
    );
    expect(jellyfinAlbumUrl("https://media.example.com/jellyfin", "al1")).toBe(
      "https://media.example.com/jellyfin/web/index.html#!/details?id=al1"
    );
  });

  test("falls back to the web home page", () => {
    expect(jellyfinAlbumUrl("https://media.example.com", null)).toBe("https://media.example.com/web/index.html");
  });
});
