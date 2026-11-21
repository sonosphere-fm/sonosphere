import { Ico } from "../../icons";
import { useState } from "react";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { artistUrl, date, num, qs, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Async, Avatar, Empty, Section } from "../../ui/base";
import { RecCard, Grid, TrackList } from "../../ui/lists";
import { EventList } from "../../ui/events";
import { TagChips } from "../../ui/tags";
import { StationRow } from "../../player";
import { HomeTabs, mixRecs } from "./shared";
import type { Home as HomeData, Recommended } from "../../../shared/home";
import type { UserRecent } from "../../../shared/users";

function HomeFeed({ name }: { name: string }) {
  const q = useApi<Recommended>("/recommended");
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("spin:welcome") === "0"; } catch { return false; } });
  const dismiss = () => { setHidden(true); try { localStorage.setItem("spin:welcome", "0"); } catch {} };
  return (
    <>
      {!hidden && (
        <div className="welcome">
          <Button kind="bare welcome-x" aria-label="Dismiss" onClick={dismiss}><Ico.X /></Button>
          <h1>Welcome to Sonosphere, {name}!</h1>
          <p>The more you scrobble, the better these picks get. Everything below is chosen from the artists you play most and what listeners like you keep on repeat.</p>
        </div>
      )}
      <Async q={q}>{d => d.artists.length
        ? <div className="recs">{mixRecs(d).map(r => <RecCard key={r.kind + r.item.id} {...r} />)}</div>
        : <Empty>Scrobble a few more tracks and recommendations will appear here.</Empty>}</Async>
    </>
  );
}
function PlayRows() {
  return <ul className="play-rows"><StationRow type="library" label="Play your library" /><StationRow type="mix" label="Play your mix" /><StationRow type="recommended" label="Play your recommendations" /></ul>;
}

// ---------- home ----------
export function Home() {
  const { me } = useAuth();
  const q = useApi<HomeData>("/home");
  useTitle(me ? "Home" : "Track what you love");
  return (
    <>
      {!me && (
        <div className="banner">
          <div className="wrap banner-inner">
            <div className="banner-copy">
              <h1>Track what you love.</h1>
              <p>Sonosphere scrobbles everything you play, turns it into your own charts, and finds the music and people that match your taste.</p>
              <div className="row"><Button kind="btn invert" href="/join">Join free</Button><Button kind="btn outline-invert" href="/login">Log in</Button></div>
              {q.data && q.data.stats.users >= 10 && <p className="banner-stats">Join {num(roundDown(q.data.stats.users))}+ users scrobbling on Sonosphere</p>}
            </div>
            {q.data && q.data.trendingTracks.length > 0 && (
              <ol className="banner-chart">
                <li className="banner-chart-head">Top tracks right now</li>
                {q.data.trendingTracks.slice(0, 5).map((t, i) => (
                  <li key={t.id ?? i}>
                    <b>{i + 1}</b>
                    <Link to={trackUrl(t.artist, t.title)}><strong>{t.title}</strong><span>{t.artist}</span></Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      {me && <HomeTabs at="home" />}
      <div className={me ? "wrap page home-page" : "wrap page"}>
        <Async q={q}>{d => (
          <div className="cols">
            <div className="main">
              {me && (
                <>
                  <HomeFeed name={me.username} />
                  <HomeRecent name={me.username} />
                  {d.friends && d.friends.length > 0 && (
                    <Section title="Friends' listening" more={`${userUrl(me.username)}/following`} moreLabel="Following">
                      <ul className="feed">
                        {d.friends.slice(0, 8).map(f => (
                          <li key={f.user.username}>
                            <Avatar user={f.user} />
                            <div className="grow">
                              <Link className="strong" to={userUrl(f.user.username)}>{f.user.username}</Link>
                              <span><Link to={trackUrl(f.track.artist, f.track.title)}>{f.track.title}</Link> <span className="muted">by</span> <Link to={artistUrl(f.track.artist)}>{f.track.artist}</Link></span>
                            </div>
                            {f.nowPlaying ? <span className="np small">Scrobbling now <i className="eq"><i /><i /><i /></i></span> : "playedAt" in f.track && <span className="muted small">{date(f.track.playedAt, { day: "numeric", month: "short" })}</span>}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}
              <Section title={d.trendingPeriod === "week" ? "Trending artists" : "Top artists"} more="/charts"><Grid kind="artist" cols={4} items={d.trendingArtists.slice(0, 8)} /></Section>
              <Section title={d.trendingPeriod === "week" ? "Top tracks this week" : "Top tracks"} more="/charts?kind=tracks"><TrackList items={d.trendingTracks} rank={1} count="listeners" /></Section>
              <Section title={d.trendingPeriod === "week" ? "Albums on the rise" : "Top albums"} more="/charts?kind=albums"><Grid kind="album" items={d.trendingAlbums} /></Section>
            </div>
            <aside className="side">
              {me && <PlayRows />}
              {me && d.friendLoves && d.friendLoves.length > 0 && (
                <Section title="Loved by friends">
                  <ul className="plain">{d.friendLoves.map(t => (
                    <li key={t.user + t.id}><Link className="strong" to={trackUrl(t.artist, t.title)}>{t.title}</Link> <span className="muted">- {t.artist}</span><br /><span className="muted small"><Ico.Heart on /> <Link to={userUrl(t.user)}>{t.user}</Link></span></li>
                  ))}</ul>
                </Section>
              )}
              <Section title="Popular tags" more="/charts?kind=tags"><TagChips tags={d.tags} /></Section>
              <Section title="Upcoming events" more="/events"><EventList items={d.events} /></Section>
            </aside>
          </div>
        )}</Async>
      </div>
    </>
  );
}
function HomeRecent({ name }: { name: string }) {
  const q = useApi<UserRecent>(`/user/recent${qs({ name, limit: 5 })}`);
  if (!q.data?.items.length) return null;
  return <Section title="Your recent tracks" more={`${userUrl(name)}/library`} moreLabel="Library"><TrackList items={q.data.items} nowPlaying={"nowPlaying" in q.data ? q.data.nowPlaying : null} time /></Section>;
}

/** 132 becomes 130, 1,532 becomes 1,500: a round number that is never more than the real one. */
const roundDown = (n: number) => { const p = Math.max(10, 10 ** (String(Math.floor(n)).length - 2)); return Math.floor(n / p) * p; };
