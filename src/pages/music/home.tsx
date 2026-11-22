import { Ico } from "../../icons";
import { Suspense, useState } from "react";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { artistUrl, date, num, prefetch, qs, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Async, Avatar, Empty, Pane, Section } from "../../ui/base";
import { UserLabels } from "../../ui/user-labels";
import { RecCard, Grid, TrackList } from "../../ui/lists";
import { EventList } from "../../ui/events";
import { TagChips } from "../../ui/tags";
import { StationRow } from "../../player";
import { HomeTabs, mixRecs } from "./shared";
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
      {d => d.artists.length
        ? <div className="recs">{mixRecs(d).map(r => <RecCard key={r.kind + r.item.id} {...r} />)}</div>
        : <Empty>You need to scrobble a few more tracks before we can recommend you anything.</Empty>}
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
        <div className="welcome relative pr-10 mb-6">
          <Button kind="bare welcome-x" aria-label="Dismiss" onClick={dismiss}><Ico.X /></Button>
          <h1 className="text-[24px] m-0 mb-2 max-[600px]:text-[20px]">Welcome to Sonosphere, {name}!</h1>
          <p className="m-0 text-site-ink-2 max-w-[62ch]">The more you scrobble, the better these picks get. Recommendations are continually updated as you scrobble more music.</p>
        </div>
      )}
      <Pane><Recs /></Pane>
    </>
  );
}

function PlayRows() {
  return (
    <ul className="play-rows list-none m-0 mb-7 p-0">
      <StationRow type="library" label="Play your library" />
      <StationRow type="mix" label="Play your mix" />
      <StationRow type="recommended" label="Play your recommendations" />
    </ul>
  );
}

function Banner({ d }: { d: HomeData | null }) {
  return (
    <div className="banner">
      <div className="wrap banner-inner">
        <div className="banner-copy">
          <h1>Track what you love.</h1>
          <p>Sonosphere scrobbles everything you play, turns it into your own charts, and finds the music and people that match your taste.</p>
          <div className="row">
            <Button kind="btn inverse" href="/join">Join free</Button>
            <Button kind="btn outline-invert" href="/login">Log in</Button>
          </div>
          {d && d.stats.users >= 10 && <p className="banner-stats">Join {num(roundDown(d.stats.users))}+ users scrobbling on Sonosphere</p>}
        </div>
        {d && d.trendingTracks.length > 0 && (
          <ol className="banner-chart">
            <li className="banner-chart-head">Top tracks right now</li>
            {d.trendingTracks.slice(0, 5).map((t, i) => (
              <li key={t.id}>
                <b>{i + 1}</b>
                <Link to={trackUrl(t.artist, t.title)}><strong>{t.title}</strong><span>{t.artist}</span></Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function FriendsListening({ friends, me }: { friends: FriendActivity[]; me: string }) {
  return (
    <Section title="Friends' listening" more={`${userUrl(me)}/following`} moreLabel="Following">
      <ul className="feed">
        {friends.slice(0, 8).map(f => (
          <li key={f.user.username}>
            <Avatar user={f.user} />
            <div className="grow">
              <Link className="strong" to={userUrl(f.user.username)}>{f.user.username}</Link> <UserLabels name={f.user.username} />
              <span>
                <Link to={trackUrl(f.track.artist, f.track.title)}>{f.track.title}</Link> <span className="muted">by</span>{" "}
                <Link to={artistUrl(f.track.artist)}>{f.track.artist}</Link>
              </span>
            </div>
            {f.nowPlaying
              ? <span className="np small">Scrobbling now <i className="eq"><i /><i /><i /></i></span>
              : "playedAt" in f.track && <span className="muted small">{date(f.track.playedAt, { day: "numeric", month: "short" })}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FriendLoves({ items }: { items: FriendLove[] }) {
  return (
    <Section title="Loved by friends">
      <ul className="plain">
        {items.map(t => (
          <li key={t.user + t.id}>
            <Link className="strong" to={trackUrl(t.artist, t.title)}>{t.title}</Link> <span className="muted">- {t.artist}</span>
            <br />
            <span className="muted small"><Ico.Heart on /> <Link to={userUrl(t.user)}>{t.user}</Link></span>
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
  const q = useApi<HomeData>("/home");
  useTitle(me ? "Home" : "Track what you love");
  return (
    <>
      {!me && <Banner d={q.data} />}
      {me && <HomeTabs at="home" />}
      <div className={me ? "wrap page home-page" : "wrap page"}>
        <Async q={q}>{d => {
          const week = d.trendingPeriod === "week";
          return (
            <div className="cols">
              <div className="main">
                {me && (
                  <>
                    <HomeFeed name={me.username} />
                    <Suspense fallback={null}><HomeRecent name={me.username} /></Suspense>
                    {d.friends && d.friends.length > 0 && <FriendsListening friends={d.friends} me={me.username} />}
                  </>
                )}
                <Section title={week ? "Trending artists" : "Top artists"} more="/charts">
                  <Grid kind="artist" cols={4} items={d.trendingArtists.slice(0, 8)} />
                </Section>
                <Section title={week ? "Top tracks this week" : "Top tracks"} more="/charts?kind=tracks">
                  <TrackList items={d.trendingTracks} rank={1} count="listeners" />
                </Section>
                <Section title={week ? "Albums on the rise" : "Top albums"} more="/charts?kind=albums">
                  <Grid kind="album" items={d.trendingAlbums} />
                </Section>
              </div>
              <aside className="side">
                {me && <PlayRows />}
                {me && d.friendLoves && d.friendLoves.length > 0 && <FriendLoves items={d.friendLoves} />}
                <Section title="Popular tags" more="/charts?kind=tags"><TagChips tags={d.tags} /></Section>
                <Section title="Upcoming events" more="/events"><EventList items={d.events} /></Section>
              </aside>
            </div>
          );
        }}</Async>
      </div>
    </>
  );
}

function HomeRecent({ name }: { name: string }) {
  const q = useApi<UserRecent>(recentOf(name));
  if (!q.data?.items.length) return null;
  const nowPlaying = "nowPlaying" in q.data ? q.data.nowPlaying : null;
  return (
    <Section title="Your recent tracks" more={`${userUrl(name)}/library`} moreLabel="Library">
      <TrackList items={q.data.items} nowPlaying={nowPlaying} time />
    </Section>
  );
}

// Rounds down to two significant figures (132 to 130, 1,532 to 1,500) so the claim never overstates.
function roundDown(n: number) {
  const p = Math.max(10, 10 ** (String(Math.floor(n)).length - 2));
  return Math.floor(n / p) * p;
}
