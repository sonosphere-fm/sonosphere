import { expect, test } from "bun:test";
import { canUndoUsername, USERNAME_COOLDOWN, USERNAME_RESERVATION } from "./username-policy";
import { usernameRedirect } from "../../shared/username-redirect";

test("undo expires at exactly 14 days and cannot undo an undo", () => {
  const change = { isUndo: false, undoneAt: null, releasedAt: null, reservedUntil: 100 + USERNAME_RESERVATION };
  expect(USERNAME_COOLDOWN).toBe(604800);
  expect(canUndoUsername(change, change.reservedUntil - 1)).toBe(true);
  expect(canUndoUsername(change, change.reservedUntil)).toBe(false);
  expect(canUndoUsername({ ...change, isUndo: true }, 101)).toBe(false);
  expect(canUndoUsername({ ...change, undoneAt: 101 }, 102)).toBe(false);
});

test("redirect preserves deep paths, query and hash without redirecting canonical names", () => {
  expect(usernameRedirect(new URL("https://sonosphere.fm/user/old/library/tracks?page=2#plays"), "new")).toBe(
    "/user/new/library/tracks?page=2#plays"
  );
  expect(usernameRedirect(new URL("https://sonosphere.fm/user/new"), "new")).toBeNull();
  expect(usernameRedirect(new URL("https://sonosphere.fm/user/%ZZ"), "new")).toBeNull();
});
