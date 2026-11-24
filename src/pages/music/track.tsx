import { DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Ico } from "../../icons";
import { Lyrics } from "../../ui/lyrics";
import { lazy, useState, type FormEvent, Suspense } from "react";
import { t } from "../../i18n";
import { Button, Input, Modal } from "../../kit";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  albumUrl,
  api,
  artistUrl,
  dec,
  dur,
  qs,
  releaseTitle,
  trackUrl,
  useApi,
  useAuth,
  userUrl,
  useTitle,
} from "../../lib";
import { Async, Section, Tabs, useAction, Pane } from "../../ui/base";
import { Grid, LoveButton, TrackList } from "../../ui/lists";
import { shortMusicUrl } from "../../../shared/paths";
import { Shoutbox } from "../../ui/shoutbox";
import { TrackLinks } from "../../ui/track-links";
import { MoreMenu } from "../../ui/more-menu";
import { Tagger } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton } from "../../player";
import { RemoveScrobbles } from "./shared";
import type { TrackPage as TrackData } from "../../../shared/catalog";
import type { ScrobbleResponse } from "../../../shared/listening";
import type { ObsessionCreated } from "../../../shared/obsessions";
import type { PlaylistCreated, PlaylistOk, UserPlaylists } from "../../../shared/playlists";
import {
  MusicHero,
  HeroStat,
  FeatureCard,
  YourScrobbles,
  About,
  ByArtist,
  Trend,
  Listeners,
  TrendingBand,
} from "./entity";

const AdminTools = lazy(() =>
  import("../../admin/page-tools").then(async (m) => (await m.ready, { default: m.AdminTools }))
);

type ModalProps = { track: Pick<TrackData, "id" | "title">; onClose: () => void };

