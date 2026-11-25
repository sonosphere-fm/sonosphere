import { bad, fail } from "../http";
import * as jellyfin from "../jellyfin/service";
import * as subsonic from "../subsonic/service";
import * as repo from "./repo";
import {
  isMusicKind,
  type MusicAuth,
  type MusicConnectBody,
  type MusicSource,
  type MusicStatus,
} from "../../shared/music";

async function active(userId: number) {
  const found = await repo.findActive(userId);
  if (!found) return fail(404, "musicServerNotConnected");
  return found;
}

export async function status(userId: number): Promise<MusicStatus> {
  const found = await repo.findActive(userId);
  if (!found) return { connected: false };
  return {
    connected: true,
    kind: found.kind,
    url: found.link.url,
    username: found.link.username,
    name: found.link.name,
    version: found.link.version,
  };
}

export async function connect(userId: number, body: MusicConnectBody): Promise<MusicStatus> {
  if (!isMusicKind(body.kind)) return bad("pickMusicServerKind");
  if (body.kind === "subsonic") {
    await subsonic.connect(userId, { url: body.url, username: body.username, password: body.password });
  } else {
    await jellyfin.connect(userId, { url: body.url, username: body.username, password: body.password });
  }
  await repo.removeOther(userId, body.kind);
  return status(userId);
}

export async function disconnect(userId: number): Promise<void> {
  await subsonic.disconnect(userId);
  await jellyfin.disconnect(userId);
}

export async function auth(userId: number): Promise<MusicAuth> {
  const found = await active(userId);
  return found.kind === "subsonic" ? subsonic.auth(userId) : jellyfin.auth(userId);
}

export async function source(userId: number, artist: string, track: string): Promise<MusicSource> {
  const found = await active(userId);
  return found.kind === "subsonic" ? subsonic.source(userId, artist, track) : jellyfin.source(userId, artist, track);
}

export async function streamById(userId: number, id: string, range: string | null): Promise<Response> {
  const found = await active(userId);
  return found.kind === "subsonic" ? subsonic.streamById(userId, id, range) : jellyfin.streamById(userId, id, range);
}
