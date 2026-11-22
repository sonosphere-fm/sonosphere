import { Ico, Spinner } from "./icons";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type FocusEvent,
  type FormEvent,
} from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { sonosphereTheme } from "./themes/sonosphere/sonosphere.js";
import { applyTheme, usePageTheme } from "./theme";
import { ThemeToggle } from "./ui/theme-toggle";
import { Button, RouteLink } from "./kit";
import "./sentry";
import { createRoot } from "react-dom/client";
import { PageMetadata } from "./page-metadata";
import * as Sentry from "@sentry/react";
import { isStaleBuild, recoverAsset } from "./asset-recovery";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavigationType,
  NavLink,
  Route,
  Routes,
  UNSAFE_LocationContext as LocationContext,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  api,
  AuthContext,
  dec,
  invalidateAll,
  liveConnect,
  prefetch,
  qs,
  refreshListening,
  useAuth,
  useLive,
  userUrl,
  type Me,
  type Ok,
} from "./lib";
import type { MeResponse } from "../shared/auth";
import { applyDmEvent } from "./dm";
import { PlayerProvider } from "./player";
import { Art, Empty, Logo } from "./ui/base";
import { Home } from "./pages/music/home";
import { NotFound } from "./pages/notfound";
import { Private } from "./pages/private";
import { ImpersonationBanner, SiteBanner, VerifyBanner } from "./banner";

const ArtistPage = lazy(() => import("./pages/music/artist").then((m) => ({ default: m.ArtistPage })));
const AlbumPage = lazy(() => import("./pages/music/album").then((m) => ({ default: m.AlbumPage })));
const TrackPage = lazy(() => import("./pages/music/track").then((m) => ({ default: m.TrackPage })));
const Charts = lazy(() => import("./pages/music/charts").then((m) => ({ default: m.Charts })));
const SearchPage = lazy(() => import("./pages/music/search").then((m) => ({ default: m.SearchPage })));
const TagPage = lazy(() => import("./pages/music/tag").then((m) => ({ default: m.TagPage })));
const UserPage = lazy(() => import("./pages/user/index").then((m) => ({ default: m.UserPage })));
const MessagesPage = lazy(() => import("./pages/messages").then((m) => ({ default: m.MessagesPage })));
const EventsPage = lazy(() => import("./pages/events").then((m) => ({ default: m.EventsPage })));
const EventPage = lazy(() => import("./pages/events").then((m) => ({ default: m.EventPage })));
const EventAdd = lazy(() => import("./pages/events").then((m) => ({ default: m.EventAdd })));
const PlaylistPage = lazy(() => import("./pages/playlist").then((m) => ({ default: m.PlaylistPage })));
const AuthPage = lazy(() => import("./pages/auth").then((m) => ({ default: m.AuthPage })));
const OAuthJoinPage = lazy(() => import("./pages/auth").then((m) => ({ default: m.OAuthJoinPage })));
const ForgotPage = lazy(() => import("./pages/auth").then((m) => ({ default: m.ForgotPage })));
const ResetPage = lazy(() => import("./pages/auth").then((m) => ({ default: m.ResetPage })));
const VerifyPage = lazy(() => import("./pages/auth").then((m) => ({ default: m.VerifyPage })));
const Settings = lazy(() => import("./pages/settings").then((m) => ({ default: m.Settings })));
const Inbox = lazy(() => import("./pages/inbox").then((m) => ({ default: m.Inbox })));
const Recommended = lazy(() => import("./pages/recommended").then((m) => ({ default: m.Recommended })));
const ScrobblePage = lazy(() => import("./pages/scrobble").then((m) => ({ default: m.ScrobblePage })));
const Connect = lazy(() => import("./pages/connect").then((m) => ({ default: m.Connect })));
const Help = lazy(() => import("./pages/help").then((m) => ({ default: m.Help })));
const Developers = lazy(() => import("./pages/developers").then((m) => ({ default: m.Developers })));
const Terms = lazy(() => import("./pages/legal").then((m) => ({ default: m.Terms })));
const PrivacyPolicy = lazy(() => import("./pages/legal").then((m) => ({ default: m.Privacy })));
const Guidelines = lazy(() => import("./pages/legal").then((m) => ({ default: m.Guidelines })));

