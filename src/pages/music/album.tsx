import { type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { albumUrl, artistUrl, dec, dur, plural, qs, useApi, useAuth, useTitle } from "../../lib";
import { Async, Section, Tabs, Pane } from "../../ui/base";
import { Grid, TrackList } from "../../ui/lists";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton } from "../../player";
import { UploadImage } from "./shared";
import type { AlbumPage as AlbumData } from "../../../shared/catalog";
import { MusicHero, HeroStat, releaseDate, YourScrobbles, About, ByArtist, Trend, Listeners, TrendingBand } from "./entity";

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
  useTitle(q.data ? `${q.data.title} - ${q.data.artist}` : album);
  return (
    <Async q={q}>{a => (
      <>
        <MusicHero
          image={a.artistImage ?? a.image}
          soft={!a.artistImage}
          title={a.title}
          over={<Link to={artistUrl(a.artist)}>{a.artist}</Link>}
          tabs={<Tabs items={[[base, "Overview", true], [`${base}/+wiki`, "Wiki"]]} />}
          actions={
            <>
              <PlayButton queue={a.tracks} label="Play album" />
              {me && <UploadImage type="album" id={a.id} onDone={q.reload} />}
            </>
          }
          stats={<><HeroStat label="Listeners" value={a.listeners} /><HeroStat label="Scrobbles" value={a.playcount} /></>}
        />
        <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 mpage [&_.cols]:grid-cols-[minmax(0,1fr)_300px] [&_.cols]:gap-11 max-lg:[&_.cols]:grid-cols-[minmax(0,1fr)] max-lg:[&_.cols]:gap-0 [&_.cols:has(>.side:empty)]:grid-cols-[minmax(0,1fr)] [&_.side]:bg-transparent [&_.side]:p-0 [&_.side]:border-t-0 [&_.side:empty]:hidden [&_.section-head]:items-center [&_.section-head]:mb-4 [&_.section-head_h2]:text-2xl [&_.section-head_h2]:font-bold [&_.section-head_h2]:shrink-0 [&_.section-head_h2_a]:text-inherit [&_.section-head_.head-right]:ml-auto [&_.side_.section-head_h2]:text-xl [&_.main>.section]:mb-0 [&_.main>.section]:pt-0 [&_.main>.section]:pb-[34px] [&_.main>.section:first-child]:pt-0 [&_.main>.yours+.section]:pt-0 [&_.main>.section:last-child]:pb-0 [&_.state.empty]:bg-transparent [&_.state.empty]:p-0 [&_.state.empty]:pt-1 [&_.state.empty]:text-left [&_.state.empty]:text-[15px] max-lg:[&_.side]:pt-[26px] max-md:[&_.section-head_h2]:text-xl max-lg:[&_.side>.section:has(.cards.below_.mcard.artist)]:hidden [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
          <Pane>
            {tab === "wiki" ? <WikiPage type="album" id={a.id} title={a.title} /> : (
              <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
                <div className="main min-w-0">
                  <YourScrobbles count={a.userPlaycount} />
                  <About wiki={a.wiki} to={`${base}/+wiki`} facts={albumFacts(a)}>
                    <Tagger type="album" id={a.id} tags={a.tags} myTags={a.myTags} />
                  </About>
                  <Section title="Tracklist" aside={<PlayButton queue={a.tracks} />}>
                    <TrackList items={a.tracks} numbered showArtist={false} showDuration count="listeners" />
                  </Section>
                  <Listeners items={a.topListeners} />
                  <Section title="Wall"><Shoutbox type="album" id={a.id} limit={10} /></Section>
                  {a.otherAlbums.length > 0 && (
                    <Section title={`More by ${a.artist}`} more={`${artistUrl(a.artist)}/+albums`} moreLabel="View all albums" foot>
                      <Grid below kind="album" cols={4} items={a.otherAlbums.slice(0, 4)} />
                    </Section>
                  )}
                </div>
                <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
                  <ByArtist name={a.artist} image={a.artistImage} />
                  <Trend data={a.trend} />
                  {a.mbid && (
                    <Section title="Elsewhere">
                      <p className="side-links flex gap-3.5 mt-3 mb-0 text-sm [&_a+a]:pl-3.5 [&_a+a]:border-l [&_a+a]:border-line">
                        <a href={`https://musicbrainz.org/mbid/${a.mbid}`} target="_blank" rel="noreferrer">MusicBrainz</a>
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
    )}</Async>
  );
}
