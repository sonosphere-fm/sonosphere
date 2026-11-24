import { describe, expect, test } from "bun:test";
import { pickMain, type MainCandidate } from "./main";

const candidate = (
  entryId: number,
  score: number,
  createdAt = entryId,
  imageId = `image-${entryId}`
): MainCandidate => ({
  entryId,
  imageId,
  score,
  createdAt,
});

describe("pickMain", () => {
  test("an empty gallery has no main image", () => {
    expect(pickMain([], null)).toBeNull();
    expect(pickMain([], "gone")).toBeNull();
  });

  test("the highest score wins", () => {
    const chosen = pickMain([candidate(1, 2), candidate(2, 5), candidate(3, 1)], "image-1");
    expect(chosen?.entryId).toBe(2);
  });

  test("a tie keeps the current main image", () => {
    const chosen = pickMain([candidate(1, 3), candidate(2, 3, 9)], "image-2");
    expect(chosen?.entryId).toBe(2);
  });

  test("a tie without a current main goes to the earliest image", () => {
    const chosen = pickMain([candidate(1, 3, 20), candidate(2, 3, 10), candidate(3, 1, 1)], null);
    expect(chosen?.entryId).toBe(2);
  });

  test("a current main that is no longer in the gallery does not block the winner", () => {
    const chosen = pickMain([candidate(1, 4), candidate(2, 2)], "removed");
    expect(chosen?.entryId).toBe(1);
  });

  test("negative scores still pick a main image", () => {
    const chosen = pickMain([candidate(1, -1), candidate(2, -4)], "image-2");
    expect(chosen?.entryId).toBe(1);
  });

  test("removing the leader promotes the next image", () => {
    const chosen = pickMain([candidate(2, 1), candidate(3, -1)], "image-1");
    expect(chosen?.entryId).toBe(2);
  });
});
