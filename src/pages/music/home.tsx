import { Ico, Spinner } from "../../icons";
import { Suspense, useState } from "react";
import { SiteBanner } from "../../banner";
import { t, tx } from "../../i18n";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { artistUrl, date, prefetch, qs, TITLES, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Async, Avatar, Pane, Section } from "../../ui/base";
import { UserLabels } from "../../ui/user-labels";
import { RecCard, Grid, TrackList } from "../../ui/lists";
import { EventList } from "../../ui/events";
import { TagChips } from "../../ui/tags";
import { StationRow } from "../../player";
import { HomeHero, HomeHeroChart, HomeHeroStats } from "./home-hero";
import { HomeTabs, ImportPrompt, mixRecs } from "./shared";
import type { FriendActivity, FriendLove, Home as HomeData, Recommended } from "../../../shared/home";
import type { UserRecent } from "../../../shared/users";

const WELCOME_KEY = "spin:welcome";

function welcomeHidden() {
  try {
    return localStorage.getItem(WELCOME_KEY) === "0";
  } catch {
    return false;
  }
}

const RECOMMENDED = "/recommended";
const recentOf = (name: string) => `/user/recent${qs({ name, limit: 5 })}`;

function Recs() {
  const q = useApi<Recommended>(RECOMMENDED);
  return (
    <Async q={q}>
      {(d) =>
        d.artists.length ? (
          <div className="recs">
            {mixRecs(d).map((r) => (
              <RecCard key={r.kind + r.item.id} {...r} />
            ))}
          </div>
        ) : (
          <ImportPrompt />
        )
      }
    </Async>
  );
}

function HomeFeed({ name }: { name: string }) {
  const [hidden, setHidden] = useState(welcomeHidden);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(WELCOME_KEY, "0");
    } catch {}
  };

  return (
    <>
      {!hidden && (
        <div className="welcome relative pe-10 mb-6">
          <Button kind="bare welcome-x" aria-label={t("music.dismiss")} onClick={dismiss}>
            <Ico.X />
          </Button>
          <h1 className="text-[24px] m-0 mb-2 max-[600px]:text-[20px]">{t("music.welcome", { name })}</h1>
          <p className="m-0 text-site-ink-2 max-w-[62ch]">{t("music.welcomeBody")}</p>
        </div>
      )}
      <Pane>
        <Recs />
      </Pane>
    </>
  );
}

function PlayRows() {
  return (
    <ul className="play-rows list-none m-0 mb-7 p-0">
      <StationRow type="library" label={t("music.playLibrary")} />
      <StationRow type="mix" label={t("music.playMix")} />
      <StationRow type="recommended" label={t("music.playRecommendations")} />
    </ul>
  );
}

