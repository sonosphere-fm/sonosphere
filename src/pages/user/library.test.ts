import { expect, test } from "bun:test";
import { rangeIds } from "./library";

const ids = [11, 22, 33, 44, 55];

test("spans anchor to target inclusive, in both directions", () => {
  expect(rangeIds(ids, 22, 44)).toEqual([22, 33, 44]);
  expect(rangeIds(ids, 44, 22)).toEqual([22, 33, 44]);
});

test("a single row is its own range", () => {
  expect(rangeIds(ids, 33, 33)).toEqual([33]);
});

test("full page when the ends are the first and last rows", () => {
  expect(rangeIds(ids, 11, 55)).toEqual(ids);
});

test("empty without an anchor or when an end is off the page", () => {
  expect(rangeIds(ids, null, 33)).toEqual([]);
  expect(rangeIds(ids, 99, 33)).toEqual([]);
  expect(rangeIds(ids, 22, 99)).toEqual([]);
  expect(rangeIds([], null, 33)).toEqual([]);
});
