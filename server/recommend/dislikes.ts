import type { DislikeKind } from "../../shared/recommend";

const DAY = 86_400;
// how much of a "not interested" lands on the item's artist: all of it for the artist, part for one album or track
const SHARE: Record<DislikeKind, number> = { artist: 1, album: 0.5, track: 0.35 };
// fades over about a year, so taste can come back around
const FADE = 365 * DAY;

export const isDislikeKind = (v: unknown): v is DislikeKind => typeof v === "string" && v in SHARE;

export const dislikeWeight = (kind: string, at: number, now: number) =>
  isDislikeKind(kind) ? SHARE[kind] * Math.exp(-Math.max(0, now - at) / FADE) : 0;
