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
import { Art, Async, DateRange, Empty, Pane, Section, Stat, Tabs, useRange } from "../../ui/base";
import { EventList } from "../../ui/events";
import { FollowButton, Grid, TrackList } from "../../ui/lists";
import { MoreMenu } from "../../ui/more-menu";
import { ScrobbleMenu } from "../../ui/scrobble-menu";
import { shortUrl } from "../../../shared/paths";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import { Hero } from "../music/shared";
import { ProfileLinkIcon } from "../../ui/profile-link-icon";
import { t, tx } from "../../i18n";
import { UserLabels } from "../../ui/user-labels";
import { Username } from "../../ui/username";
import { CosmeticAvatar } from "../../ui/cosmetics";
import { ProfileCosmetics } from "../../ui/profile-cosmetics";
import CosmeticsSettings from "../../ui/cosmetics-settings";
import { ProfileShellTheme, profileAccentStyle } from "../../ui/profile-accent";
import type { BlockResult } from "../../../shared/blocks";
import type { UserEvents as UserEventList } from "../../../shared/events";
import { reportType, type TopAlbum, type TopArtist, type TopTrack } from "../../../shared/listening";
import type { SuspendResult } from "../../../shared/reports";
import type { Profile, UserRecent, UserTop } from "../../../shared/users";
import type { TasteLabel } from "../../../shared/recommend";
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
  | "cosmetics"
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
    [base, t("user.tabOverview"), true],
    [`${base}/listening-report`, t("user.tabReports")],
    [`${base}/library`, t("user.tabLibrary")],
    [`${base}/following`, t("user.tabFollowing", { count: u.following })],
    [`${base}/followers`, t("user.tabFollowers", { count: u.followers })],
    [`${base}/loved`, t("user.tabLoved")],
    [`${base}/journal`, t("user.tabJournal")],
    [`${base}/earworms`, t("user.tabEarworms")],
    [`${base}/playlists`, t("user.tabPlaylists")],
    [`${base}/events`, t("user.tabEvents")],
    [`${base}/soundalikes`, t("user.tabSoundalikes")],
    [`${base}/tags`, t("user.tabTags")],
    [`${base}/wall`, t("user.tabWall", { count: u.shoutCount })],
  ];
  if (!locked) return tabs;
  // A private listener's profile has no listening tabs, numbers or station for anyone else.
  const listening = new Set([`${base}/listening-report`, `${base}/library`, `${base}/loved`, `${base}/soundalikes`]);
  return tabs.filter((t) => !listening.has(t[0]));
}

