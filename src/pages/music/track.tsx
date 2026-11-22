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
          <ul className="list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">
            {d.items.map(p => (
              <li key={p.id} className="row flex gap-2.5 items-center flex-wrap justify-between">
                <span><b>{p.title}</b> <span className="text-muted text-[13px]">{plural(p.trackCount, "track")}</span></span>
                <Button kind="btn small" loading={act.busy} onClick={() => add(p.id)}>Add</Button>
              </li>
            ))}
            {!d.items.length && <li className="text-muted">You have no playlists yet.</li>}
          </ul>
        )}
      </Async>
      <form className="inline-form flex gap-2 items-center flex-wrap my-2.5 max-sm:[&>.field]:flex-[1_1_180px] max-sm:[&>.field]:min-w-0 max-sm:[&>.astryx-text-input]:flex-[1_1_180px] max-sm:[&>.astryx-text-input]:min-w-0 max-sm:[&>div:has(>.astryx-text-input)]:flex-[1_1_180px] max-sm:[&>div:has(>.astryx-text-input)]:min-w-0 coarse:[&>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:px-4 [&>.check]:items-center [&>.check]:gap-2 [&>.check]:ml-2.5 [&>.check]:leading-6 max-[641px]:[&>.check]:ml-0 max-sm:[&>.check]:basis-full max-sm:[&>.check]:min-h-10" onSubmit={create}>
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
      <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full" onSubmit={submit}>
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
        <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 mpage [&_.cols]:grid-cols-[minmax(0,1fr)_300px] [&_.cols]:gap-11 max-lg:[&_.cols]:grid-cols-[minmax(0,1fr)] max-lg:[&_.cols]:gap-0 [&_.cols:has(>.side:empty)]:grid-cols-[minmax(0,1fr)] [&_.side]:bg-transparent [&_.side]:p-0 [&_.side]:border-t-0 [&_.side:empty]:hidden [&_.section-head]:items-center [&_.section-head]:mb-4 [&_.section-head_h2]:text-2xl [&_.section-head_h2]:font-bold [&_.section-head_h2]:shrink-0 [&_.section-head_h2_a]:text-inherit [&_.section-head_.head-right]:ml-auto [&_.side_.section-head_h2]:text-xl [&_.main>.section]:mb-0 [&_.main>.section]:pt-0 [&_.main>.section]:pb-[34px] [&_.main>.section:first-child]:pt-0 [&_.main>.yours+.section]:pt-0 [&_.main>.section:last-child]:pb-0 [&_.state.empty]:bg-transparent [&_.state.empty]:p-0 [&_.state.empty]:pt-1 [&_.state.empty]:text-left [&_.state.empty]:text-[15px] max-lg:[&_.side]:pt-[26px] max-md:[&_.section-head_h2]:text-xl max-lg:[&_.side>.section:has(.cards.below_.mcard.artist)]:hidden [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
          <Pane>
            {tab === "wiki" ? <WikiPage type="track" id={t.id} title={t.title} /> : (
              <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
                <div className="main min-w-0">
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
                <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
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
