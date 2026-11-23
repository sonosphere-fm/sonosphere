import { Arrow, Ico } from "../../icons";
import { useState } from "react";
import { DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Button } from "../../kit";
import { Markdown } from "../../md";
import { StationButton } from "../../player";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { usernameRedirect } from "../../../shared/username-redirect";
import {
  api,
  artistUrl,
  date,
  invalidateAll,
  dec,
  num,
  prefetch,
  qs,
  trackUrl,
  useApi,
  useAuth,
  userUrl,
  TITLES,
  useTitle,
  userTitle,
} from "../../lib";
import { Art, Async, Empty, Pane, PeriodPicker, Section, Stat, Tabs } from "../../ui/base";
import { EventList } from "../../ui/events";
import { FollowButton, Grid, TrackList } from "../../ui/lists";
import { MoreMenu } from "../../ui/more-menu";
import { ScrobbleMenu } from "../../ui/scrobble-menu";
import { shortUrl } from "../../../shared/paths";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import { Hero } from "../music/shared";
import { UserLabels } from "../../ui/user-labels";
import { Username } from "../../ui/username";
import { ProfileShellTheme, profileAccentStyle } from "../../ui/profile-accent";
import type { BlockResult } from "../../../shared/blocks";
import type { UserEvents as UserEventList } from "../../../shared/events";
import type { TopAlbum, TopArtist, TopTrack } from "../../../shared/listening";
import type { SuspendResult } from "../../../shared/reports";
import type { Profile, UserRecent, UserTop } from "../../../shared/users";
import { Journal, JournalPost, JournalEditor } from "./journal";
import { Library, LibraryArtist } from "./library";
import { Report } from "./report";
import { People, Neighbours, Loved, Obsessions, Playlists, UserTags } from "./social";

type Tab =
  | "overview"
  | "library"
  | "library-artist"
  | "report"
  | "following"
  | "followers"
  | "loved"
  | "obsessions"
  | "playlists"
  | "events"
  | "neighbours"
  | "tags"
  | "shoutbox"
  | "journal"
  | "journal-new"
  | "journal-post"
  | "journal-edit";

const TITLE_TABS: Partial<Record<Tab, string>> = { "library-artist": "library", report: "listening-report" };

function pageTitle(name: string, tab: Tab) {
  if (tab === "journal-post") return null;
  if (tab === "journal-new" || tab === "journal-edit") return TITLES.editJournal;
  return userTitle(name, TITLE_TABS[tab] ?? tab);
}

const LISTENING_TABS: Tab[] = ["library", "library-artist", "report", "loved", "neighbours"];

const setBlock = (username: string, block: boolean) => api<BlockResult>("/block", { body: { username, block } });

function profileTabs(u: Profile, base: string, locked: boolean) {
  const tabs: [string, string, boolean?][] = [
    [base, "Overview", true],
    [`${base}/listening-report`, "Reports"],
    [`${base}/library`, "Library"],
    [`${base}/following`, `Following (${u.following})`],
    [`${base}/followers`, `Followers (${u.followers})`],
    [`${base}/loved`, "Loved"],
    [`${base}/journal`, "Journal"],
    [`${base}/earworms`, "Earworms"],
    [`${base}/playlists`, "Playlists"],
    [`${base}/events`, "Events"],
    [`${base}/soundalikes`, "Soundalikes"],
    [`${base}/tags`, "Tags"],
    [`${base}/wall`, `Wall (${u.shoutCount})`],
  ];
  if (!locked) return tabs;
  // A private listener's profile has no listening tabs, numbers or station for anyone else.
  const listening = new Set([`${base}/listening-report`, `${base}/library`, `${base}/loved`, `${base}/soundalikes`]);
  return tabs.filter((t) => !listening.has(t[0]));
}

function ProfileStats({ u, base, locked }: { u: Profile; base: string; locked: boolean }) {
  const followers = <Stat label="Followers" value={<Link to={`${base}/followers`}>{num(u.followers)}</Link>} />;
  if (locked) return followers;
  return (
    <>
      <Stat label="Scrobbles" value={<Link to={`${base}/library`}>{num(u.playcount)}</Link>} />
      <Stat label="Artists" value={<Link to={`${base}/library/artists`}>{num(u.artistCount)}</Link>} />
      <Stat label="Loved tracks" value={<Link to={`${base}/loved`}>{num(u.lovedCount)}</Link>} />
      {followers}
    </>
  );
}

