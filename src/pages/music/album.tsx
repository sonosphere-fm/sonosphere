import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { t } from "../../i18n";
import { albumUrl, artistUrl, dec, dur, qs, releaseTitle, useApi, useAuth, useTitle } from "../../lib";
import { Async, Section, Tabs, Pane } from "../../ui/base";
import { Grid, TrackList } from "../../ui/lists";
import { MoreMenu } from "../../ui/more-menu";
import { shortMusicUrl } from "../../../shared/paths";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton } from "../../player";
import { ImageGallery } from "./gallery";
import { RemoveScrobbles, AdminItems, AdminDialog } from "./shared";
import type { AdminEdit } from "../../admin/page-tools";
import type { AlbumPage as AlbumData } from "../../../shared/catalog";
import {
  MusicHero,
  HeroStat,
  releaseDate,
  YourScrobbles,
  About,
  ByArtist,
  Trend,
  Listeners,
  TrendingBand,
  SIDE_LINKS,
} from "./entity";

const TracklistTool = lazy(() =>
  import("../../admin/page-tools").then(async (m) => (await m.ready, { default: m.TracklistTool }))
);

function albumFacts(a: AlbumData) {
  const facts: [string, ReactNode][] = [];
  if (a.releaseDate) facts.push([t("music.releaseDate"), releaseDate(a.releaseDate)]);
  facts.push([
    t("music.length"),
    a.tracks.length
      ? t("music.albumLength", { count: a.tracks.length, duration: dur(a.duration) })
      : t("music.unknown"),
  ]);
  return facts;
}

export function AlbumPage({ tab }: { tab: "overview" | "wiki" | "images" }) {
  const p = useParams();
  const artist = dec(p.artist);
  const album = dec(p.album);
  const base = albumUrl(artist, album);
  const q = useApi<AlbumData>(`/album${qs({ artist, album })}`);
  const { me } = useAuth();
  const [adminEdit, setAdminEdit] = useState<AdminEdit | null>(null);
  useTitle(releaseTitle(album, artist, tab === "wiki"));
  return (
    <Async q={q}>
      {(a) => (
        <>
          <MusicHero
            image={a.image ?? a.artistImage}
            cover={!!a.image}
            imageHref={a.image ? `${base}/+images/${a.image}` : undefined}
            imageCount={a.imageCount}
            title={a.title}
            over={<Link to={artistUrl(a.artist)}>{a.artist}</Link>}
            tabs={
              <Tabs
                items={[
                  [base, t("music.overview"), true],
                  [`${base}/+images`, t("music.images")],
                  [`${base}/+wiki`, t("music.wiki")],
                ]}
              />
            }
            actions={
              <>
                <PlayButton queue={a.tracks} label={t("music.playAlbum")} />
                <MoreMenu label={t("music.moreActionsFor", { name: a.title })} link={shortMusicUrl("r", a.id)}>
                  {me && <RemoveScrobbles scope="album" id={a.id} name={a.title} count={a.userPlaycount} />}
                  {me?.admin && <AdminItems pick={setAdminEdit} />}
                </MoreMenu>
              </>
            }
            stats={
              <>
                <HeroStat label={t("music.listeners")} value={a.listeners} />
                <HeroStat label={t("music.scrobbles")} value={a.playcount} />
              </>
            }
          />
          {adminEdit && (
            <AdminDialog
              kind="album"
              item={{ id: a.id, name: a.title, artist: a.artist }}
              edit={adminEdit}
              close={() => setAdminEdit(null)}
              onDone={q.reload}
            />
          )}
          <div className="wrap page mpage">
            <Pane>
              {tab === "wiki" ? (
                <WikiPage type="album" id={a.id} title={a.title} />
              ) : tab === "images" ? (
                <ImageGallery type="album" id={a.id} name={a.title} base={base} onChanged={q.reload} />
              ) : (
                <div className="cols">
                  <div className="main">
                    <YourScrobbles count={a.userPlaycount} />
                    <About wiki={a.wiki} to={`${base}/+wiki`} facts={albumFacts(a)}>
                      <Tagger type="album" id={a.id} tags={a.tags} myTags={a.myTags} />
                    </About>
                    <Section
                      title={t("music.tracklist")}
                      aside={
                        <>
                          {me?.admin && (
                            <Suspense fallback={null}>
                              <TracklistTool item={{ id: a.id, name: a.title, artist: a.artist }} onDone={q.reload} />
                            </Suspense>
                          )}
                          <PlayButton queue={a.tracks} />
                        </>
                      }
                    >
                      <TrackList items={a.tracks} numbered showArtist={false} showDuration count="listeners" />
                    </Section>
                    <Listeners items={a.topListeners} />
                    <Section title={t("music.wall")}>
                      <Shoutbox type="album" id={a.id} limit={10} />
                    </Section>
                    {a.otherAlbums.length > 0 && (
                      <Section
                        title={t("music.moreBy", { artist: a.artist })}
                        more={`${artistUrl(a.artist)}/+albums`}
                        moreLabel={t("music.viewAllAlbums")}
                        foot
                      >
                        <Grid below kind="album" cols={4} items={a.otherAlbums.slice(0, 4)} />
                      </Section>
                    )}
                  </div>
                  <aside className="side">
                    <ByArtist name={a.artist} image={a.artistImage} />
                    <Trend data={a.trend} />
                    {a.mbid && (
                      <Section title={t("music.elsewhere")}>
                        <p className={SIDE_LINKS}>
                          <a href={`https://musicbrainz.org/mbid/${a.mbid}`} target="_blank" rel="noreferrer">
                            MusicBrainz
                          </a>
                        </p>
                      </Section>
                    )}
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