function AddToPlaylist({ track, onClose }: ModalProps) {
  const { me } = useAuth();
  const q = useApi<UserPlaylists>(`/user/playlists${qs({ name: me!.username })}`);
  const [title, setTitle] = useState("");
  const act = useAction();

  const add = (id: number) =>
    act.run(async () => {
      await api<PlaylistOk>(`/playlist/${id}/tracks`, { body: { trackId: track.id } });
      return t("music.addedToPlaylist");
    });

  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<PlaylistCreated>("/playlists", { body: { title } });
      await api<PlaylistOk>(`/playlist/${r.id}/tracks`, { body: { trackId: track.id } });
      setTitle("");
      q.reload();
      return t("music.playlistCreatedAdded");
    });
  };

  return (
    <Modal title={t("music.addToPlaylistTitle", { title: track.title })} onClose={onClose}>
      <Async q={q}>
        {(d) => (
          <ul className="plain">
            {d.items.map((p) => (
              <li key={p.id} className="row between">
                <span>
                  <b>{p.title}</b> <span className="muted small">{t("music.trackCount", { count: p.trackCount })}</span>
                </span>
                <Button kind="btn small" loading={act.busy} onClick={() => add(p.id)}>
                  {t("music.add")}
                </Button>
              </li>
            ))}
            {!d.items.length && <li className="muted">{t("music.noPlaylists")}</li>}
          </ul>
        )}
      </Async>
      <form className="inline-form" onSubmit={create}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("music.newPlaylistTitle")}
          aria-label={t("music.newPlaylistTitle")}
          maxLength={100}
        />
        <Button kind="btn small" loading={act.busy} disabled={!title.trim()}>
          {t("music.createAndAdd")}
        </Button>
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
    <Modal title={t("music.setEarwormTitle")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p>{t("music.earwormHint")}</p>
        <label>
          {t("music.earwormWhy")}
          <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} autoFocus />
        </label>
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {t("music.setEarworm")}
        </Button>
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
  const [modal, setModal] = useState<"playlist" | "obsession" | "links" | null>(null);
  const act = useAction();
  useTitle(releaseTitle(track, artist, tab === "wiki"));

  const scrobbleNow = (item: TrackData) =>
    act.run(async () => {
      await api<ScrobbleResponse>("/scrobble", {
        body: { artist: item.artist, track: item.title, album: item.album || "" },
      });
      q.reload();
      return t("music.scrobbled");
    });

  return (
    <Async q={q}>
      {(item) => (
        <>
          <MusicHero
            image={item.image ?? item.artistImage}
            cover={!!item.image}
            title={item.title}
            over={<Link to={artistUrl(item.artist)}>{item.artist}</Link>}
            tabs={
              <Tabs
                items={[
                  [base, t("music.overview"), true],
                  [`${base}/+wiki`, t("music.wiki")],
                ]}
              />
            }
            stats={
              <>
                <HeroStat label={t("music.listeners")} value={item.listeners} />
                <HeroStat label={t("music.scrobbles")} value={item.playcount} />
              </>
            }
            cards={
              tab === "overview" && item.album ? (
                <FeatureCard
                  label={t("music.fromTheAlbum")}
                  to={albumUrl(item.artist, item.album)}
                  image={item.image}
                  title={item.album}
                  sub={item.artist}
                />
              ) : null
            }
            actions={
              <>
                <PlayButton queue={[item, ...item.similar]} label={t("music.playTrack")} />
                <LoveButton track={item} loved={item.loved} label onChange={q.reload} />
                <Button kind="btn ghost" type="button" onClick={() => setModal("links")}>
                  <Ico.External /> {t("music.openIn")}
                </Button>
                <MoreMenu label={t("music.moreActionsFor", { name: item.title })} link={shortMusicUrl("t", item.id)}>
                  {me && <DropdownMenuItem label={t("music.addToPlaylist")} onClick={() => setModal("playlist")} />}
                  {me && <DropdownMenuItem label={t("music.setAsEarworm")} onClick={() => setModal("obsession")} />}
                  {me && (
                    <DropdownMenuItem
                      label={t("music.scrobbleNow")}
                      isDisabled={act.busy}
                      onClick={() => scrobbleNow(item)}
                    />
                  )}
                  {me && <RemoveScrobbles scope="track" id={item.id} name={item.title} count={item.userPlaycount} />}
                </MoreMenu>
                {me?.admin && (
                  <Suspense fallback={null}>
                    <AdminTools
                      kind="track"
                      item={{ id: item.id, name: item.title, artist: item.artist }}
                      onDone={q.reload}
                    />
                  </Suspense>
                )}
              </>
            }
          >
            {act.note}
          </MusicHero>
          {modal === "playlist" && (
            <Suspense fallback={null}>
              <AddToPlaylist track={item} onClose={() => setModal(null)} />
            </Suspense>
          )}
          {modal === "links" && (
            <TrackLinks key={item.id} artist={item.artist} title={item.title} onClose={() => setModal(null)} />
          )}
          {modal === "obsession" && <SetObsession track={item} onClose={() => setModal(null)} />}
          <div className="wrap page mpage">
            <Pane>
              {tab === "wiki" ? (
                <WikiPage type="track" id={item.id} title={item.title} />
              ) : (
                <div className="cols">
                  <div className="main">
                    <YourScrobbles count={item.userPlaycount} />
                    <About
                      wiki={item.wiki}
                      to={`${base}/+wiki`}
                      facts={[
                        [t("music.length"), item.duration > 0 ? dur(item.duration) : t("music.unknown")],
                        [t("music.lovedBy"), t("music.listenerCount", { count: item.loves })],
                      ]}
                    >
                      <Tagger type="track" id={item.id} tags={item.tags} myTags={item.myTags} />
                    </About>
                    <Lyrics track={item} />
                    <Section title={t("music.similarTracks")} aside={<PlayButton queue={item.similar} />}>
                      <TrackList items={item.similar} count="listeners" />
                    </Section>
                    {item.albums.length > 0 && (
                      <Section title={t("music.appearsOn")}>
                        <Grid below kind="album" cols={4} items={item.albums} />
                      </Section>
                    )}
                    <Listeners items={item.topListeners} />
                    <Section title={t("music.wall")}>
                      <Shoutbox type="track" id={item.id} limit={10} />
                    </Section>
                  </div>
                  <aside className="side">
                    <ByArtist name={item.artist} image={item.artistImage} />
                    <Trend data={item.trend} />
                  </aside>
                </div>
              )}
            </Pane>
          </div>
          {tab === "overview" && <TrendingBand />}
        </>
      )}
    </Async>
  );
}