function ProfileActions({ u, mine, onChange }: { u: Profile; mine: boolean; onChange: () => void }) {
  const { me } = useAuth();
  if (mine) {
    return (
      <>
        <Button kind="btn ghost" href="/settings">
          Edit profile
        </Button>
        <Button kind="btn ghost" href="/scrobble">
          Scrobble manually
        </Button>
        <MoreMenu label={`More actions for ${u.username}`} link={shortUrl(u.username)} />
      </>
    );
  }
  return (
    <>
      {!u.blocked && <FollowButton username={u.username} following={u.isFollowing} onChange={onChange} />}
      {!u.hidden && <StationButton type="library" name={u.username} label="Play library" ghost />}
      {me && !u.blocked && (
        <Button kind="btn ghost" href={`/messages/to/${encodeURIComponent(u.username)}`}>
          Message
        </Button>
      )}
      <ProfileMenu u={u} onChange={onChange} />
    </>
  );
}

export function UserPage({ tab }: { tab: Tab }) {
  const p = useParams();
  const name = p.name!;
  const base = userUrl(name);
  const q = useApi<Profile>(`/user${qs({ name })}`);
  const { me } = useAuth();
  useTitle(pageTitle(name, tab));
  const location = useLocation();
  const redirect = q.data
    ? usernameRedirect(
        new URL(location.pathname + location.search + location.hash, window.location.origin),
        q.data.username
      )
    : null;
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <Async q={q}>
      {(u) => {
        const mine = me?.username === u.username;
        const locked = u.locked && !mine;
        const details = [u.realname, u.pronouns, u.country].filter(Boolean).join(" · ");
        const sub = (
          <>
            {details}
            {details && " · "}scrobbling since {date(u.registeredAt)}
          </>
        );
        return (
          <div
            className="profile-theme"
            data-profile-accent={u.profileAccent ? "custom" : undefined}
            style={profileAccentStyle(u)}
          >
            <ProfileShellTheme user={u} name={name} />
            <Hero
              tabs={<Tabs items={profileTabs(u, base, locked)} />}
              banner={u.banner}
              art={<Art image={u.image} kind="user" />}
              kicker={u.followsYou ? "Follows you" : "Listener"}
              title={
                <span className="hero-name">
                  <Username user={u} />
                  <UserLabels name={u.username} all large />
                </span>
              }
              sub={sub}
              stats={<ProfileStats u={u} base={base} locked={locked} />}
              actions={<ProfileActions u={u} mine={mine} onChange={q.reload} />}
            />
            <div className="wrap page">
              {u.blocked && (
                <p className="notice">
                  You've blocked <Username user={u} />. They can't follow you or post on your profile, and you won't see
                  their wall posts.{" "}
                  <Button kind="link" type="button" onClick={() => setBlock(u.username, false).then(q.reload)}>
                    Unblock
                  </Button>
                </p>
              )}
              {u.suspended && (mine || me?.admin) && (
                <p className="notice">
                  {mine ? (
                    "Your account has been suspended from posting on walls, wikis and journal posts by a moderator. Listening and scrobbling still work."
                  ) : (
                    <>
                      <Username user={u} /> is suspended from posting.
                    </>
                  )}
                </p>
              )}
              <Pane>
                {tab === "journal" && <Journal name={u.username} mine={mine} />}
                {tab === "journal-post" && <JournalPost name={u.username} id={Number(p.post)} mine={mine} />}
                {tab === "journal-new" &&
                  (mine ? (
                    <JournalEditor name={u.username} />
                  ) : (
                    <Empty>
                      Only <Username user={u} /> can write here.
                    </Empty>
                  ))}
                {tab === "journal-edit" &&
                  (mine ? (
                    <JournalEditor name={u.username} id={Number(p.post)} />
                  ) : (
                    <Empty>
                      Only <Username user={u} /> can edit this post.
                    </Empty>
                  ))}
                {tab === "overview" && <Overview u={u} mine={mine} locked={locked} />}
                {locked && LISTENING_TABS.includes(tab) && (
                  <Empty>
                    <Username user={u} /> keeps their listening private.
                  </Empty>
                )}
                {tab === "library" && !locked && <Library name={u.username} mine={mine} />}
                {tab === "library-artist" && !locked && <LibraryArtist name={u.username} artist={dec(p.artist)} />}
                {tab === "report" && !locked && <Report name={u.username} type={p.type === "year" ? "year" : "week"} />}
                {tab === "following" && (
                  <People
                    path={`/user/following${qs({ name })}`}
                    empty={
                      <>
                        <Username user={u} /> isn't following anyone yet.
                      </>
                    }
                  />
                )}
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
          </div>
        );
      }}
    </Async>
  );
}

