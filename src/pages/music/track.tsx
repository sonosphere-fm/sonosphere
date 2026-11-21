import { Ico } from "../../icons";
import { Lyrics } from "../../ui/lyrics";
import { useState, type FormEvent, Suspense } from "react";
import { Button, Input, Modal } from "../../kit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { albumUrl, api, artistUrl, dec, dur, plural, qs, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Async, Section, Tabs, useAction, Pane } from "../../ui/base";
import { Grid, LoveButton, TrackList } from "../../ui/lists";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton } from "../../player";
import type { TrackPage as TrackData } from "../../../shared/catalog";
import type { ScrobbleResponse } from "../../../shared/listening";
import type { ObsessionCreated } from "../../../shared/obsessions";
import type { PlaylistCreated, PlaylistOk, UserPlaylists } from "../../../shared/playlists";
import { MusicHero, HeroStat, FeatureCard, YourScrobbles, About, ByArtist, Trend, Listeners, TrendingBand } from "./entity";

type ModalProps = { track: Pick<TrackData, "id" | "title">; onClose: () => void };

function AddToPlaylist({ track, onClose }: ModalProps) {
  const { me } = useAuth();
  const q = useApi<UserPlaylists>(`/user/playlists${qs({ name: me!.username })}`);
  const [title, setTitle] = useState("");
  const act = useAction();

  const add = (id: number) => act.run(async () => {
    await api<PlaylistOk>(`/playlist/${id}/tracks`, { body: { trackId: track.id } });
    return "Added to playlist.";
  });

  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<PlaylistCreated>("/playlists", { body: { title } });
      await api<PlaylistOk>(`/playlist/${r.id}/tracks`, { body: { trackId: track.id } });
      setTitle("");
      q.reload();
      return "Playlist created and track added.";
    });
  };

  return (
    <Modal title={`Add “${track.title}” to a playlist`} onClose={onClose}>
      <Async q={q}>
        {d => (
          <ul className="plain">
            {d.items.map(p => (
              <li key={p.id} className="row between">
                <span><b>{p.title}</b> <span className="muted small">{plural(p.trackCount, "track")}</span></span>
                <Button kind="btn small" loading={act.busy} onClick={() => add(p.id)}>Add</Button>
              </li>
            ))}
            {!d.items.length && <li className="muted">You have no playlists yet.</li>}
          </ul>
        )}
      </Async>
      <form className="inline-form" onSubmit={create}>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="New playlist title" aria-label="New playlist title" maxLength={100} />
        <Button kind="btn small" loading={act.busy} disabled={!title.trim()}>Create & add</Button>
      </form>
      {act.note}
    </Modal>
  );
}

function SetObsession({ track, onClose }: ModalProps) {
  const [comment, setComment] = useState("");
  const act = useAction();
  const { me } = useAuth();
  const nav = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<ObsessionCreated>("/obsessions", { body: { trackId: track.id, comment } });
      nav(`${userUrl(me!.username)}/earworms`);
    });
  };

  return (
    <Modal title="Set as your earworm" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p>Your current earworm is shown at the top of your profile.</p>
        <label>Why this track? (optional)<Input value={comment} onChange={e => setComment(e.target.value)} maxLength={300} autoFocus /></label>
        {act.note}
        <Button kind="btn" loading={act.busy}>Set earworm</Button>
      </form>
    </Modal>
  );
}

export function TrackPage({ tab }: { tab: "overview" | "wiki" }) {
  const p = useParams();
  const artist = dec(p.artist);
  const track = dec(p.track);
  const base = trackUrl(artist, track);
  const q = useApi<TrackData>(`/track${qs({ artist, track })}`);
  const { me } = useAuth();
  const [modal, setModal] = useState<"playlist" | "obsession" | null>(null);
  const act = useAction();
  useTitle(q.data ? `${q.data.title} - ${q.data.artist}` : track);

  const scrobbleNow = (t: TrackData) => act.run(async () => {
    await api<ScrobbleResponse>("/scrobble", { body: { artist: t.artist, track: t.title, album: t.album || "" } });
    q.reload();
    return "Scrobbled.";
  });

  return (
    <Async q={q}>{t => (
      <>
        <MusicHero
          image={t.artistImage ?? t.image}
          soft={!t.artistImage}
          title={t.title}
          over={<Link to={artistUrl(t.artist)}>{t.artist}</Link>}
          tabs={<Tabs items={[[base, "Overview", true], [`${base}/+wiki`, "Wiki"]]} />}
          stats={<><HeroStat label="Listeners" value={t.listeners} /><HeroStat label="Scrobbles" value={t.playcount} /></>}
          cards={tab === "overview" && t.album
            ? <FeatureCard label="From the album" to={albumUrl(t.artist, t.album)} image={t.image} title={t.album} sub={t.artist} />
            : null}
          actions={
            <>
              <PlayButton queue={[t, ...t.similar]} label="Play track" />
              <LoveButton track={t} loved={t.loved} label onChange={q.reload} />
              {me && (
                <>
                  <Button kind="btn ghost" onClick={() => setModal("playlist")}><Ico.Plus /> Playlist</Button>
                  <Button kind="btn ghost" onClick={() => setModal("obsession")}>Set as earworm</Button>
                  <Button kind="btn ghost" loading={act.busy} onClick={() => scrobbleNow(t)}>Scrobble now</Button>
                </>
              )}
            </>
          }
        >
          {act.note}
        </MusicHero>
        {modal === "playlist" && <Suspense fallback={null}><AddToPlaylist track={t} onClose={() => setModal(null)} /></Suspense>}
        {modal === "obsession" && <SetObsession track={t} onClose={() => setModal(null)} />}
        <div className="wrap page mpage">
          <Pane>
            {tab === "wiki" ? <WikiPage type="track" id={t.id} title={t.title} /> : (
              <div className="cols">
                <div className="main">
                  <YourScrobbles count={t.userPlaycount} />
                  <About
                    wiki={t.wiki}
                    to={`${base}/+wiki`}
                    facts={[["Length", t.duration > 0 ? dur(t.duration) : "Unknown"], ["Loved by", plural(t.loves, "listener")]]}
                  >
                    <Tagger type="track" id={t.id} tags={t.tags} myTags={t.myTags} />
                  </About>
                  <Lyrics track={t} />
                  <Section title="Similar tracks" aside={<PlayButton queue={t.similar} />}>
                    <TrackList items={t.similar} count="listeners" />
                  </Section>
                  {t.albums.length > 0 && <Section title="Appears on"><Grid below kind="album" cols={4} items={t.albums} /></Section>}
                  <Listeners items={t.topListeners} />
                  <Section title="Wall"><Shoutbox type="track" id={t.id} limit={10} /></Section>
                </div>
                <aside className="side">
                  <ByArtist name={t.artist} image={t.artistImage} />
                  <Trend data={t.trend} />
                </aside>
              </div>
            )}
          </Pane>
        </div>
        {tab === "overview" && <TrendingBand />}
      </>
    )}</Async>
  );
}