function FriendsListening({ friends, me }: { friends: FriendActivity[]; me: string }) {
  return (
    <Section title={t("music.friendsListening")} more={`${userUrl(me)}/following`} moreLabel={t("music.following")}>
      <ul className="feed">
        {friends.slice(0, 8).map((f) => (
          <li key={f.user.username}>
            <Avatar user={f.user} />
            <div className="grow">
              <Link className="strong" to={userUrl(f.user.username)}>
                <Username user={f.user} />
              </Link>{" "}
              <UserLabels name={f.user.username} />
              <span className="muted">
                {tx("music.trackByArtist", {
                  track: <Link to={trackUrl(f.track.artist, f.track.title)}>{f.track.title}</Link>,
                  artist: <Link to={artistUrl(f.track.artist)}>{f.track.artist}</Link>,
                })}
              </span>
            </div>
            {f.nowPlaying ? (
              <span className="np small">
                {t("music.scrobblingNow")}{" "}
                <i className="eq">
                  <i />
                  <i />
                  <i />
                </i>
              </span>
            ) : (
              "playedAt" in f.track && (
                <span className="muted small">{date(f.track.playedAt, { day: "numeric", month: "short" })}</span>
              )
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FriendLoves({ items }: { items: FriendLove[] }) {
  return (
    <Section title={t("music.lovedByFriends")}>
      <ul className="plain">
        {items.map((love) => (
          <li key={love.user + love.id}>
            <Link className="strong" to={trackUrl(love.artist, love.title)}>
              {love.title}
            </Link>{" "}
            <span className="muted">- {love.artist}</span>
            <br />
            <span className="muted small">
              <Ico.Heart on />{" "}
              <Link to={userUrl(love.user)}>
                <Username name={love.user} />
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Home() {
  const { me } = useAuth();
  if (me) {
    prefetch(RECOMMENDED);
    prefetch(recentOf(me.username));
  }
  useTitle(me ? TITLES.home : TITLES.guestHome);
  return (
    <>
      {me ? (
        <HomeTabs at="home" />
      ) : (
        <HomeHero
          stats={
            <Suspense fallback={null}>
              <GuestStats />
            </Suspense>
          }
          chart={
            <Suspense fallback={<HomeHeroChart />}>
              <GuestChart />
            </Suspense>
          }
        />
      )}
      {!me && <SiteBanner />}
      <Suspense fallback={me ? <Spinner page /> : <div role="status" aria-label={t("music.loadingCharts")} />}>
        <HomeContent name={me?.username} />
      </Suspense>
    </>
  );
}

function GuestStats() {
  const { data } = useApi<HomeData>("/home");
  return <HomeHeroStats users={data?.stats.users} />;
}

function GuestChart() {
  const { data } = useApi<HomeData>("/home");
  return <HomeHeroChart tracks={data?.trendingTracks ?? []} />;
}

function HomeContent({ name }: { name?: string }) {
  const q = useApi<HomeData>("/home");
  return (
    <div className={name ? "wrap page home-page" : "wrap page"}>
      <Async q={q}>
        {(d) => {
          const week = d.trendingPeriod === "week";
          return (
            <div className="cols">
              <div className="main">
                {name && (
                  <>
                    <HomeFeed name={name} />
                    <Suspense fallback={null}>
                      <HomeRecent name={name} />
                    </Suspense>
                    {d.friends && d.friends.length > 0 && <FriendsListening friends={d.friends} me={name} />}
                  </>
                )}
                <Section title={week ? t("music.trendingArtists") : t("music.topArtists")} more="/charts">
                  <Grid kind="artist" cols={4} items={d.trendingArtists.slice(0, 8)} />
                </Section>
                <Section title={week ? t("music.topTracksThisWeek") : t("music.topTracks")} more="/charts?kind=tracks">
                  <TrackList items={d.trendingTracks} rank={1} count="listeners" />
                </Section>
                <Section title={week ? t("music.albumsOnTheRise") : t("music.topAlbums")} more="/charts?kind=albums">
                  <Grid kind="album" items={d.trendingAlbums} />
                </Section>
              </div>
              <aside className="side">
                {name && <PlayRows />}
                {name && d.friendLoves && d.friendLoves.length > 0 && <FriendLoves items={d.friendLoves} />}
                <Section title={t("music.popularTags")} more="/charts?kind=tags">
                  <TagChips tags={d.tags} />
                </Section>
                <Section title={t("music.upcomingEvents")} more="/events">
                  <EventList items={d.events} />
                </Section>
              </aside>
            </div>
          );
        }}
      </Async>
    </div>
  );
}

function HomeRecent({ name }: { name: string }) {
  const q = useApi<UserRecent>(recentOf(name));
  if (!q.data?.items.length) return null;
  const nowPlaying = "nowPlaying" in q.data ? q.data.nowPlaying : null;
  return (
    <Section title={t("music.yourRecentTracks")} more={`${userUrl(name)}/library`} moreLabel={t("music.library")}>
      <TrackList items={q.data.items} nowPlaying={nowPlaying} time />
    </Section>
  );
}
import { Username } from "../../ui/username";
