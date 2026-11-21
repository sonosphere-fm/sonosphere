import { Ico, Spinner } from "../../icons";
import { useState } from "react";
import { Select } from "../../kit";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { albumUrl, artistUrl, dec, enc, num, PERIODS, plural, qs, short, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Art, Async, Empty, Pager, PeriodPicker, Section, Tabs, Pane } from "../../ui/base";
import { EventList } from "../../ui/events";
import { Grid, TrackList, UserList } from "../../ui/lists";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger, TagChips } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton, StationButton } from "../../player";
import { UploadImage } from "./shared";
import type {
  ArtistAlbums as ArtistAlbumsData,
  ArtistListeners as ArtistListenersData,
  ArtistPage as ArtistData,
  ArtistSimilar as ArtistSimilarData,
  ArtistTracks as ArtistTracksData,
} from "../../../shared/catalog";
import type { TopTrack } from "../../../shared/listening";
import { MusicHero, HeroStat, FeatureCard, releaseDate, YourScrobbles, About, Trend, Listeners, TrendingBand } from "./entity";

type ArtistTab = "overview" | "tracks" | "albums" | "similar" | "wiki" | "listeners" | "shoutbox";

function HeroCards({ a, top }: { a: ArtistData; top: TopTrack | undefined }) {
  return (
    <>
      {a.latestAlbum && (
        <FeatureCard
          label="Latest release"
          to={albumUrl(a.name, a.latestAlbum.title)}
          image={a.latestAlbum.image}
          title={a.latestAlbum.title}
          sub={a.latestAlbum.releaseDate && releaseDate(a.latestAlbum.releaseDate)}
        />
      )}
      {top && (
        <FeatureCard
          label={a.weekTrack ? "Popular this week" : "Most popular track"}
          to={trackUrl(a.name, top.title)}
          image={top.image}
          title={top.title}
          sub={`${num(top.listeners)} listeners`}
        />
      )}
    </>
  );
}

function albumSub(x: ArtistData["topAlbums"][number]) {
  const details = [x.releaseDate && releaseDate(x.releaseDate), x.trackCount > 0 && plural(x.trackCount, "track")];
  return <><span>{num(x.listeners)} listeners</span><span>{details.filter(Boolean).join(" · ")}</span></>;
}

