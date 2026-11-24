import { Ico, Spinner } from "../../icons";
import { useState } from "react";
import { t } from "../../i18n";
import { Select } from "../../kit";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  albumUrl,
  artistTitle,
  artistUrl,
  dec,
  enc,
  num,
  periods,
  qs,
  short,
  trackUrl,
  useApi,
  useAuth,
  userUrl,
  useTitle,
} from "../../lib";
import { Art, Async, Empty, Pager, PeriodPicker, Section, Tabs, Pane } from "../../ui/base";
import { EventList } from "../../ui/events";
import { Grid, TrackList, UserList } from "../../ui/lists";
import { MoreMenu } from "../../ui/more-menu";
import { shortMusicUrl } from "../../../shared/paths";
import { Shoutbox } from "../../ui/shoutbox";
import { Tagger, TagChips } from "../../ui/tags";
import { WikiPage } from "../../ui/wiki";
import { PlayButton, StationButton } from "../../player";
import { ImageGallery } from "./gallery";
import { RemoveScrobbles, AdminItems, AdminDialog } from "./shared";
import type { AdminEdit } from "../../admin/page-tools";
import type {
  ArtistAlbums as ArtistAlbumsData,
  ArtistListeners as ArtistListenersData,
  ArtistPage as ArtistData,
  ArtistSimilar as ArtistSimilarData,
  ArtistTracks as ArtistTracksData,
} from "../../../shared/catalog";
import type { TopTrack } from "../../../shared/listening";
import {
  MusicHero,
  HeroStat,
  FeatureCard,
  releaseDate,
  YourScrobbles,
  About,
  Trend,
  Listeners,
  TrendingBand,
  SIDE_LINKS,
} from "./entity";

type ArtistTab = "overview" | "tracks" | "albums" | "similar" | "images" | "wiki" | "listeners" | "shoutbox";

function HeroCards({ a, top }: { a: ArtistData; top: TopTrack | undefined }) {
  return (
    <>
      {a.latestAlbum && (
        <FeatureCard
          label={t("music.latestRelease")}
          to={albumUrl(a.name, a.latestAlbum.title)}
          image={a.latestAlbum.image}
          title={a.latestAlbum.title}
          sub={a.latestAlbum.releaseDate && releaseDate(a.latestAlbum.releaseDate)}
        />
      )}
      {top && (
        <FeatureCard
          label={a.weekTrack ? t("music.popularThisWeek") : t("music.mostPopularTrack")}
          to={trackUrl(a.name, top.title)}
          image={top.image}
          title={top.title}
          sub={t("music.listenerCount", { count: top.listeners })}
        />
      )}
    </>
  );
}

function albumSub(x: ArtistData["topAlbums"][number]) {
  const details = [
    x.releaseDate && releaseDate(x.releaseDate),
    x.trackCount > 0 && t("music.trackCount", { count: x.trackCount }),
  ];
  return (
    <>
      <span>{t("music.listenerCount", { count: x.listeners })}</span>
      <span>{details.filter(Boolean).join(" · ")}</span>
    </>
  );
}

