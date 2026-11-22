import { lazy, Suspense, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { albumUrl, artistUrl, dec, dur, plural, qs, releaseTitle, useApi, useAuth, useTitle } from "../../lib";
import { Async, Section, Tabs, Pane } from "../../ui/base";
import { Grid, TrackList } from "../../ui/lists";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton } from "../../player";
import { UploadImage } from "./shared";
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

const AdminTools = lazy(() => import("../../admin/page-tools").then((m) => ({ default: m.AdminTools })));
const TracklistTool = lazy(() => import("../../admin/page-tools").then((m) => ({ default: m.TracklistTool })));

function albumFacts(a: AlbumData) {
  const facts: [string, ReactNode][] = [];
  if (a.releaseDate) facts.push(["Release date", releaseDate(a.releaseDate)]);
  facts.push(["Length", a.tracks.length ? `${plural(a.tracks.length, "track")}, ${dur(a.duration)}` : "Unknown"]);
  return facts;
}

export function AlbumPage({ tab }: { tab: "overview" | "wiki" }) {
  const p = useParams();
  const artist = dec(p.artist);
  const album = dec(p.album);
  const base = albumUrl(artist, album);
  const q = useApi<AlbumData>(`/album${qs({ artist, album })}`);
  const { me } = useAuth();
  useTitle(releaseTitle(album, artist, tab === "wiki"));
  return (
    <Async q={q}>
      {(a) => (
        <>
          <MusicHero
            image={a.image ?? a.artistImage}
            cover={!!a.image}
            title={a.title}
            over={<Link to={artistUrl(a.artist)}>{a.artist}</Link>}
            tabs={
              <Tabs
                items={[
                  [base, "Overview", true],
                  [`${base}/+wiki`, "Wiki"],
                ]}
              />
            }
            actions={
              <>
                <PlayButton queue={a.tracks} label="Play album" />
                {me && <UploadImage type="album" id={a.id} onDone={q.reload} />}
                {me?.admin && (
                  <Suspense fallback={null}>
                    <AdminTools kind="album" item={{ id: a.id, name: a.title, artist: a.artist }} onDone={q.reload} />
                  </Suspense>
                )}
              </>
            }
            stats={
              <>
                <HeroStat label="Listeners" value={a.listeners} />
                <HeroStat label="Scrobbles" value={a.playcount} />
              </>
            }
          />
          <div className="wrap page mpage">
            <Pane>
              {tab === "wiki" ? (
                <WikiPage type="album" id={a.id} title={a.title} />
              ) : (
                <div className="cols">
                  <div className="main">
                    <YourScrobbles count={a.userPlaycount} />
                    <About wiki={a.wiki} to={`${base}/+wiki`} facts={albumFacts(a)}>
                      <Tagger type="album" id={a.id} tags={a.tags} myTags={a.myTags} />
                    </About>
                    <Section
                      title="Tracklist"
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
                    <Section title="Wall">
                      <Shoutbox type="album" id={a.id} limit={10} />
                    </Section>
                    {a.otherAlbums.length > 0 && (
                      <Section
                        title={`More by ${a.artist}`}
                        more={`${artistUrl(a.artist)}/+albums`}
                        moreLabel="View all albums"
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
                      <Section title="Elsewhere">
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
