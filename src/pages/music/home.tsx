import { Ico } from "../../icons";
import { useState } from "react";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { artistUrl, date, num, qs, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Async, Avatar, Empty, Section } from "../../ui/base";
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

function HomeFeed({ name }: { name: string }) {
  const q = useApi<Recommended>("/recommended");
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
        <div className="relative pr-10 mb-6 [&_h1]:m-0 [&_h1]:mb-2 [&_h1]:text-2xl [&_p]:m-0 [&_p]:max-w-[62ch] [&_p]:text-ink-2 max-sm:[&_h1]:text-xl [&+.state]:mt-0">
          <Button className="bare absolute top-0 right-0 size-7 text-[#8a8a8a]! p-0! [&_svg]:size-[18px] hover:text-ink" aria-label="Dismiss" onClick={dismiss}><Ico.X /></Button>
          <h1>Welcome to Sonosphere, {name}!</h1>
          <p>The more you scrobble, the better these picks get. Recommendations are continually updated as you scrobble more music.</p>
        </div>
      )}
      <Async q={q}>
        {d => d.artists.length
          ? <div className="columns-3 gap-x-5 mb-9 max-xl:columns-2 max-sm:columns-2 max-sm:gap-x-2.5 min-[601px]:max-lg:columns-3 min-[601px]:max-lg:gap-x-4">{mixRecs(d).map(r => <RecCard key={r.kind + r.item.id} {...r} />)}</div>
          : <Empty>You need to scrobble a few more tracks before we can recommend you anything.</Empty>}
      </Async>
    </>
  );
}

function PlayRows() {
  return (
    <ul className="list-none m-0 mb-7 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:py-3 [&_li]:border-b [&_li]:border-line [&_li]:text-base [&_li:first-child]:pt-0 [&_li>span]:min-w-0 [&_li_small.form-error]:block [&_li_small.form-error]:mt-0.5 [&_li_small.form-error]:text-[13px] [&_li_small.form-error]:font-normal [&_li_small.form-error]:leading-[1.35] [&_.play-btn]:size-[34px] [&_.play-btn]:bg-card [&_.play-btn]:text-ink [&_.play-btn]:border [&_.play-btn]:border-edge [&_.play-btn:hover]:bg-accent [&_.play-btn:hover]:border-accent [&_.play-btn:hover]:text-on-accent [&_.play-btn.on]:bg-accent [&_.play-btn.on]:border-accent [&_.play-btn.on]:text-on-accent">
      <StationRow type="library" label="Play your library" />
      <StationRow type="mix" label="Play your mix" />
      <StationRow type="recommended" label="Play your recommendations" />
    </ul>
  );
}

