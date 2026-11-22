import { useState, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link } from "react-router-dom";
import { Spinner } from "../icons";
import { api, num, qs, TITLES, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Art, Async, Section, useAction } from "../ui/base";
import { Suggest } from "../ui/suggest";
import { TrackList } from "../ui/lists";
import { DatePicker, toLocal } from "../datepicker";
import type { ScrobbleResponse } from "../../shared/listening";
import type { SearchResults } from "../../shared/search";
import type { UserRecent } from "../../shared/users";

const local = () => toLocal(new Date());
const minsAgo = (m: number) => () => new Date(Date.now() - m * 60000);
const PRESETS: [string, () => Date][] = [
  ["Just now", minsAgo(0)],
  ["5 min ago", minsAgo(5)],
  ["30 min ago", minsAgo(30)],
  ["1 hour ago", minsAgo(60)],
  ["Yesterday", minsAgo(1440)],
];

const search = (q: string, type: "artists" | "albums" | "tracks") =>
  api<SearchResults>(`/search${qs({ q, type, limit: type === "artists" ? 6 : 12 })}`);

export function ScrobblePage() {
  const { me } = useAuth();
  const [f, setF] = useState({ artist: "", track: "", album: "", when: local() });
  const act = useAction();
  const recent = useApi<UserRecent>(`/user/recent${qs({ name: me!.username, limit: 5 })}`);
  useTitle(TITLES.scrobble);

  // Matches by the artist already typed come first.
  const byTypedArtist = <T extends { artist: string }>(items: T[]) => {
    const a = f.artist.trim().toLowerCase();
    if (!a) return items;
    const matches = (x: T) => Number(x.artist.toLowerCase() === a);
    return [...items].sort((x, y) => matches(y) - matches(x));
  };
  const findArtists = (q: string) => search(q, "artists").then((r) => r.artists);
  const findAlbums = (q: string) => search(q, "albums").then((r) => byTypedArtist(r.albums).slice(0, 6));
  const findTracks = (q: string) => search(q, "tracks").then((r) => byTypedArtist(r.tracks).slice(0, 6));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const timestamp = f.when ? Math.floor(new Date(f.when).getTime() / 1000) : undefined;
      const r = await api<ScrobbleResponse>("/scrobble", {
        body: { artist: f.artist, track: f.track, album: f.album, timestamp, source: "manual" },
      });
      if (!r.accepted) throw new Error(r.details[0]?.reason || "That scrobble was ignored");
      setF({ ...f, track: "", when: local() });
      recent.reload();
      return `Scrobbled “${f.track}” by ${f.artist}.`;
    });
  };

  return (
    <div className="wrap page">
      <h1 className="page-title">Scrobble</h1>
      <div className="cols even">
        <div>
          <Section title="Scrobble a track manually">
            <form className="form card" onSubmit={submit}>
              <label>
                Track
                <Suggest
                  label="Track"
                  autoFocus
                  placeholder="Start typing a song…"
                  value={f.track}
                  onChange={(v) => setF({ ...f, track: v })}
                  search={findTracks}
                  text={(t) => t.title}
                  onPick={(t) => setF({ ...f, track: t.title, artist: t.artist, album: t.album || "" })}
                  row={(t) => (
                    <>
                      <Art image={t.image} />
                      <span>
                        <strong>{t.title}</strong>
                        <span>
                          {t.artist}
                          {t.album && ` · ${t.album}`}
                        </span>
                      </span>
                    </>
                  )}
                />
              </label>
              <div className="pair">
                <label>
                  Artist
                  <Suggest
                    label="Artist"
                    value={f.artist}
                    onChange={(v) => setF({ ...f, artist: v })}
                    search={findArtists}
                    text={(a) => a.name}
                    onPick={(a) => setF({ ...f, artist: a.name })}
                    row={(a) => (
                      <>
                        <Art image={a.image} kind="artist" />
                        <span>
                          <strong>{a.name}</strong>
                          <span>{num(a.listeners)} listeners</span>
                        </span>
                      </>
                    )}
                  />
                </label>
                <label>
                  <span>
                    Album <span className="muted opt">optional</span>
                  </span>
                  <Suggest
                    label="Album"
                    value={f.album}
                    onChange={(v) => setF({ ...f, album: v })}
                    search={findAlbums}
                    text={(a) => a.title}
                    onPick={(a) => setF({ ...f, album: a.title, artist: f.artist.trim() ? f.artist : a.artist })}
                    row={(a) => (
                      <>
                        <Art image={a.image} />
                        <span>
                          <strong>{a.title}</strong>
                          <span>{a.artist}</span>
                        </span>
                      </>
                    )}
                  />
                </label>
              </div>
              <label>
                Listened at
                <DatePicker
                  time
                  label="Listened at"
                  value={f.when}
                  onChange={(v) => setF({ ...f, when: v || local() })}
                  max="now"
                  presets={PRESETS}
                />
              </label>
              {act.note}
              <Button kind="btn" loading={act.busy} disabled={!f.artist.trim() || !f.track.trim()}>
                Scrobble
              </Button>
            </form>
            <p className="muted small">
              Pick a match to fill in the rest, or type anything: music that isn't in the catalogue yet is added
              automatically.
            </p>
          </Section>
          <Section title="Your latest scrobbles" more={`${userUrl(me!.username)}/library`}>
            <Async q={recent}>{(d) => <TrackList items={d.items} time />}</Async>
          </Section>
        </div>
        <div>
          <Section title="Import your listening history">
            <Button kind="btn" href="/import">
              Import from Last.fm or a file
            </Button>
          </Section>
          <Section title="Scrobble from other apps">
            <p>
              Sonosphere's API is compatible with applications that support the Last.fm 2.0 protocol. To scrobble from
              another app, follow the <Link to="/help">scrobbling help</Link>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