function ProfileMenu({ u, onChange }: { u: Profile; onChange: () => void }) {
  const { me } = useAuth();
  const [reporting, setReporting] = useState(false);

  const done = () => {
    invalidateAll();
    onChange();
  };
  const toggleBlock = () => setBlock(u.username, !u.blocked).then(done);
  const toggleSuspend = () =>
    api<SuspendResult>("/mod/suspend", { body: { username: u.username, suspended: !u.suspended } }).then(done);

  return (
    <>
      <MoreMenu label={`More actions for ${u.username}`} link={shortUrl(u.username)}>
        {me && <DropdownMenuItem label={u.blocked ? "Unblock user" : "Block user"} onClick={toggleBlock} />}
        {me && <DropdownMenuItem label="Report profile" onClick={() => setReporting(true)} />}
        {me?.admin && (
          <DropdownMenuItem label={u.suspended ? "Lift suspension" : "Suspend from posting"} onClick={toggleSuspend} />
        )}
      </MoreMenu>
      <ReportButton type="user" id={u.id} open={reporting} onClose={() => setReporting(false)} />
    </>
  );
}

function UserEvents({ name }: { name: string }) {
  const q = useApi<UserEventList>(`/user/events${qs({ name })}`);
  return (
    <Async q={q}>
      {(d) =>
        d.items.length ? (
          <EventList items={d.items} />
        ) : (
          <Empty>
            No events yet.{" "}
            <Link to="/events">
              Find something to go to <Ico.Right />
            </Link>
          </Empty>
        )
      }
    </Async>
  );
}

function Overview({ u, mine, locked }: { u: Profile; mine: boolean; locked: boolean }) {
  if (!locked) return <OpenOverview u={u} mine={mine} />;
  return (
    <div className="cols">
      <div className="main">
        <Section title="Listening">
          <Empty>
            <Username user={u} /> keeps their listening private.
          </Empty>
        </Section>
        <Section title="Wall" more={`${userUrl(u.username)}/wall`} moreLabel="Whole wall">
          <Shoutbox type="user" id={u.id} limit={5} />
        </Section>
      </div>
      <aside className="side">
        <About u={u} />
        <Earworm u={u} />
      </aside>
    </div>
  );
}