function Banner({ d }: { d: HomeData | null }) {
  return (
    <div className="banner bg-banner text-on-accent py-14 pb-12 [color-scheme:light] [&_h1]:mb-3.5 [&_h1]:text-[56px] [&_h1]:tracking-[-.035em] [&_h1]:text-ink [&_p]:max-w-[560px] [&_p]:text-xl [&_p]:text-ink [&_a]:text-ink [&_::selection]:bg-accent [&_::selection]:text-on-accent [&_.banner-stats]:mt-[22px] [&_.banner-stats]:text-sm! [&_.banner-stats]:text-ink-2 max-lg:[&_h1]:text-[38px] max-sm:[&_h1]:text-[32px]">
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 flex items-center gap-12 max-[861px]:flex-col max-[861px]:items-stretch max-[861px]:gap-6">
        <div className="flex-1 min-w-0 [&>.row]:mt-7">
          <h1>Track what you love.</h1>
          <p>Sonosphere scrobbles everything you play, turns it into your own charts, and finds the music and people that match your taste.</p>
          <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
            <Button kind="btn" href="/join">Join free</Button>
            <Button kind="btn" href="/login">Log in</Button>
          </div>
          {d && d.stats.users >= 10 && <p className="banner-stats mt-[22px] text-sm! text-ink-2">Join {num(roundDown(d.stats.users))}+ users scrobbling on Sonosphere</p>}
        </div>
        {d && d.trendingTracks.length > 0 && (
          <ol className="list-none m-0 p-0 w-[360px] flex-none bg-card [&_li]:flex [&_li]:items-center [&_li]:gap-3.5 [&_li]:px-4 [&_li]:py-2.5 [&_.banner-chart-head]:text-[11px] [&_.banner-chart-head]:font-medium [&_.banner-chart-head]:uppercase [&_.banner-chart-head]:tracking-[.08em] [&_.banner-chart-head]:text-ink [&_b]:w-[22px] [&_b]:font-display [&_b]:text-[26px] [&_b]:text-link [&_a]:min-w-0 [&_a]:flex-1 [&_a:hover_strong]:underline [&_strong]:block [&_strong]:truncate [&_strong]:text-ink [&_span]:block [&_span]:truncate [&_span]:text-sm [&_span]:text-muted max-[861px]:w-auto">
            <li className="banner-chart-head text-[11px] font-medium uppercase tracking-[.08em] text-ink">Top tracks right now</li>
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
      <ul className="list-none m-0 p-0 [&_li]:flex [&_li]:gap-3 [&_li]:items-center [&_li]:py-2.5 [&_li]:border-b [&_li]:border-line [&_.item-text>*]:block [&_.item-text>*]:overflow-hidden [&_.item-text>*]:text-ellipsis [&_li.unread]:bg-accent-faint [&_li.unread]:border-l-[3px] [&_li.unread]:border-l-accent [&_li.unread]:pl-2.5">
        {friends.slice(0, 8).map(f => (
          <li key={f.user.username}>
            <Avatar user={f.user} />
            <div className="item-text flex-1 min-w-0">
              <Link className="font-semibold" to={userUrl(f.user.username)}>{f.user.username}</Link> <UserLabels name={f.user.username} />
              <span>
                <Link to={trackUrl(f.track.artist, f.track.title)}>{f.track.title}</Link> <span className="text-muted">by</span>{" "}
                <Link to={artistUrl(f.track.artist)}>{f.track.artist}</Link>
              </span>
            </div>
            {f.nowPlaying
              ? <span className="text-accent-dark font-semibold whitespace-nowrap max-sm:[.c-time_&]:whitespace-normal text-[13px]">Scrobbling now <i className="inline-flex gap-0.5 items-end h-[11px] ml-[3px] [&_i]:w-[3px] [&_i]:bg-accent [&_i]:animate-eq [&_i:nth-child(2)]:[animation-delay:-.3s] [&_i:nth-child(3)]:[animation-delay:-.6s] reduced:[&_i]:animate-none reduced:[&_i]:h-2"><i /><i /><i /></i></span>
              : "playedAt" in f.track && <span className="text-muted text-[13px]">{date(f.track.playedAt, { day: "numeric", month: "short" })}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function FriendLoves({ items }: { items: FriendLove[] }) {
  return (
    <Section title="Loved by friends">
      <ul className="list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">
        {items.map(t => (
          <li key={t.user + t.id}>
            <Link className="font-semibold" to={trackUrl(t.artist, t.title)}>{t.title}</Link> <span className="text-muted">- {t.artist}</span>
            <br />
            <span className="text-muted text-[13px]"><Ico.Heart on /> <Link to={userUrl(t.user)}>{t.user}</Link></span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Home() {
  const { me } = useAuth();
  const q = useApi<HomeData>("/home");
  useTitle(me ? "Home" : "Track what you love");
  return (
    <>
      {!me && <Banner d={q.data} />}
      {me && <HomeTabs at="home" />}
      <div className={me ? "w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 max-sm:pt-[18px] max-sm:pb-8 pt-0 pb-0 [&>.cols]:gap-0 [&>.cols]:items-stretch [&_.state+.cols]:gap-0 [&_.state+.cols]:items-stretch [&_.cols>.main]:py-7 [&_.cols>.main]:pr-8 [&_.cols>.main]:pb-12 [&_.cols>.main]:min-w-0 [&_.cols>.main]:border-t-0 [&_.cols>.main]:relative [&_.cols>.main::before]:content-[''] [&_.cols>.main::before]:absolute [&_.cols>.main::before]:top-0 [&_.cols>.main::before]:right-0 [&_.cols>.main::before]:w-screen [&_.cols>.main::before]:h-px [&_.cols>.main::before]:bg-line [&_.cols>.main::before]:pointer-events-none [&_.cols>.side]:bg-panel [&_.cols>.side]:border-l [&_.cols>.side]:border-line [&_.cols>.side]:py-7 [&_.cols>.side]:pl-6 [&_.cols>.side]:pb-12 [&_.cols>.side]:shadow-[100vw_0_0_100vw_var(--panel)] [&_.cols>.side]:[clip-path:inset(0_-100vw_0_0)] [&>.page-title]:mt-7 max-lg:[&_.cols>.main]:pr-0 max-lg:[&_.cols>.main]:pb-6 max-lg:[&_.cols>.side]:border-0 max-lg:[&_.cols>.side]:px-4 max-lg:[&_.cols>.side]:py-5 max-lg:[&_.cols>.side]:shadow-none max-lg:[&_.cols>.side]:[clip-path:none] max-lg:[&_.cols>.side]:-mx-4 max-lg:[&_.cols>.main::before]:hidden" : "w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8"}>
        <Async q={q}>{d => {
          const week = d.trendingPeriod === "week";
          return (
            <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
              <div className="main min-w-0">
                {me && (
                  <>
                    <HomeFeed name={me.username} />
                    <HomeRecent name={me.username} />
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
              <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
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
  const q = useApi<UserRecent>(`/user/recent${qs({ name, limit: 5 })}`);
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
