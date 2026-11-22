import { expect, test } from "bun:test";
import { profileLinks, storedProfileLinks } from "./profile-links";

test("profile links accept labels and web URLs, rejecting unsafe or excessive input", () => {
  expect(profileLinks([{ label: " Bandcamp ", url: " https://example.com/music " }])).toEqual([
    { label: "Bandcamp", url: "https://example.com/music" },
  ]);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "/relative", "https://name:password@example.com"]) {
    expect(profileLinks([{ label: "Test", url }])).toBeNull();
  }
  expect(profileLinks(Array.from({ length: 9 }, () => ({ label: "Test", url: "https://example.com" })))).toBeNull();
  expect(profileLinks([{ label: "x".repeat(61), url: "https://example.com" }])).toBeNull();
  expect(storedProfileLinks("invalid json")).toEqual([]);
});
