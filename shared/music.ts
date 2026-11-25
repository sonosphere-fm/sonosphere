import type { JellyfinAuth } from "./jellyfin";
import type { SubsonicAuth } from "./subsonic";

export const MUSIC_KINDS = ["subsonic", "jellyfin"] as const;
export type MusicKind = (typeof MUSIC_KINDS)[number];

export const isMusicKind = (v: unknown): v is MusicKind =>
  typeof v === "string" && (MUSIC_KINDS as readonly string[]).includes(v);

export type MusicStatus =
  | { connected: false }
  | {
      connected: true;
      kind: MusicKind;
      url: string;
      username: string;
      name: string;
      version: string;
    };

export type MusicConnectBody = { kind: MusicKind; url: string; username: string; password: string };

export type MusicAuth = SubsonicAuth | JellyfinAuth;

/** The proxy route for a resolved song, used when the browser cannot reach the server. */
export type MusicSource = { proxy: string; albumUrl: string };