function Overview({ a, base }: { a: ArtistData; base: string }) {
  const { me } = useAuth();
  return (
    <div className="cols">
      <div className="main">
        <YourScrobbles
          count={a.userPlaycount}
          to={me ? `${userUrl(me.username)}/library/music/${enc(a.name)}` : undefined}
        />
        <About
          wiki={a.wiki}
          to={`${base}/+wiki`}
          facts={[
            [t("music.albums"), num(a.albumCount)],
            [t("music.tracks"), num(a.trackCount)],
            [t("music.wallPosts"), num(a.shoutCount)],
          ]}
        >
          <Tagger type="artist" id={a.id} tags={a.tags} myTags={a.myTags} />
        </About>
        <ArtistTopTracks name={a.name} base={base} initial={a.topTracks} />
        <Section title={t("music.albums")} more={`${base}/+albums`} moreLabel={t("music.viewAllAlbums")} foot>
          <Grid below kind="album" cols={4} items={a.topAlbums.slice(0, 4)} sub={albumSub} />
        </Section>
        {a.topSingles.length > 0 && (
          <Section
            title={t("music.singles")}
            more={`${base}/+albums?type=singles`}
            moreLabel={t("music.viewAllSingles")}
            foot
          >
            <Grid below kind="album" cols={4} items={a.topSingles} sub={albumSub} />
          </Section>
        )}
        <Listeners items={a.topListeners} more={`${base}/+listeners`} />
        <Section title={t("music.wall")} more={`${base}/+wall`} moreLabel={t("music.viewWholeWall")} foot>
          <Shoutbox type="artist" id={a.id} limit={3} />
        </Section>
        <Section title={t("music.similarArtists")} more={`${base}/+similar`} moreLabel={t("music.viewAllSimilar")} foot>
          <Grid below kind="artist" cols={6} items={a.similar} />
        </Section>
      </div>
      <aside className="side">
        {a.similar.length > 0 && (
          <Section title={t("music.similarTo")}>
            <Grid
              below
              kind="artist"
              cols={3}
              items={a.similar.slice(0, 3)}
              sub={(x) => <span>{t("music.listenerCountShort", { count: x.listeners, n: short(x.listeners) })}</span>}
            />
          </Section>
        )}
        <Trend data={a.trend} />
        <Section title={t("music.upcomingEvents")}>
          {a.events.length ? <EventList items={a.events} /> : <p className="muted">{t("music.noArtistEvents")}</p>}
          <p className={SIDE_LINKS}>
            <Link to="/events/add">
              <Ico.Plus /> {t("music.addEvent")}
            </Link>
            <Link to="/events">{t("music.viewAllEvents")}</Link>
          </p>
        </Section>
        {(a.mbid || a.spotifyId) && (
          <Section title={t("music.elsewhere")}>
            <p className={SIDE_LINKS}>
              {a.mbid && (
                <a href={`https://musicbrainz.org/mbid/${a.mbid}`} target="_blank" rel="noreferrer">
                  MusicBrainz
                </a>
              )}
              {a.spotifyId && (
                <a href={`https://open.spotify.com/artist/${a.spotifyId}`} target="_blank" rel="noreferrer">
                  Spotify
                </a>
              )}
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
  const [adminEdit, setAdminEdit] = useState<AdminEdit | null>(null);
  useTitle(artistTitle(name, tab));
  return (
    <Async q={q}>
      {(a) => {
        const top = a.weekTrack || a.topTracks[0];
        const tabs: [string, string, boolean?][] = [
          [base, t("music.overview"), true],
          [`${base}/+tracks`, t("music.tracks")],
          [`${base}/+albums`, t("music.albums")],
          [`${base}/+similar`, t("music.similarArtists")],
          [`${base}/+images`, t("music.images")],
          [`${base}/+wiki`, t("music.wiki")],
          [`${base}/+listeners`, t("music.listeners")],
          [`${base}/+wall`, t("music.wallCount", { count: a.shoutCount })],
        ];
        return (
          <>
            <MusicHero
              image={a.image}
              imageHref={a.image ? `${base}/+images/${a.image}` : undefined}
              imageCount={a.imageCount}
              title={a.name}
              tabs={<Tabs items={tabs} />}
              actions={
                <>
                  <PlayButton queue={a.topTracks} label={t("music.playArtist")} />
                  <StationButton type="artist" name={a.name} label={t("music.artistRadio")} ghost />
                  <MoreMenu label={t("music.moreActionsFor", { name: a.name })} link={shortMusicUrl("a", a.id)}>
                    {me && <RemoveScrobbles scope="artist" id={a.id} name={a.name} count={a.userPlaycount} />}
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
              cards={tab === "overview" && (a.latestAlbum || top) ? <HeroCards a={a} top={top} /> : null}
            />
            {adminEdit && (
              <AdminDialog
                kind="artist"
                item={{ id: a.id, name: a.name, artist: null }}
                edit={adminEdit}
                close={() => setAdminEdit(null)}
                onDone={q.reload}
              />
            )}
            <div className="wrap page mpage">
              <Pane>
                {tab === "overview" && <Overview a={a} base={base} />}
                {tab === "tracks" && <ArtistTracks name={a.name} />}
                {tab === "albums" && <ArtistAlbums name={a.name} />}
                {tab === "similar" && <ArtistSimilar name={a.name} />}
                {tab === "images" && (
                  <ImageGallery type="artist" id={a.id} name={a.name} base={base} onChanged={q.reload} />
                )}
                {tab === "wiki" && <WikiPage type="artist" id={a.id} title={a.name} />}
                {tab === "listeners" && <ArtistListeners name={a.name} />}
                {tab === "shoutbox" && <Shoutbox type="artist" id={a.id} />}
              </Pane>
            </div>
            {tab === "overview" && <TrendingBand />}
          </>
        );
      }}
    </Async>
  );
}

function ArtistTopTracks({ name, base, initial }: { name: string; base: string; initial: TopTrack[] }) {
  const [period, setPeriod] = useState("overall");
  const overall = period === "overall";
  const q = useApi<ArtistTracksData>(overall ? null : `/artist/tracks${qs({ name, period, limit: 10 })}`);
  const items = overall ? initial : (q.data?.items ?? []);

  const aside = (
    <>
      <PlayButton queue={items} />
      <span className="ms-auto">
        <Select label={t("music.timePeriod")} value={period} onChange={setPeriod} options={periods()} />
      </span>
    </>
  );

  let body;
  if (!overall && q.loading) body = <Spinner page />;
  else if (items.length) body = <TrackList items={items} rank={1} count="listeners" showArtist={false} />;
  else body = <Empty>{t("music.noArtistScrobbles", { name })}</Empty>;

  return (
    <Section
      title={t("music.topTracks")}
      more={`${base}/+tracks${overall ? "" : qs({ period })}`}
      moreLabel={t("music.viewAllTracks")}
      foot
      aside={aside}
    >
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
      <div className="toolbar">
        <h2>{t("music.topTracks")}</h2>
        <PeriodPicker />
      </div>
      <Async q={q}>
        {(d) => (
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
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const type = sp.get("type") === "singles" ? "singles" : "albums";
  const q = useApi<ArtistAlbumsData>(`/artist/albums${qs({ name, page, type: type === "singles" ? type : "" })}`);
  const pick = (v: string) => setSp(v === "singles" ? { type: v } : {});
  return (
    <>
      <div className="toolbar">
        <h2>{type === "singles" ? t("music.singles") : t("music.albums")}</h2>
        <Select
          label={t("music.show")}
          value={type}
          onChange={pick}
          options={[
            ["albums", t("music.albums")],
            ["singles", t("music.singles")],
          ]}
        />
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <Grid
              kind="album"
              cols={4}
              items={d.items}
              sub={(x) => (
                <>
                  {x.releaseDate?.slice(0, 4)} · {t("music.trackCount", { count: x.trackCount })} ·{" "}
                  {t("music.listenerCount", { count: x.listeners })}
                </>
              )}
            />
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
    </>
  );
}

function ArtistSimilar({ name }: { name: string }) {
  const q = useApi<ArtistSimilarData>(`/artist/similar${qs({ name })}`);
  return (
    <Async q={q}>
      {(d) =>
        d.items.length ? (
          <ul className="similar">
            {d.items.map((s) => (
              <li key={s.id}>
                <Link to={artistUrl(s.name)} className="w-[72px] flex-none max-[600px]:w-14">
                  <Art image={s.image} kind="artist" />
                </Link>
                <div className="grow">
                  <Link className="strong" to={artistUrl(s.name)}>
                    {s.name}
                  </Link>
                  <span className="muted small">{t("music.listenerCount", { count: s.listeners })}</span>
                  <TagChips tags={s.tags.map((n) => ({ name: n }))} />
                </div>
                <div className="match" title={t("music.match", { percent: Math.round(s.match * 100) })}>
                  <span style={{ width: `${Math.min(100, s.match * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t("music.noSimilar")}</Empty>
        )
      }
    </Async>
  );
}

function ArtistListeners({ name }: { name: string }) {
  const q = useApi<ArtistListenersData>(`/artist/listeners${qs({ name })}`);
  return <Async q={q}>{(d) => <UserList items={d.items} />}</Async>;
}