function Overview({ a, base }: { a: ArtistData; base: string }) {
  const { me } = useAuth();
  return (
    <div className="cols">
      <div className="main">
        <YourScrobbles count={a.userPlaycount} to={me ? `${userUrl(me.username)}/library/music/${enc(a.name)}` : undefined} />
        <About wiki={a.wiki} to={`${base}/+wiki`} facts={[["Albums", num(a.albumCount)], ["Tracks", num(a.trackCount)], ["Wall posts", num(a.shoutCount)]]}>
          <Tagger type="artist" id={a.id} tags={a.tags} myTags={a.myTags} />
        </About>
        <ArtistTopTracks name={a.name} base={base} initial={a.topTracks} />
        <Section title="Albums" more={`${base}/+albums`} moreLabel="View all albums" foot>
          <Grid below kind="album" cols={4} items={a.topAlbums.slice(0, 4)} sub={albumSub} />
        </Section>
        <Listeners items={a.topListeners} more={`${base}/+listeners`} />
        <Section title="Wall" more={`${base}/+wall`} moreLabel="View the whole wall" foot>
          <Shoutbox type="artist" id={a.id} limit={3} />
        </Section>
        <Section title="Similar artists" more={`${base}/+similar`} moreLabel="View all similar artists" foot>
          <Grid below kind="artist" cols={6} items={a.similar} />
        </Section>
      </div>
      <aside className="side">
        {a.similar.length > 0 && (
          <Section title="Similar to">
            <Grid below kind="artist" cols={3} items={a.similar.slice(0, 3)} sub={x => <span>{short(x.listeners)} listeners</span>} />
          </Section>
        )}
        <Trend data={a.trend} />
        <Section title="Upcoming events">
          {a.events.length
            ? <EventList items={a.events} />
            : <p className="muted">We don't have any upcoming events for this artist right now.</p>}
          <p className="side-links"><Link to="/events/add"><Ico.Plus /> Add event</Link><Link to="/events">View all events</Link></p>
        </Section>
        {(a.mbid || a.spotifyId) && (
          <Section title="Elsewhere">
            <p className="side-links">
              {a.mbid && <a href={`https://musicbrainz.org/mbid/${a.mbid}`} target="_blank" rel="noreferrer">MusicBrainz</a>}
              {a.spotifyId && <a href={`https://open.spotify.com/artist/${a.spotifyId}`} target="_blank" rel="noreferrer">Spotify</a>}
            </p>
          </Section>
        )}
      </aside>
    </div>
  );
}

export function ArtistPage({ tab }: { tab: ArtistTab }) {
  const name = dec(useParams().artist);
  const base = artistUrl(name);
  const q = useApi<ArtistData>(`/artist${qs({ name })}`);
  const { me } = useAuth();
  useTitle(q.data ? `${q.data.name} - music, stats and listeners` : name);
  return (
    <Async q={q}>{a => {
      const top = a.weekTrack || a.topTracks[0];
      const tabs: [string, string, boolean?][] = [
        [base, "Overview", true],
        [`${base}/+tracks`, "Tracks"],
        [`${base}/+albums`, "Albums"],
        [`${base}/+similar`, "Similar artists"],
        [`${base}/+wiki`, "Wiki"],
        [`${base}/+listeners`, "Listeners"],
        [`${base}/+wall`, `Wall (${a.shoutCount})`],
      ];
      return (
        <>
          <MusicHero
            image={a.image}
            title={a.name}
            tabs={<Tabs items={tabs} />}
            actions={
              <>
                <PlayButton queue={a.topTracks} label="Play artist" />
                <StationButton type="artist" name={a.name} label="Artist radio" ghost />
                {me && <UploadImage type="artist" id={a.id} onDone={q.reload} />}
              </>
            }
            stats={<><HeroStat label="Listeners" value={a.listeners} /><HeroStat label="Scrobbles" value={a.playcount} /></>}
            cards={tab === "overview" && (a.latestAlbum || top) ? <HeroCards a={a} top={top} /> : null}
          />
          <div className="wrap page mpage">
            <Pane>
              {tab === "overview" && <Overview a={a} base={base} />}
              {tab === "tracks" && <ArtistTracks name={a.name} />}
              {tab === "albums" && <ArtistAlbums name={a.name} />}
              {tab === "similar" && <ArtistSimilar name={a.name} />}
              {tab === "wiki" && <WikiPage type="artist" id={a.id} title={a.name} />}
              {tab === "listeners" && <ArtistListeners name={a.name} />}
              {tab === "shoutbox" && <Shoutbox type="artist" id={a.id} />}
            </Pane>
          </div>
          {tab === "overview" && <TrendingBand />}
        </>
      );
    }}</Async>
  );
}

function ArtistTopTracks({ name, base, initial }: { name: string; base: string; initial: TopTrack[] }) {
  const [period, setPeriod] = useState("overall");
  const overall = period === "overall";
  const q = useApi<ArtistTracksData>(overall ? null : `/artist/tracks${qs({ name, period, limit: 10 })}`);
  const items = overall ? initial : q.data?.items ?? [];

  const aside = (
    <>
      <PlayButton queue={items} />
      <span className="head-right"><Select label="Time period" value={period} onChange={setPeriod} options={PERIODS} /></span>
    </>
  );

  let body;
  if (!overall && q.loading) body = <Spinner page />;
  else if (items.length) body = <TrackList items={items} rank={1} count="listeners" showArtist={false} />;
  else body = <Empty>No one has scrobbled {name} in this period.</Empty>;

  return (
    <Section title="Top tracks" more={`${base}/+tracks${overall ? "" : qs({ period })}`} moreLabel="View all tracks" foot aside={aside}>
      {body}
    </Section>
  );
}

function ArtistTracks({ name }: { name: string }) {
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const period = sp.get("period") || "overall";
  const q = useApi<ArtistTracksData>(`/artist/tracks${qs({ name, period, page })}`);
  return (
    <>
      <div className="toolbar"><h2>Top tracks</h2><PeriodPicker /></div>
      <Async q={q}>
        {d => (
          <>
            <TrackList items={d.items} rank={(page - 1) * d.limit + 1} count="listeners" showArtist={false} />
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
    </>
  );
}

function ArtistAlbums({ name }: { name: string }) {
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const q = useApi<ArtistAlbumsData>(`/artist/albums${qs({ name, page })}`);
  return (
    <Async q={q}>
      {d => (
        <>
          <Grid
            kind="album"
            cols={4}
            items={d.items}
            sub={x => <>{x.releaseDate?.slice(0, 4)} · {plural(x.trackCount, "track")} · {num(x.listeners)} listeners</>}
          />
          <Pager total={d.total} limit={d.limit} />
        </>
      )}
    </Async>
  );
}

function ArtistSimilar({ name }: { name: string }) {
  const q = useApi<ArtistSimilarData>(`/artist/similar${qs({ name })}`);
  return (
    <Async q={q}>
      {d => d.items.length ? (
        <ul className="similar">
          {d.items.map(s => (
            <li key={s.id}>
              <Link to={artistUrl(s.name)} className="similar-art"><Art image={s.image} kind="artist" /></Link>
              <div className="grow">
                <Link className="strong" to={artistUrl(s.name)}>{s.name}</Link>
                <span className="muted small">{num(s.listeners)} listeners</span>
                <TagChips tags={s.tags.map(n => ({ name: n }))} />
              </div>
              <div className="match" title={`${Math.round(s.match * 100)}% match`}>
                <span style={{ width: `${Math.min(100, s.match * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Not enough listening data to find similar artists yet.</Empty>
      )}
    </Async>
  );
}

function ArtistListeners({ name }: { name: string }) {
  const q = useApi<ArtistListenersData>(`/artist/listeners${qs({ name })}`);
  return <Async q={q}>{d => <UserList items={d.items} />}</Async>;
}
