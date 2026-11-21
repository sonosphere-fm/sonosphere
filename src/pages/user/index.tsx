import { Arrow, Ico } from "../../icons";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Button } from "../../kit";
import { Markdown } from "../../md";
import { StationButton } from "../../player";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, artistUrl, date, invalidateAll, dec, num, prefetch, qs, trackUrl, useApi, useAuth, userUrl, useTitle } from "../../lib";
import { Art, Async, Empty, Pane, PeriodPicker, Section, Stat, Tabs } from "../../ui/base";
import { EventList } from "../../ui/events";
import { FollowButton, Grid, TrackList } from "../../ui/lists";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import { Hero } from "../music/shared";
import type { BlockResult } from "../../../shared/blocks";
import type { UserEvents as UserEventList } from "../../../shared/events";
import type { TopAlbum, TopArtist, TopTrack } from "../../../shared/listening";
import type { SuspendResult } from "../../../shared/reports";
import type { Profile, UserRecent, UserTop } from "../../../shared/users";
import { Journal, JournalPost, JournalEditor } from "./journal";
import { Library, LibraryArtist } from "./library";
import { Report } from "./report";
import { People, Neighbours, Loved, Obsessions, Playlists, UserTags } from "./social";

type Tab = "overview" | "library" | "library-artist" | "report" | "following" | "followers" | "loved" | "obsessions" | "playlists" | "events" | "neighbours" | "tags" | "shoutbox" | "journal" | "journal-new" | "journal-post" | "journal-edit";
export function UserPage({ tab }: { tab: Tab }) {
  const p = useParams(), name = p.name!, base = userUrl(name);
  const q = useApi<Profile>(`/user${qs({ name })}`);
  const { me } = useAuth();
  useTitle(q.data ? `${q.data.username}'s music profile` : name);
  return (
    <Async q={q}>{u => {
      const mine = me?.username === u.username, locked = u.locked && !mine;
      // a private listener's profile has no listening tabs, numbers or station for anyone else
      const listening = new Set([`${base}/listening-report`, `${base}/library`, `${base}/loved`, `${base}/soundalikes`]);
      const tabs: [string, string, boolean?][] = [[base, "Overview", true], [`${base}/listening-report`, "Reports"], [`${base}/library`, "Library"], [`${base}/following`, `Following (${u.following})`], [`${base}/followers`, "Followers"], [`${base}/loved`, "Loved"], [`${base}/journal`, "Journal"], [`${base}/earworms`, "Earworms"], [`${base}/playlists`, "Playlists"], [`${base}/events`, "Events"], [`${base}/soundalikes`, "Soundalikes"], [`${base}/tags`, "Tags"], [`${base}/wall`, `Wall (${u.shoutCount})`]];
      const shut = <Empty>{u.username} keeps their listening private.</Empty>;
      return (
        <>
          <Hero tabs={<Tabs items={locked ? tabs.filter(t => !listening.has(t[0])) : tabs} />} image={u.image}
            art={<Art image={u.image} kind="user" />} kicker={u.followsYou ? "Follows you" : "Listener"} title={u.username}
            sub={<>{[u.realname, u.pronouns, u.country].filter(Boolean).join(" · ")}{(u.realname || u.pronouns || u.country) && " · "}scrobbling since {date(u.registeredAt)}</>}
            stats={locked ? <Stat label="Followers" value={<Link to={`${base}/followers`}>{num(u.followers)}</Link>} /> : <><Stat label="Scrobbles" value={<Link to={`${base}/library`}>{num(u.playcount)}</Link>} /><Stat label="Artists" value={<Link to={`${base}/library/artists`}>{num(u.artistCount)}</Link>} />
              <Stat label="Loved tracks" value={<Link to={`${base}/loved`}>{num(u.lovedCount)}</Link>} /><Stat label="Followers" value={<Link to={`${base}/followers`}>{num(u.followers)}</Link>} /></>}
            actions={mine ? <><Button kind="btn ghost" href="/settings">Edit profile</Button><Button kind="btn ghost" href="/scrobble">Scrobble manually</Button></> : <>{!u.blocked && <FollowButton username={u.username} following={u.isFollowing} onChange={q.reload} />}{!u.hidden && <StationButton type="library" name={u.username} label="Play library" ghost />}{me && !u.blocked && <Button kind="btn ghost" href={`/messages/to/${encodeURIComponent(u.username)}`}>Message</Button>}{me && <ProfileMenu u={u} onChange={q.reload} />}</>} />
          <div className="wrap page">
            {u.blocked && <p className="notice">You've blocked {u.username}. They can't follow you or post on your profile, and you won't see their wall posts. <Button kind="link" type="button" onClick={() => api<BlockResult>("/block", { body: { username: u.username, block: false } }).then(q.reload)}>Unblock</Button></p>}
            {u.suspended && (mine || me?.admin) && <p className="notice">{mine ? "Your account has been suspended from posting on walls, wikis and journal posts by a moderator. Listening and scrobbling still work." : `${u.username} is suspended from posting.`}</p>}
            <Pane>
            {tab === "journal" && <Journal name={u.username} mine={mine} />}
            {tab === "journal-post" && <JournalPost name={u.username} id={Number(p.post)} mine={mine} />}
            {tab === "journal-new" && (mine ? <JournalEditor name={u.username} /> : <Empty>Only {u.username} can write here.</Empty>)}
            {tab === "journal-edit" && (mine ? <JournalEditor name={u.username} id={Number(p.post)} /> : <Empty>Only {u.username} can edit this post.</Empty>)}
            {tab === "overview" && <Overview u={u} mine={mine} locked={locked} />}
            {locked && (tab === "library" || tab === "library-artist" || tab === "report" || tab === "loved" || tab === "neighbours") && shut}
            {tab === "library" && !locked && <Library name={u.username} mine={mine} />}
            {tab === "library-artist" && !locked && <LibraryArtist name={u.username} artist={dec(p.artist)} />}
            {tab === "report" && !locked && <Report name={u.username} type={p.type === "year" ? "year" : "week"} />}
            {tab === "following" && <People path={`/user/following${qs({ name })}`} empty={`${u.username} isn't following anyone yet.`} />}
            {tab === "followers" && <People path={`/user/followers${qs({ name })}`} empty="No followers yet." />}
            {tab === "loved" && !locked && <Loved name={u.username} />}
            {tab === "obsessions" && <Obsessions name={u.username} mine={mine} />}
            {tab === "playlists" && <Playlists name={u.username} mine={mine} />}
            {tab === "events" && <UserEvents name={u.username} />}
            {tab === "neighbours" && !locked && <Neighbours name={u.username} />}
            {tab === "tags" && <UserTags name={u.username} />}
            {tab === "shoutbox" && <Shoutbox type="user" id={u.id} />}
            </Pane>
          </div>
        </>
      );
    }}</Async>
  );
}

/** The "…" menu on someone else's profile: block, report and, for moderators, suspend. */
function ProfileMenu({ u, onChange }: { u: Profile; onChange: () => void }) {
  const { me } = useAuth(), [reporting, setReporting] = useState(false);
  const done = () => { invalidateAll(); onChange(); };
  return (
    <>
      <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={200} button={{ label: `More actions for ${u.username}`, variant: "secondary", className: "more-btn", children: <Ico.More /> }}>
        <DropdownMenuItem label={u.blocked ? "Unblock user" : "Block user"} onClick={() => api<BlockResult>("/block", { body: { username: u.username, block: !u.blocked } }).then(done)} />
        <DropdownMenuItem label="Report profile" onClick={() => setReporting(true)} />
        {me?.admin && <DropdownMenuItem label={u.suspended ? "Lift suspension" : "Suspend from posting"} onClick={() => api<SuspendResult>("/mod/suspend", { body: { username: u.username, suspended: !u.suspended } }).then(done)} />}
      </DropdownMenu>
      <ReportButton type="user" id={u.id} open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}
function UserEvents({ name }: { name: string }) {
  const q = useApi<UserEventList>(`/user/events${qs({ name })}`);
  return <Async q={q}>{d => d.items.length ? <EventList items={d.items} /> : <Empty>No events yet. <Link to="/events">Find something to go to <Ico.Right /></Link></Empty>}</Async>;
}
function Overview({ u, mine, locked }: { u: Profile; mine: boolean; locked: boolean }) {
  if (locked) return (
    <div className="cols">
      <div className="main">
        <Section title="Listening"><Empty>{u.username} keeps their listening private.</Empty></Section>
        <Section title="Wall" more={`${userUrl(u.username)}/wall`} moreLabel="Whole wall"><Shoutbox type="user" id={u.id} limit={5} /></Section>
      </div>
      <aside className="side"><About u={u} /><Earworm u={u} /></aside>
    </div>
  );
  return <OpenOverview u={u} mine={mine} />;
}
function About({ u }: { u: Profile }) {
  return u.about || u.website ? <Section title="About"><Markdown text={u.about} />{u.website && <p><a href={u.website} rel="nofollow noopener noreferrer" target="_blank">{u.website.replace(/^https?:\/\//, "")}</a></p>}</Section> : null;
}
function Earworm({ u }: { u: Profile }) {
  return u.obsession ? (
    <Section title="Current earworm" more={`${userUrl(u.username)}/earworms`} moreLabel="All">
      <div className="obsession"><Link to={trackUrl(u.obsession.artist, u.obsession.title)}><Art image={u.obsession.image} /></Link>
        <div><Link className="strong" to={trackUrl(u.obsession.artist, u.obsession.title)}>{u.obsession.title}</Link><Link className="muted" to={artistUrl(u.obsession.artist)}>{u.obsession.artist}</Link>{u.obsession.comment && <p className="small">“{u.obsession.comment}”</p>}</div></div>
    </Section>
  ) : null;
}
function OpenOverview({ u, mine }: { u: Profile; mine: boolean }) {
  const base = userUrl(u.username), [sp] = useSearchParams(), period = sp.get("period") || "7day";
  const paths = [`/user/recent${qs({ name: u.username, limit: 10 })}`, ...(["artists", "albums", "tracks"] as const).map(kind => `/user/top${qs({ name: u.username, kind, period, limit: kind === "tracks" ? 10 : 8 })}`)];
  // each useApi waits for its own reply before the next one runs, so ask for all of them (and the wall) up front
  for (const p of [...paths, `/shouts${qs({ type: "user", id: u.id, page: 1, limit: 5 })}`]) prefetch(p);
  const recent = useApi<UserRecent>(paths[0]);
  const artists = useApi<UserTop<TopArtist>>(paths[1]);
  const albums = useApi<UserTop<TopAlbum>>(paths[2]);
  const tracks = useApi<UserTop<TopTrack>>(paths[3]);
  useEffect(() => { const h = () => recent.reload(); window.addEventListener("spin:scrobble", h); return () => window.removeEventListener("spin:scrobble", h); }, [recent.reload]);
  return (
    <div className="cols">
      <div className="main">
        <Section title="Recent tracks" more={`${base}/library`} moreLabel="More tracks">
          <Async q={recent}>{d => "hidden" in d ? <Empty>{u.username} keeps their recent listening private.</Empty> : d.items.length || d.nowPlaying ? <TrackList items={d.items} nowPlaying={d.nowPlaying} time /> :
            <Empty>{mine ? <>Nothing scrobbled yet. Press play on any track, <Link to="/scrobble">scrobble manually</Link>, or connect a scrobbler from <Link to="/settings/applications">Settings<Arrow say=", " />Applications</Link>.</> : "No scrobbles yet."}</Empty>}</Async>
        </Section>
        <div className="toolbar"><h2>Top music</h2><PeriodPicker def="7day" /></div>
        <Section title="Top artists" more={`${base}/library/artists?period=${period}`}><Async q={artists}>{d => <Grid kind="artist" cols={4} items={d.items} sub={a => `${num(a.playcount)} scrobbles`} />}</Async></Section>
        <Section title="Top albums" more={`${base}/library/albums?period=${period}`}><Async q={albums}>{d => <Grid kind="album" cols={4} items={d.items} sub={a => `${num(a.playcount)} scrobbles`} />}</Async></Section>
        <Section title="Top tracks" more={`${base}/library/tracks?period=${period}`}><Async q={tracks}>{d => <TrackList items={d.items} rank={1} count="playcount" />}</Async></Section>
        <Section title="Wall" more={`${base}/wall`} moreLabel="Whole wall"><Shoutbox type="user" id={u.id} limit={5} /></Section>
      </div>
      <aside className="side">
        <About u={u} />
        {u.taste && (
          <Section title="Your compatibility">
            <div className="taste"><div className="taste-bar"><span style={{ width: `${Math.max(4, u.taste.score * 100)}%` }} /></div><b>{u.taste.label}</b></div>
            {u.taste.artists.length > 0 ? <p className="small">You both listen to {u.taste.artists.map((a, i) => <span key={a.name}>{i > 0 && ", "}<Link to={artistUrl(a.name)}>{a.name}</Link></span>)}.</p> : <p className="muted small">No artists in common yet.</p>}
          </Section>
        )}
        <Earworm u={u} />
        <Section title="Library"><ul className="plain"><li><Link to={`${base}/library/artists`}>{num(u.artistCount)} artists</Link></li><li><Link to={`${base}/library/albums`}>{num(u.albumCount)} albums</Link></li><li><Link to={`${base}/library/tracks`}>{num(u.trackCount)} tracks</Link></li>
          <li><Link to={`${base}/listening-report/week`}>Weekly listening report</Link></li><li><Link to={`${base}/listening-report/year`}>Yearly listening report</Link></li></ul></Section>
      </aside>
    </div>
  );
}