const AdminPage = lazy(() => import("./admin/index"));

function Header() {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const close = () => {
    setTerm("");
    setOpen(false);
  };
  useEffect(close, [loc.pathname, loc.search]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (term.trim()) nav(`/search?q=${encodeURIComponent(term.trim())}`);
  };
  const logout = () =>
    api<Ok>("/auth/logout", { body: {} }).then(() => {
      setMe(null);
      nav("/");
    });
  const closeOnBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (!term && !e.currentTarget.contains(e.relatedTarget as Node)) close();
  };

  if (open)
    return (
      <header className="site-header">
        <form
          className={`wrap ${searchForm}`}
          onSubmit={search}
          role="search"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          onBlur={closeOnBlur}
        >
          <input
            autoFocus
            className={searchInput}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search for music…"
            aria-label="Search for music"
          />
          <button type="button" className={`${searchButton} ${searchClose}`} aria-label="Close search" onClick={close}>
            <Ico.X />
          </button>
          <button type="submit" className={`${searchButton} ${searchGo}`} aria-label="Search">
            <Ico.Search />
          </button>
        </form>
      </header>
    );

  const dmCount = me ? me.dm.unread + me.dm.requests : 0;
  const badge = me ? me.unread + dmCount : 0;
  const menuButton = me && {
    label: `${me.username} menu`,
    variant: "ghost" as const,
    className: menuToggle,
    children: (
      <>
        <span className="avatar" style={{ width: 30, height: 30 }}>
          <Art image={me.image} kind="user" />
        </span>
        {badge > 0 && <b className="dot">{badge}</b>}
      </>
    ),
  };

  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" className="logo" aria-label="Sonosphere home">
          <Logo />
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Button kind={navSearch} type="button" aria-label="Search" onClick={() => setOpen(true)}>
            <Ico.Search />
          </Button>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/charts">Charts</NavLink>
          <NavLink to="/events">Events</NavLink>
          {me && menuButton ? (
            <DropdownMenu
              placement="below"
              alignment="end"
              hasChevron={false}
              menuWidth={200}
              menuMaxHeight={480}
              button={menuButton}
            >
              <DropdownMenuItem icon={<Ico.User />} label="Profile" href={userUrl(me.username)} />
              <DropdownMenuItem icon={<Ico.Library />} label="Library" href={`${userUrl(me.username)}/library`} />
              <DropdownMenuItem
                icon={<Ico.Reports />}
                label="Listening reports"
                href={`${userUrl(me.username)}/listening-report/week`}
              />
              <DropdownMenuItem icon={<Ico.Recommended />} label="Recommended" href="/recommended" />
              <DropdownMenuItem
                icon={<Ico.Chat />}
                label={dmCount > 0 ? `Messages (${dmCount})` : "Messages"}
                href={!me.dm.unread && me.dm.requests ? "/messages/requests" : "/messages"}
              />
              <DropdownMenuItem
                icon={<Ico.Inbox />}
                label={me.unread > 0 ? `Inbox (${me.unread})` : "Inbox"}
                href="/inbox"
              />
              <DropdownMenuItem icon={<Ico.Scrobble />} label="Scrobble" href="/scrobble" />
              <DropdownMenuItem icon={<Ico.Settings />} label="Settings" href="/settings" />
              {me.admin && (
                <DropdownMenuItem
                  icon={<Ico.Shield />}
                  label={me.openReports > 0 ? `Admin (${me.openReports})` : "Admin"}
                  href={me.openReports > 0 ? "/admin/reports" : "/admin"}
                />
              )}
              <DropdownMenuItem icon={<Ico.Discord />} label="Join our Discord" href="/discord" />
              <DropdownMenuItem icon={<Ico.LogOut />} label="Log out" onClick={logout} />
            </DropdownMenu>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/join" className="join">
                Join
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

const searchForm = "flex items-center gap-0 h-[54px]";
const searchInput =
  "flex-1 min-w-0 h-[38px] bg-site-card text-site-ink border-none outline-none [font-family:inherit] " +
  "[line-height:inherit] text-[16px] font-normal px-3.5 max-[700px]:px-3 [box-shadow:inset_0_1px_3px_rgba(23,21,15,.22)] " +
  "placeholder:text-site-muted";
const searchButton = "flex-none grid place-items-center h-[38px] border-none cursor-pointer [&_svg]:size-[18px]";
const searchClose =
  "order-3 w-10 ml-1.5 bg-transparent text-white opacity-80 hover:opacity-100 focus-visible:opacity-100";
const searchGo = "order-2 w-11 bg-site-sun text-site-on-sun hover:bg-site-sun-dark focus-visible:bg-site-sun-dark";

const navSearch =
  "inline-flex items-center justify-center size-10 p-0 text-white text-[19px] rounded-[50%] hover:bg-site-bar-hover";
const menuToggle =
  "menu-toggle flex items-center gap-2 size-[38px] min-w-0 p-0 ml-1.5 rounded-[50%] border-none bg-transparent " +
  "text-white hover:bg-site-bar-hover aria-expanded:bg-site-bar-hover " +
  "focus-visible:outline-none focus-visible:bg-[rgba(255,255,255,.12)]";

type LinkColumn = [string, [string, string][]];

function Footer() {
  const { me } = useAuth();
  const u = me ? userUrl(me.username) : "";
  const yourMusic: LinkColumn = me
    ? [
        "Your music",
        [
          ["Profile", u],
          ["Library", `${u}/library`],
          ["Listening report", `${u}/listening-report`],
          ["Loved tracks", `${u}/loved`],
          ["Recommended", "/recommended"],
        ],
      ]
    : [
        "Get started",
        [
          ["Join free", "/join"],
          ["Log in", "/login"],
          ["Search", "/search"],
        ],
      ];
  const account: LinkColumn[] = me
    ? [
        [
          "Account",
          [
            ["Messages", "/messages"],
            ["Inbox", "/inbox"],
            ["Settings", "/settings"],
            ["Privacy", "/settings/privacy"],
            ["Your data", "/settings/data"],
          ],
        ],
      ]
    : [];
  const cols: LinkColumn[] = [
    [
      "Music",
      [
        ["Charts", "/charts"],
        ["Top tracks", "/charts?kind=tracks"],
        ["Top artists", "/charts?kind=artists"],
        ["Top albums", "/charts?kind=albums"],
        ["Top tags", "/charts?kind=tags"],
        ["Events", "/events"],
      ],
    ],
    yourMusic,
    [
      "Scrobbling",
      [
        ["Scrobbling help", "/help"],
        ["Scrobble manually", "/scrobble"],
        ["Connect a player", "/settings/applications"],
        ["Import & export", "/settings/data"],
      ],
    ],
    [
      "Developers",
      [
        ["API documentation", "/developers"],
        ["API keys", "/settings/applications"],
      ],
    ],
    [
      "Community",
      [
        ["Join our Discord", "/discord"],
        ["Guidelines", "/guidelines"],
      ],
    ],
    ...account,
  ];
  return (
    <footer className="bg-site-bar text-white pb-8 text-[14px] [border-top:0] [&_:focus-visible]:outline-site-sun">
      <div className={`wrap ${masthead}`}>
        <Link to="/" className={`logo ${mastheadLogo}`} aria-label="Sonosphere home">
          <Logo />
        </Link>
        <Link className={cta} to={me ? `${u}/library` : "/join"}>
          {me ? "Your library" : "Join Sonosphere"} <Ico.Right />
        </Link>
      </div>
      <div className={`wrap ${footerCols}`}>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2 className="font-site text-site-sun text-[11px] font-semibold tracking-[.08em] uppercase m-0 mb-2">
              {title}
            </h2>
            <ul className="list-none m-0 p-0 grid gap-0.5 max-[600px]:gap-0">
              {links.map(([label, to]) => (
                <li key={label}>
                  <RouteLink className={colLink} href={to}>
                    {label}
                  </RouteLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-t-[#fff5] text-[#8a8a8a] text-[12px]">
        <div className={`wrap ${footerBase}`}>
          <ThemeToggle />
          <span className="text-white">© {new Date().getFullYear()} Sonosphere</span>
          <span className={legalLinks}>
            <Link className={legalLink} to="/terms">
              Terms
            </Link>
            <Link className={legalLink} to="/privacy">
              Privacy
            </Link>
            <Link className={legalLink} to="/guidelines">
              Guidelines
            </Link>
            <a className={legalLink} href="mailto:support@sonosphere.fm">
              Contact
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

const masthead =
  "flex flex-wrap [align-items:end] justify-between gap-x-8 gap-y-5 max-[720px]:gap-[15px] " +
  "pt-[clamp(32px,5vw,67px)] pb-[26px] border-b border-b-[#fff5]";
const mastheadLogo = "text-site-sun hover:text-white hover:underline [&_.wordmark]:text-[clamp(2.25rem,6vw,5.25rem)]";
const cta =
  "min-h-[42px] inline-flex items-center gap-3 px-3 py-2 text-site-on-sun bg-site-sun font-[750] hover:bg-white";
const footerCols =
  "grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-8 pt-9 pb-8 " +
  "max-[900px]:grid-cols-[repeat(auto-fit,minmax(128px,1fr))] max-[900px]:gap-x-5 max-[900px]:gap-y-6 " +
  "max-[600px]:gap-5 max-[600px]:pt-7 max-[600px]:pb-5";
const colLink = "text-white hover:underline max-[600px]:inline-block max-[600px]:py-1.5";
const footerBase =
  "grid grid-cols-[1fr_auto_1fr] flex-wrap items-center gap-x-5 gap-y-2.5 py-5 " +
  "max-[720px]:grid-cols-1 max-[720px]:justify-items-center";
const legalLinks =
  "flex flex-wrap gap-x-[17px] gap-y-1.5 justify-self-end max-[720px]:justify-self-center max-[720px]:justify-center";
const legalLink = "text-white hover:underline";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function safeDec(x: string) {
  try {
    return dec(x);
  } catch {
    return x;
  }
}

/** The first API request a page makes, so it can be prefetched on hover. */
function apiFor(pathname: string): string | null {
  const p = pathname.split("/").filter(Boolean);
  if (!p.length) return "/home";
  if (p[0] === "music" && p[1]) {
    if (p[2] === "_" && p[3]) return `/track${qs({ artist: safeDec(p[1]), track: safeDec(p[3]) })}`;
    if (p[2] && !p[2].startsWith("+")) return `/album${qs({ artist: safeDec(p[1]), album: safeDec(p[2]) })}`;
    return `/artist${qs({ name: safeDec(p[1]) })}`;
  }
  if (p[0] === "tag" && p[1]) return `/tag${qs({ name: safeDec(p[1]) })}`;
  if (p[0] === "user" && p[1]) return `/user${qs({ name: safeDec(p[1]) })}`;
  if ((p[0] === "event" || p[0] === "playlist") && p[1]) return `/${p[0]}/${p[1]}`;
  return null;
}

// Keys must match the ones the tabs in src/pages/user/ build; a mismatch only costs a wasted request.
function userTabApi(p: string[], sp: URLSearchParams, name: string): string[] {
  const page = Number(sp.get("page")) || 1;
  const period = sp.get("period");
  switch (p[2]) {
    case undefined: {
      const tops = ["artists", "albums", "tracks"].map((kind) => {
        const limit = kind === "tracks" ? 10 : 8;
        return `/user/top${qs({ name, kind, period: period || "7day", limit })}`;
      });
      return [`/user/recent${qs({ name, limit: 10 })}`, ...tops];
    }
    case "library": {
      if (p[3] === "music" || sp.get("from") || sp.get("to")) return [];
      const params = { name, page, limit: 50, period: period || "overall" };
      if (!p[3] || p[3] === "scrobbles") return [`/user/recent${qs(params)}`];
      return [`/user/top${qs({ ...params, kind: p[3] })}`];
    }
    case "listening-report": {
      const type = p[3] === "year" ? "year" : "week";
      const offset = Number(sp.get("offset") || (type === "week" ? "1" : "0"));
      return [`/user/report${qs({ name, type, offset, tz: -new Date().getTimezoneOffset() })}`];
    }
    case "loved":
      return [`/user/loved${qs({ name, page })}`];
    case "journal":
      return p[3] ? [] : [`/user/journal${qs({ name, page })}`];
    case "following":
    case "followers":
      return [`/user/${p[2]}${qs({ name })}`];
    case "earworms":
      return [`/user/obsessions${qs({ name })}`];
    case "soundalikes":
      return [`/user/neighbours${qs({ name })}`];
    case "tags":
      return [`/user/tags${qs({ name, tag: sp.get("tag") })}`];
    case "playlists":
    case "events":
      return [`/user/${p[2]}${qs({ name })}`];
    default:
      return [];
  }
}

function apisFor(url: string): string[] {
  const at = new URL(url, location.origin);
  const first = apiFor(at.pathname);
  if (!first) return [];
  const p = at.pathname.split("/").filter(Boolean);
  if (p[0] !== "user" || !p[1]) return [first];
  return [first, ...userTabApi(p, at.searchParams, dec(p[1]))];
}

function Staff() {
  const { me } = useAuth();
  if (!me?.admin)
    return (
      <div className="wrap page narrow">
        <h1 className="page-title">Admin</h1>
        <Empty>This area is for moderators and admins.</Empty>
      </div>
    );
  return <AdminPage />;
}

/** Rendered once for real, and once more (unseen) for a link the pointer is resting on. */
function Pages() {
  const U = (tab: ComponentProps<typeof UserPage>["tab"]) => <UserPage tab={tab} />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/charts" element={<Charts />} />
      <Route path="/music" element={<Charts />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/music/:artist" element={<ArtistPage tab="overview" />} />
      <Route path="/music/:artist/+tracks" element={<ArtistPage tab="tracks" />} />
      <Route path="/music/:artist/+albums" element={<ArtistPage tab="albums" />} />
      <Route path="/music/:artist/+similar" element={<ArtistPage tab="similar" />} />
      <Route path="/music/:artist/+wiki" element={<ArtistPage tab="wiki" />} />
      <Route path="/music/:artist/+listeners" element={<ArtistPage tab="listeners" />} />
      <Route path="/music/:artist/+shoutbox" element={<ArtistPage tab="shoutbox" />} />
      <Route path="/music/:artist/+wall" element={<ArtistPage tab="shoutbox" />} />
      <Route path="/music/:artist/:album" element={<AlbumPage tab="overview" />} />
      <Route path="/music/:artist/:album/+wiki" element={<AlbumPage tab="wiki" />} />
      <Route path="/music/:artist/_/:track" element={<TrackPage tab="overview" />} />
      <Route path="/music/:artist/_/:track/+wiki" element={<TrackPage tab="wiki" />} />
      <Route path="/tag/:tag" element={<TagPage tab="overview" />} />
      <Route path="/tag/:tag/+wiki" element={<TagPage tab="wiki" />} />
      <Route path="/user/:name" element={U("overview")} />
      <Route path="/user/:name/library" element={U("library")} />
      <Route path="/user/:name/library/music/:artist" element={U("library-artist")} />
      <Route path="/user/:name/library/:kind" element={U("library")} />
      <Route path="/user/:name/listening-report" element={U("report")} />
      <Route path="/user/:name/listening-report/:type" element={U("report")} />
      <Route path="/user/:name/journal" element={U("journal")} />
      <Route path="/user/:name/journal/new" element={U("journal-new")} />
      <Route path="/user/:name/journal/:post" element={U("journal-post")} />
      <Route path="/user/:name/journal/:post/edit" element={U("journal-edit")} />
      {(
        [
          "following",
          "followers",
          "loved",
          "obsessions",
          "playlists",
          "events",
          "neighbours",
          "tags",
          "shoutbox",
        ] as const
      ).map((t) => (
        <Route key={t} path={`/user/:name/${t}`} element={U(t)} />
      ))}
      <Route path="/user/:name/wall" element={U("shoutbox")} />
      <Route path="/user/:name/earworms" element={U("obsessions")} />
      <Route path="/user/:name/soundalikes" element={U("neighbours")} />
      <Route path="/events" element={<EventsPage />} />
      <Route
        path="/events/add"
        element={
          <Private>
            <EventAdd />
          </Private>
        }
      />
      <Route path="/event/:id" element={<EventPage />} />
      <Route path="/playlist/:id" element={<PlaylistPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/join" element={<AuthPage mode="join" />} />
      <Route path="/join/oauth" element={<OAuthJoinPage />} />
      <Route path="/forgot" element={<ForgotPage />} />
      <Route path="/reset" element={<ResetPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route
        path="/settings"
        element={
          <Private>
            <Settings />
          </Private>
        }
      />
      <Route
        path="/settings/:tab"
        element={
          <Private>
            <Settings />
          </Private>
        }
      />
      <Route path="/moderation" element={<Navigate to="/admin/reports" replace />} />
      <Route
        path="/admin/*"
        element={
          <Private>
            <Staff />
          </Private>
        }
      />
      <Route
        path="/inbox"
        element={
          <Private>
            <Inbox />
          </Private>
        }
      />
      <Route
        path="/messages"
        element={
          <Private>
            <MessagesPage view="inbox" />
          </Private>
        }
      />
      <Route
        path="/messages/requests"
        element={
          <Private>
            <MessagesPage view="requests" />
          </Private>
        }
      />
      <Route
        path="/messages/to/:name"
        element={
          <Private>
            <MessagesPage view="new" />
          </Private>
        }
      />
      <Route
        path="/messages/new-group"
        element={
          <Private>
            <MessagesPage view="new-group" />
          </Private>
        }
      />
      <Route
        path="/messages/g/:id"
        element={
          <Private>
            <MessagesPage view="group" />
          </Private>
        }
      />
      <Route
        path="/messages/:id"
        element={
          <Private>
            <MessagesPage view="thread" />
          </Private>
        }
      />
      <Route
        path="/recommended"
        element={
          <Private>
            <Recommended />
          </Private>
        }
      />
      <Route
        path="/scrobble"
        element={
          <Private>
            <ScrobblePage />
          </Private>
        }
      />
      <Route
        path="/connect"
        element={
          <Private>
            <Connect />
          </Private>
        }
      />
      <Route path="/help" element={<Help />} />
      <Route path="/developers" element={<Developers />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/guidelines" element={<Guidelines />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Pointing at a link renders its page out of sight, so its code and requests are under way before the click.
const inApp = (e: Event) => {
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.origin !== location.origin || a.target || a.hasAttribute("download") || a.pathname.startsWith("/api/"))
    return null;
  return a;
};

let ahead: (url: string) => void = () => {};

function lookAheadAt(e: Event) {
  const a = inApp(e);
  if (!a) return;
  const url = a.pathname + a.search;
  for (const path of apisFor(url)) prefetch(path);
  ahead(url);
}
for (const type of ["mouseover", "touchstart", "focusin"]) {
  document.addEventListener(type, lookAheadAt, { passive: true });
}

const never = new Promise<void>(() => {});
// Suspends forever so the look-ahead render is never committed: no DOM, no effects.
function Never(): null {
  throw never;
}

function LookAhead() {
  const [url, setUrl] = useState("");
  const here = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    ahead = setUrl;
    return () => {
      ahead = () => {};
    };
  }, []);
  useEffect(() => {
    setUrl("");
  }, [here.pathname, here.search]);

  // Navigate on press rather than release; the click that follows must not navigate a second time.
  useEffect(() => {
    let went: HTMLAnchorElement | null = null;
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const a = inApp(e);
      if (!a || (e.target as Element).closest("button, input, select, textarea, [role=menu]")) return;
      const to = a.pathname + a.search + a.hash;
      if (to !== location.pathname + location.search + location.hash) {
        nav(to);
        went = a;
      }
    };
    const click = (e: MouseEvent) => {
      if (went && inApp(e) === went) e.preventDefault();
      went = null;
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("click", click, true);
    };
  }, [nav]);

  if (!url || url === here.pathname + here.search) return null;
  const at = new URL(url, location.origin);
  const aheadLocation = { pathname: at.pathname, search: at.search, hash: "", state: null, key: "ahead" };
  return (
    <Suspense key={url} fallback={null}>
      <LocationContext.Provider value={{ location: aheadLocation, navigationType: NavigationType.Pop }}>
        <Pages />
        <Never />
      </LocationContext.Provider>
    </Suspense>
  );
}

for (const path of apisFor(location.pathname + location.search)) prefetch(path);

// Keyed on the path so a page that is still loading shows a spinner instead of the previous page.
function Routed() {
  const { pathname } = useLocation();
  return (
    <Suspense key={pathname} fallback={<Spinner page />}>
      <Pages />
    </Suspense>
  );
}

// The server embeds the /api/me response in the page (server/app.ts); in development it is fetched.
const boot = (window as { __ME?: MeResponse }).__ME;

function App() {
  const [me, setMeRaw] = useState<Me | null>(() => boot?.user ?? null);
  const [ready, setReady] = useState(!!boot);
  const pageTheme = usePageTheme();
  const themePref = me?.theme ?? pageTheme;
  // Wait for the session check, or a signed-in reload would forget the remembered theme.
  useEffect(() => {
    if (ready) applyTheme(themePref);
  }, [themePref, ready]);

  // API responses depend on the viewer, so a change of viewer refetches everything.
  const setMe = useCallback((m: Me | null) => {
    setMeRaw((prev) => {
      if ((prev?.username ?? null) !== (m?.username ?? null)) invalidateAll();
      return m;
    });
  }, []);
  const refresh = useCallback(() => {
    api<MeResponse>("/me")
      .then((r) => setMe(r.user))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [setMe]);
  useEffect(() => {
    if (!boot) refresh();
  }, [refresh]);

  useEffect(() => {
    liveConnect(!!me?.id, me?.id ?? 0);
  }, [me?.id]);
  useEffect(() => {
    if (!me?.impersonating) return;
    const check = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [me?.impersonating, refresh]);
  useEffect(() => {
    const onScrobble = () => {
      if (me) refreshListening(me.username);
    };
    window.addEventListener("spin:scrobble", onScrobble);
    return () => window.removeEventListener("spin:scrobble", onScrobble);
  }, [me?.username]);
  useLive((e) => {
    if (e.t === "open" && e.again) {
      invalidateAll();
      refresh();
      return;
    }
    applyDmEvent(e);
    if ("counts" in e) {
      const counts = e.counts;
      setMeRaw((m) => m && { ...m, dm: counts });
    }
  });

  if (!ready)
    return (
      <>
        <header className="site-header">
          <div className="wrap">
            <span className="logo">
              <Logo />
            </span>
          </div>
        </header>
        <Spinner page />
      </>
    );
  return (
    <Theme theme={sonosphereTheme} mode={themePref}>
      <LinkProvider component={RouteLink}>
        <AuthContext.Provider value={{ me, setMe, refresh }}>
          <BrowserRouter>
            <PageMetadata />
            <PlayerProvider>
              <ScrollTop />
              <LookAhead />
              <Header />
              <SiteBanner />
              <ImpersonationBanner />
              <VerifyBanner />
              <main>
                <Routed />
              </main>
              <Footer />
            </PlayerProvider>
          </BrowserRouter>
        </AuthContext.Provider>
      </LinkProvider>
    </Theme>
  );
}

function reloadOnStaleBuild(error: unknown) {
  if (isStaleBuild(error)) recoverAsset();
}

// Bun can re-evaluate this entry during HMR; keep one React root for the page.
const g = globalThis as typeof globalThis & { __spinRoot?: ReturnType<typeof createRoot> };
const root = (g.__spinRoot ??= createRoot(document.getElementById("root")!));
root.render(
  <Sentry.ErrorBoundary
    onError={reloadOnStaleBuild}
    fallback={({ resetError }) => (
      <div style={{ padding: 24 }}>
        <p>Something went wrong.</p>
        <button onClick={() => resetError()}>Try again</button>
      </div>
    )}
  >
    <App />
  </Sentry.ErrorBoundary>
);