function About({ u }: { u: Profile }) {
  if (!u.about && !u.website && !u.links?.length) return null;
  return (
    <Section title="About">
      <div className="profile-about">
        <Markdown text={u.about} images />
        {!!u.links?.length && (
          <ul className="list-none m-0 p-0 grid gap-2 [overflow-wrap:anywhere]">
            {u.links.map((link, i) => (
              <li key={i}>
                <a href={link.url} rel="nofollow noopener noreferrer" target="_blank">
                  {link.label || link.url.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        )}
        {u.website && (
          <p>
            <a href={u.website} rel="nofollow noopener noreferrer" target="_blank">
              {u.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
      </div>
    </Section>
  );
}

function Earworm({ u }: { u: Profile }) {
  const o = u.obsession;
  if (!o) return null;
  return (
    <Section title="Current earworm" more={`${userUrl(u.username)}/earworms`} moreLabel="All">
      <div className="obsession">
        <Link to={trackUrl(o.artist, o.title)}>
          <Art image={o.image} />
        </Link>
        <div>
          <Link className="strong" to={trackUrl(o.artist, o.title)}>
            {o.title}
          </Link>
          <Link className="muted" to={artistUrl(o.artist)}>
            {o.artist}
          </Link>
          {o.comment && <p className="small">“{o.comment}”</p>}
        </div>
      </div>
    </Section>
  );
}

function Compatibility({ taste }: { taste: NonNullable<Profile["taste"]> }) {
  return (
    <Section title="Your compatibility">
      <div className="taste">
        <div className="taste-bar">
          <span style={{ width: `${Math.max(4, taste.score * 100)}%` }} />
        </div>
        <b>{taste.label}</b>
      </div>
      {taste.artists.length > 0 ? (
        <p className="small">
          You both listen to{" "}
          {taste.artists.map((a, i) => (
            <span key={a.name}>
              {i > 0 && ", "}
              <Link to={artistUrl(a.name)}>{a.name}</Link>
            </span>
          ))}
          .
        </p>
      ) : (
        <p className="muted small">No artists in common yet.</p>
      )}
    </Section>
  );
}

function RecentTracks({ d, u, mine }: { d: UserRecent; u: Profile; mine: boolean }) {
  if ("hidden" in d)
    return (
      <Empty>
        <Username user={u} /> keeps their recent listening private.
      </Empty>
    );
  if (d.items.length || d.nowPlaying)
    return (
      <TrackList
        items={d.items}
        nowPlaying={d.nowPlaying}
        time
        timeActions={mine ? (r) => <ScrobbleMenu row={r} /> : undefined}
      />
    );
  if (!mine) return <Empty>No scrobbles yet.</Empty>;
  return (
    <Empty>
      Nothing scrobbled yet. Press play on any track, <Link to="/scrobble">scrobble manually</Link>, or connect a
      scrobbler from{" "}
      <Link to="/settings/applications">
        Settings
        <Arrow say=", " />
        Applications
      </Link>
      .
    </Empty>
  );
}

function OpenOverview({ u, mine }: { u: Profile; mine: boolean }) {
  const base = userUrl(u.username);
  const [sp] = useSearchParams();
  const period = sp.get("period") || "7day";
  const top = (kind: "artists" | "albums" | "tracks") =>
    `/user/top${qs({ name: u.username, kind, period, limit: kind === "tracks" ? 10 : 8 })}`;
  const paths = [`/user/recent${qs({ name: u.username, limit: 10 })}`, top("artists"), top("albums"), top("tracks")];
  // Each useApi waits for its own reply before the next one runs, so ask for all of them (and the wall) up front.
  for (const p of [...paths, `/shouts${qs({ type: "user", id: u.id, page: 1, limit: 5 })}`]) prefetch(p);
  const recent = useApi<UserRecent>(paths[0]);
  const artists = useApi<UserTop<TopArtist>>(paths[1]);
  const albums = useApi<UserTop<TopAlbum>>(paths[2]);
  const tracks = useApi<UserTop<TopTrack>>(paths[3]);

  return (
    <div className="cols">
      <div className="main">
        <Section title="Recent tracks" more={`${base}/library`} moreLabel="More tracks">
          <Async q={recent}>{(d) => <RecentTracks d={d} u={u} mine={mine} />}</Async>
        </Section>
        <div className="toolbar">
          <h2>Top music</h2>
          <PeriodPicker def="7day" />
        </div>
        <Section title="Top artists" more={`${base}/library/artists?period=${period}`}>
          <Async q={artists}>
            {(d) => <Grid kind="artist" cols={4} items={d.items} sub={(a) => `${num(a.playcount)} scrobbles`} />}
          </Async>
        </Section>
        <Section title="Top albums" more={`${base}/library/albums?period=${period}`}>
          <Async q={albums}>
            {(d) => <Grid kind="album" cols={4} items={d.items} sub={(a) => `${num(a.playcount)} scrobbles`} />}
          </Async>
        </Section>
        <Section title="Top tracks" more={`${base}/library/tracks?period=${period}`}>
          <Async q={tracks}>{(d) => <TrackList items={d.items} rank={1} count="playcount" />}</Async>
        </Section>
        <Section title="Wall" more={`${base}/wall`} moreLabel="Whole wall">
          <Shoutbox type="user" id={u.id} limit={5} />
        </Section>
      </div>
      <aside className="side">
        <About u={u} />
        {u.taste && <Compatibility taste={u.taste} />}
        <Earworm u={u} />
        <Section title="Library">
          <ul className="plain">
            <li>
              <Link to={`${base}/library/artists`}>{num(u.artistCount)} artists</Link>
            </li>
            <li>
              <Link to={`${base}/library/albums`}>{num(u.albumCount)} albums</Link>
            </li>
            <li>
              <Link to={`${base}/library/tracks`}>{num(u.trackCount)} tracks</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/week`}>Weekly listening report</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/year`}>Yearly listening report</Link>
            </li>
          </ul>
        </Section>
      </aside>
    </div>
  );
}