function ProfileStats({ u, base, locked }: { u: Profile; base: string; locked: boolean }) {
  const followers = (
    <Stat label={t("user.statFollowers")} value={<Link to={`${base}/followers`}>{num(u.followers)}</Link>} />
  );
  if (locked) return followers;
  return (
    <>
      <Stat label={t("user.statScrobbles")} value={<Link to={`${base}/library`}>{num(u.playcount)}</Link>} />
      <Stat label={t("user.statArtists")} value={<Link to={`${base}/library/artists`}>{num(u.artistCount)}</Link>} />
      <Stat label={t("user.statLovedTracks")} value={<Link to={`${base}/loved`}>{num(u.lovedCount)}</Link>} />
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
          {t("user.editProfile")}
        </Button>
        <Button kind="btn ghost" href={`${userUrl(u.username)}/cosmetics`}>
          {t("user.cosmetics")}
        </Button>
        <Button kind="btn ghost" href="/scrobble">
          {t("user.scrobbleManually")}
        </Button>
        <MoreMenu label={t("user.moreActions", { name: u.username })} link={shortUrl(u.username)} />
      </>
    );
  }
  return (
    <>
      {!u.blocked && <FollowButton username={u.username} following={u.isFollowing} onChange={onChange} />}
      {!u.hidden && <StationButton type="library" name={u.username} label={t("user.playLibrary")} ghost />}
      {me && !u.blocked && (
        <Button kind="btn ghost" href={`/messages/to/${encodeURIComponent(u.username)}`}>
          {t("user.message")}
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
        const since = t("user.scrobblingSince", { date: date(u.registeredAt) });
        const sub = details ? `${details} · ${since}` : since;
        return (
          <div
            className="profile-theme"
            data-cos-motion={u.showCosmetics !== false ? "on" : "off"}
            data-now-playing={u.nowPlaying ? "on" : "off"}
            data-scrobble-fx={u.cosmetics?.find((c) => c.slot === "scrobble_fx")?.id}
            data-profile-accent={u.profileAccent ? "custom" : undefined}
            style={profileAccentStyle(u)}
          >
            <ProfileShellTheme user={u} name={name} />
            <ProfileCosmetics user={u} nowPlaying={!!u.nowPlaying} />
            <Hero
              tabs={<Tabs items={profileTabs(u, base, locked)} />}
              banner={u.banner}
              art={
                <CosmeticAvatar name={u.username} size={180} appearance={u} nowPlaying={!!u.nowPlaying}>
                  <Art image={u.image} kind="user" />
                </CosmeticAvatar>
              }
              kicker={u.followsYou ? t("user.followsYou") : t("user.listener")}
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
                  {tx("user.blockedNotice", { name: <Username user={u} /> })}{" "}
                  <Button kind="link" type="button" onClick={() => setBlock(u.username, false).then(q.reload)}>
                    {t("user.unblock")}
                  </Button>
                </p>
              )}
              {u.suspended && (mine || me?.admin) && (
                <p className="notice">
                  {mine ? t("user.suspendedSelf") : tx("user.suspendedOther", { name: <Username user={u} /> })}
                </p>
              )}
              <Pane>
                {tab === "journal" && <Journal name={u.username} mine={mine} />}
                {tab === "journal-post" && <JournalPost name={u.username} id={Number(p.post)} mine={mine} />}
                {tab === "journal-new" &&
                  (mine ? (
                    <JournalEditor name={u.username} />
                  ) : (
                    <Empty>{tx("user.onlyOwnerWrite", { name: <Username user={u} /> })}</Empty>
                  ))}
                {tab === "journal-edit" &&
                  (mine ? (
                    <JournalEditor name={u.username} id={Number(p.post)} />
                  ) : (
                    <Empty>{tx("user.onlyOwnerEdit", { name: <Username user={u} /> })}</Empty>
                  ))}
                {tab === "overview" && <Overview u={u} mine={mine} locked={locked} />}
                {locked && LISTENING_TABS.includes(tab) && (
                  <Empty>{tx("user.listeningPrivate", { name: <Username user={u} /> })}</Empty>
                )}
                {tab === "library" && !locked && <Library name={u.username} mine={mine} />}
                {tab === "library-artist" && !locked && <LibraryArtist name={u.username} artist={dec(p.artist)} />}
                {tab === "report" && !locked && (
                  <Report
                    name={u.username}
                    type={p.type === "stats" || p.type === "blasts" ? p.type : reportType(p.type)}
                  />
                )}
                {tab === "following" && (
                  <People
                    list="following"
                    name={name}
                    empty={tx("user.notFollowingAnyone", { name: <Username user={u} /> })}
                  />
                )}
                {tab === "followers" && <People list="followers" name={name} empty={t("user.noFollowers")} />}
                {tab === "loved" && !locked && <Loved name={u.username} />}
                {tab === "obsessions" && <Obsessions name={u.username} mine={mine} />}
                {tab === "playlists" && <Playlists name={u.username} mine={mine} />}
                {tab === "events" && <UserEvents name={u.username} />}
                {tab === "neighbours" && !locked && <Neighbours name={u.username} />}
                {tab === "tags" && <UserTags name={u.username} />}
                {tab === "shoutbox" && <Shoutbox type="user" id={u.id} />}
                {tab === "cosmetics" &&
                  (mine ? (
                    <CosmeticsSettings />
                  ) : (
                    <Empty>{tx("user.onlyOwnerCosmetics", { name: <Username user={u} /> })}</Empty>
                  ))}
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
      <MoreMenu label={t("user.moreActions", { name: u.username })} link={shortUrl(u.username)}>
        {me && (
          <DropdownMenuItem label={u.blocked ? t("user.unblockUser") : t("user.blockUser")} onClick={toggleBlock} />
        )}
        {me && <DropdownMenuItem label={t("user.reportProfile")} onClick={() => setReporting(true)} />}
        {me?.admin && (
          <DropdownMenuItem
            label={u.suspended ? t("user.liftSuspension") : t("user.suspendFromPosting")}
            onClick={toggleSuspend}
          />
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
            {t("user.noEvents")}{" "}
            <Link to="/events">
              {t("user.findEvents")} <Ico.Right />
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
        <Section title={t("user.listening")}>
          <Empty>{tx("user.listeningPrivate", { name: <Username user={u} /> })}</Empty>
        </Section>
        <Section title={t("user.wall")} more={`${userUrl(u.username)}/wall`} moreLabel={t("user.wholeWall")}>
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
  if (!u.about && !u.links?.length) return null;
  return (
    <Section title={t("user.about")}>
      <div className="profile-about">
        <Markdown text={u.about} images />
        {!!u.links?.length && (
          <ul className="list-none m-0 p-0 grid [overflow-wrap:anywhere]">
            {u.links.map((link, i) => (
              <li key={i}>
                <a
                  className="inline-flex items-center gap-2"
                  href={link.url}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  <ProfileLinkIcon url={link.url} />
                  {link.label || link.url.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function Earworm({ u }: { u: Profile }) {
  const o = u.obsession;
  if (!o) return null;
  return (
    <Section title={t("user.currentEarworm")} more={`${userUrl(u.username)}/earworms`} moreLabel={t("user.all")}>
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

function tasteLabel(label: TasteLabel) {
  const labels: Record<TasteLabel, string> = {
    Super: t("user.tasteSuper"),
    "Very High": t("user.tasteVeryHigh"),
    High: t("user.tasteHigh"),
    Medium: t("user.tasteMedium"),
    Low: t("user.tasteLow"),
    "Very Low": t("user.tasteVeryLow"),
  };
  return labels[label];
}

function Compatibility({ taste }: { taste: NonNullable<Profile["taste"]> }) {
  return (
    <Section title={t("user.yourCompatibility")}>
      <div className="taste">
        <div className="taste-bar">
          <span style={{ width: `${Math.max(4, taste.score * 100)}%` }} />
        </div>
        <b>{tasteLabel(taste.label)}</b>
      </div>
      {taste.artists.length > 0 ? (
        <p className="small">
          {tx("user.bothListenTo", {
            artists: taste.artists.map((a, i) => (
              <span key={a.name}>
                {i > 0 && ", "}
                <Link to={artistUrl(a.name)}>{a.name}</Link>
              </span>
            )),
          })}
        </p>
      ) : (
        <p className="muted small">{t("user.noArtistsInCommon")}</p>
      )}
    </Section>
  );
}

function RecentTracks({ d, u, mine }: { d: UserRecent; u: Profile; mine: boolean }) {
  if ("hidden" in d) return <Empty>{tx("user.recentPrivate", { name: <Username user={u} /> })}</Empty>;
  if (d.items.length || d.nowPlaying)
    return (
      <TrackList
        items={d.items}
        nowPlaying={d.nowPlaying}
        time
        timeActions={mine ? (r) => <ScrobbleMenu row={r} /> : undefined}
      />
    );
  if (!mine) return <Empty>{t("user.noScrobbles")}</Empty>;
  return (
    <Empty>
      {tx("user.nothingScrobbled", {
        manual: <Link to="/scrobble">{t("user.scrobbleManuallyLink")}</Link>,
        settings: (
          <Link to="/settings/applications">
            {t("user.settingsLink")}
            <Arrow say=", " />
            {t("user.applicationsLink")}
          </Link>
        ),
      })}
    </Empty>
  );
}

function OpenOverview({ u, mine }: { u: Profile; mine: boolean }) {
  const base = userUrl(u.username);
  const [sp] = useSearchParams();
  const range = useRange("7day");
  const top = (kind: "artists" | "albums" | "tracks") =>
    `/user/top${qs({ name: u.username, kind, ...range, limit: kind === "tracks" ? 10 : 8 })}`;
  const library = (kind: string) =>
    `${base}/library/${kind}${qs({ period: range.period, from: sp.get("from"), to: sp.get("to") })}`;
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
        <Section title={t("user.recentTracks")} more={`${base}/library`} moreLabel={t("user.moreTracks")}>
          <Async q={recent}>{(d) => <RecentTracks d={d} u={u} mine={mine} />}</Async>
        </Section>
        <div className="toolbar">
          <h2>{t("user.topMusic")}</h2>
          <DateRange def="7day" />
        </div>
        <Section sub title={t("music.artists")} more={library("artists")}>
          <Async q={artists}>
            {(d) => (
              <Grid
                kind="artist"
                cols={4}
                items={d.items}
                sub={(a) => t("user.scrobbleCount", { count: a.playcount })}
              />
            )}
          </Async>
        </Section>
        <Section sub title={t("music.albums")} more={library("albums")}>
          <Async q={albums}>
            {(d) => (
              <Grid
                kind="album"
                cols={4}
                items={d.items}
                sub={(a) => t("user.scrobbleCount", { count: a.playcount })}
              />
            )}
          </Async>
        </Section>
        <Section sub title={t("music.tracks")} more={library("tracks")}>
          <Async q={tracks}>{(d) => <TrackList items={d.items} rank={1} count="playcount" />}</Async>
        </Section>
        <Section title={t("user.wall")} more={`${base}/wall`} moreLabel={t("user.wholeWall")}>
          <Shoutbox type="user" id={u.id} limit={5} />
        </Section>
      </div>
      <aside className="side">
        <About u={u} />
        {u.taste && <Compatibility taste={u.taste} />}
        <Earworm u={u} />
        <Section title={t("user.library")}>
          <ul className="plain">
            <li>
              <Link to={`${base}/library/artists`}>{t("user.artistCount", { count: u.artistCount })}</Link>
            </li>
            <li>
              <Link to={`${base}/library/albums`}>{t("user.albumCount", { count: u.albumCount })}</Link>
            </li>
            <li>
              <Link to={`${base}/library/tracks`}>{t("user.trackCount", { count: u.trackCount })}</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/week`}>{t("user.weeklyReport")}</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/month`}>{t("user.monthlyReport")}</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/year`}>{t("user.yearlyReport")}</Link>
            </li>
            <li>
              <Link to={`${base}/listening-report/all`}>{t("user.allTimeReport")}</Link>
            </li>
          </ul>
        </Section>
      </aside>
    </div>
  );
}
