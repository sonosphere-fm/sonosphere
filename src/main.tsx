import { Ico, Spinner } from "./icons";
import { lazy, Suspense, useCallback, useEffect, useState, type ComponentProps, type FormEvent } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { needleTheme } from "./themes/needle/needle.js";
import { Button, RouteLink } from "./kit";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, NavigationType, NavLink, Route, Routes, UNSAFE_LocationContext as LocationContext, useLocation, useNavigate } from "react-router-dom";
import { api, AuthContext, dec, invalidateAll, liveConnect, prefetch, qs, useAuth, useLive, userUrl, type Me, type Ok } from "./lib";
import type { MeResponse } from "../shared/auth";
import { applyDmEvent } from "./dm";
import { PlayerProvider } from "./player";
import { Art, Empty, Logo } from "./ui/base";
import { Home } from "./pages/music/home";
import { NotFound } from "./pages/notfound";
import { Private } from "./pages/private";
import { SiteBanner, VerifyBanner } from "./banner";

// Every page but the home page is its own download, fetched the first time it is needed. Pointing at a link
// renders its page out of sight (see LookAhead below), which also starts that download before the click.
const ArtistPage = lazy(() => import("./pages/music/artist").then(m => ({ default: m.ArtistPage })));
const AlbumPage = lazy(() => import("./pages/music/album").then(m => ({ default: m.AlbumPage })));
const TrackPage = lazy(() => import("./pages/music/track").then(m => ({ default: m.TrackPage })));
const Charts = lazy(() => import("./pages/music/charts").then(m => ({ default: m.Charts })));
const SearchPage = lazy(() => import("./pages/music/search").then(m => ({ default: m.SearchPage })));
const TagPage = lazy(() => import("./pages/music/tag").then(m => ({ default: m.TagPage })));
const UserPage = lazy(() => import("./pages/user/index").then(m => ({ default: m.UserPage })));
const MessagesPage = lazy(() => import("./pages/messages").then(m => ({ default: m.MessagesPage })));
const EventsPage = lazy(() => import("./pages/events").then(m => ({ default: m.EventsPage })));
const EventPage = lazy(() => import("./pages/events").then(m => ({ default: m.EventPage })));
const EventAdd = lazy(() => import("./pages/events").then(m => ({ default: m.EventAdd })));
const PlaylistPage = lazy(() => import("./pages/playlist").then(m => ({ default: m.PlaylistPage })));
const AuthPage = lazy(() => import("./pages/auth").then(m => ({ default: m.AuthPage })));
const ForgotPage = lazy(() => import("./pages/auth").then(m => ({ default: m.ForgotPage })));
const ResetPage = lazy(() => import("./pages/auth").then(m => ({ default: m.ResetPage })));
const VerifyPage = lazy(() => import("./pages/auth").then(m => ({ default: m.VerifyPage })));
const Settings = lazy(() => import("./pages/settings").then(m => ({ default: m.Settings })));
const Inbox = lazy(() => import("./pages/inbox").then(m => ({ default: m.Inbox })));
const Recommended = lazy(() => import("./pages/recommended").then(m => ({ default: m.Recommended })));
const ScrobblePage = lazy(() => import("./pages/scrobble").then(m => ({ default: m.ScrobblePage })));
const Connect = lazy(() => import("./pages/connect").then(m => ({ default: m.Connect })));
const Developers = lazy(() => import("./pages/developers").then(m => ({ default: m.Developers })));
const Terms = lazy(() => import("./pages/legal").then(m => ({ default: m.Terms })));
const PrivacyPolicy = lazy(() => import("./pages/legal").then(m => ({ default: m.Privacy })));
const Guidelines = lazy(() => import("./pages/legal").then(m => ({ default: m.Guidelines })));

// The staff portal is a separate download, fetched only when a member of staff opens it.
const AdminPage = lazy(() => import("./admin/index"));

function Header() {
  const { me, setMe } = useAuth(), nav = useNavigate(), loc = useLocation();
  const [term, setTerm] = useState(""), [open, setOpen] = useState(false);
  const close = () => { setTerm(""); setOpen(false); };
  useEffect(close, [loc.pathname, loc.search]);
  const search = (e: FormEvent) => { e.preventDefault(); if (term.trim()) nav(`/search?q=${encodeURIComponent(term.trim())}`); };
  const logout = () => api<Ok>("/auth/logout", { body: {} }).then(() => { setMe(null); nav("/"); });
  if (open) return (
    <header className="site-header searching">
      <form className="header-search wrap" onSubmit={search} role="search" onKeyDown={e => { if (e.key === "Escape") close(); }}
        onBlur={e => { /* `as`: typed as EventTarget, but focus only moves between DOM nodes */ if (!term && !e.currentTarget.contains(e.relatedTarget as Node)) close(); }}>
        <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Search for music…" aria-label="Search for music" />
        <button type="button" className="header-search-x" aria-label="Close search" onClick={close}><Ico.X /></button>
        <button type="submit" className="header-search-go" aria-label="Search"><Ico.Search /></button>
      </form>
    </header>
  );
  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" className="logo" aria-label="Sonosphere home"><Logo /></Link>
        <nav className="site-nav" aria-label="Main">
          <Button kind="nav-search" type="button" aria-label="Search" onClick={() => setOpen(true)}><Ico.Search /></Button>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/charts">Charts</NavLink>
          <NavLink to="/events">Events</NavLink>
          {me ? (
            <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={200} menuMaxHeight={480}
              button={{ label: `${me.username} menu`, variant: "ghost", className: "menu-toggle", children: <><span className="avatar" style={{ width: 30, height: 30 }}><Art image={me.image} kind="user" /></span>{me.unread + me.dm.unread + me.dm.requests > 0 && <b className="dot">{me.unread + me.dm.unread + me.dm.requests}</b>}</> }}>
              <DropdownMenuItem icon={<Ico.User />} label="Profile" href={userUrl(me.username)} />
              <DropdownMenuItem icon={<Ico.Library />} label="Library" href={`${userUrl(me.username)}/library`} />
              <DropdownMenuItem icon={<Ico.Reports />} label="Listening reports" href={`${userUrl(me.username)}/listening-report/week`} />
              <DropdownMenuItem icon={<Ico.Recommended />} label="Recommended" href="/recommended" />
              <DropdownMenuItem icon={<Ico.Chat />} label={me.dm.unread + me.dm.requests > 0 ? `Messages (${me.dm.unread + me.dm.requests})` : "Messages"} href={!me.dm.unread && me.dm.requests ? "/messages/requests" : "/messages"} />
              <DropdownMenuItem icon={<Ico.Inbox />} label={me.unread > 0 ? `Inbox (${me.unread})` : "Inbox"} href="/inbox" />
              <DropdownMenuItem icon={<Ico.Scrobble />} label="Scrobble" href="/scrobble" />
              <DropdownMenuItem icon={<Ico.Settings />} label="Settings" href="/settings" />
              {me.admin && <DropdownMenuItem icon={<Ico.Shield />} label={me.openReports > 0 ? `Admin (${me.openReports})` : "Admin"} href={me.openReports > 0 ? "/admin/reports" : "/admin"} />}
              <DropdownMenuItem icon={<Ico.LogOut />} label="Log out" onClick={logout} />
            </DropdownMenu>
          ) : <><NavLink to="/login">Log in</NavLink><Link to="/join" className="join">Join</Link></>}
        </nav>
      </div>
    </header>
  );
}
function Footer() {
  const { me } = useAuth();
  const u = me ? userUrl(me.username) : "";
  const account: [string, [string, string][]][] = me ? [["Account", [["Messages", "/messages"], ["Inbox", "/inbox"], ["Settings", "/settings"], ["Privacy", "/settings/privacy"], ["Your data", "/settings/data"]]]] : [];
  const cols: [string, [string, string][]][] = [
    ["Music", [["Charts", "/charts"], ["Top tracks", "/charts?kind=tracks"], ["Top artists", "/charts?kind=artists"], ["Top albums", "/charts?kind=albums"], ["Top tags", "/charts?kind=tags"], ["Events", "/events"]]],
    me
      ? ["Your music", [["Profile", u], ["Library", `${u}/library`], ["Listening report", `${u}/listening-report`], ["Loved tracks", `${u}/loved`], ["Recommended", "/recommended"]]]
      : ["Get started", [["Join free", "/join"], ["Log in", "/login"], ["Search", "/search"]]],
    ["Scrobbling", [["Scrobble manually", "/scrobble"], ["Connect a player", "/settings/applications"], ["Import & export", "/settings/data"]]],
    ["Developers", [["API documentation", "/developers"], ["API keys", "/settings/applications"]]],
    ...account,
  ];
  return (
    <footer className="site-footer">
      <div className="wrap footer-cols">
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <h2>{title}</h2>
            <ul>{links.map(([label, to]) => <li key={label}><Link to={to}>{label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="footer-base">
        <div className="wrap">
          <Link to="/" className="logo" aria-label="Sonosphere home"><Logo /></Link>
          <span className="footer-copy">© {new Date().getFullYear()} Sonosphere</span>
          <span className="footer-legal"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/guidelines">Guidelines</Link><a href="mailto:support@sonosp.here">Contact</a></span>
        </div>
      </div>
    </footer>
  );
}
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** The API request a page will make first, so it can be fetched while the pointer is still on the link. */
function apiFor(pathname: string): string | null {
  const p = pathname.split("/").filter(Boolean), d = (x: string) => { try { return dec(x); } catch { return x; } };
  if (!p.length) return "/home";
  if (p[0] === "music" && p[1]) {
    if (p[2] === "_" && p[3]) return `/track${qs({ artist: d(p[1]), track: d(p[3]) })}`;
    if (p[2] && !p[2].startsWith("+")) return `/album${qs({ artist: d(p[1]), album: d(p[2]) })}`;
    return `/artist${qs({ name: d(p[1]) })}`;
  }
  if (p[0] === "tag" && p[1]) return `/tag${qs({ name: d(p[1]) })}`;
  if (p[0] === "user" && p[1]) return `/user${qs({ name: d(p[1]) })}`;
  if ((p[0] === "event" || p[0] === "playlist") && p[1]) return `/${p[0]}/${p[1]}`;
  return null;
}
/** What a profile tab asks for once the profile itself has arrived, so both requests can go out together.
 *  Keys must match the ones the tab builds (src/pages/user/); a mismatch only costs a wasted request. */
function userTabApi(p: string[], sp: URLSearchParams, name: string): string[] {
  const page = Number(sp.get("page")) || 1, period = sp.get("period");
  switch (p[2]) {
    case undefined: return [`/user/recent${qs({ name, limit: 10 })}`, ...["artists", "albums", "tracks"].map(kind => `/user/top${qs({ name, kind, period: period || "7day", limit: kind === "tracks" ? 10 : 8 })}`)];
    case "library": {
      if (p[3] === "music" || sp.get("from") || sp.get("to")) return [];
      const params = { name, page, limit: 50, period: period || "overall" };
      return [!p[3] || p[3] === "scrobbles" ? `/user/recent${qs(params)}` : `/user/top${qs({ ...params, kind: p[3] })}`];
    }
    case "listening-report": { const type = p[3] === "year" ? "year" : "week"; return [`/user/report${qs({ name, type, offset: Number(sp.get("offset") || (type === "week" ? "1" : "0")), tz: -new Date().getTimezoneOffset() })}`]; }
    case "loved": return [`/user/loved${qs({ name, page })}`];
    case "journal": return p[3] ? [] : [`/user/journal${qs({ name, page })}`];
    case "following": case "followers": return [`/user/${p[2]}${qs({ name })}`];
    case "earworms": return [`/user/obsessions${qs({ name })}`];
    case "soundalikes": return [`/user/neighbours${qs({ name })}`];
    case "tags": return [`/user/tags${qs({ name, tag: sp.get("tag") })}`];
    case "playlists": case "events": return [`/user/${p[2]}${qs({ name })}`];
    default: return [];
  }
}
/** Every request a page will make that can be known from its address alone. */
function apisFor(url: string): string[] {
  const at = new URL(url, location.origin), first = apiFor(at.pathname);
  if (!first) return [];
  const p = at.pathname.split("/").filter(Boolean);
  if (p[0] !== "user" || !p[1]) return [first];
  return [first, ...userTabApi(p, at.searchParams, dec(p[1]))];
}
/** The staff portal, for staff. Everyone else gets a short notice and the portal's code is never requested. */
function Staff() {
  const { me } = useAuth();
  if (!me?.admin) return <div className="wrap page narrow"><h1 className="page-title">Admin</h1><Empty>This area is for moderators and admins.</Empty></div>;
  return <AdminPage />;
}
/** Every page of the site. Rendered once for real, and once more (unseen) for a link the pointer is resting on. */
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
      {(["following", "followers", "loved", "obsessions", "playlists", "events", "neighbours", "tags", "shoutbox"] as const).map(t => <Route key={t} path={`/user/:name/${t}`} element={U(t)} />)}
      <Route path="/user/:name/wall" element={U("shoutbox")} />
      <Route path="/user/:name/earworms" element={U("obsessions")} />
      <Route path="/user/:name/soundalikes" element={U("neighbours")} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/add" element={<Private><EventAdd /></Private>} />
      <Route path="/event/:id" element={<EventPage />} />
      <Route path="/playlist/:id" element={<PlaylistPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/join" element={<AuthPage mode="join" />} />
      <Route path="/forgot" element={<ForgotPage />} />
      <Route path="/reset" element={<ResetPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/settings/:tab" element={<Private><Settings /></Private>} />
      <Route path="/moderation" element={<Navigate to="/admin/reports" replace />} />
      <Route path="/admin/*" element={<Private><Staff /></Private>} />
      <Route path="/inbox" element={<Private><Inbox /></Private>} />
      <Route path="/messages" element={<Private><MessagesPage view="inbox" /></Private>} />
      <Route path="/messages/requests" element={<Private><MessagesPage view="requests" /></Private>} />
      <Route path="/messages/to/:name" element={<Private><MessagesPage view="new" /></Private>} />
      <Route path="/messages/:id" element={<Private><MessagesPage view="thread" /></Private>} />
      <Route path="/recommended" element={<Private><Recommended /></Private>} />
      <Route path="/scrobble" element={<Private><ScrobblePage /></Private>} />
      <Route path="/connect" element={<Private><Connect /></Private>} />
      <Route path="/developers" element={<Developers />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/guidelines" element={<Guidelines />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ---------- instant navigation ----------
// Pointing at a link renders its page out of sight. Nothing reaches the screen, but every request that page makes
// (and the pictures in the replies) is under way before the click, so the click only has to paint.
const inApp = (e: Event) => {
  // `as`: event targets are DOM elements here, and closest("a[href]") can only match an anchor
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  return a && a.origin === location.origin && !a.target && !a.hasAttribute("download") && !a.pathname.startsWith("/api/") ? a : null;
};
let ahead: (url: string) => void = () => {};
for (const type of ["mouseover", "touchstart", "focusin"]) document.addEventListener(type, e => { const a = inApp(e); if (a) { const url = a.pathname + a.search; for (const path of apisFor(url)) prefetch(path); ahead(url); } }, { passive: true });
const never = new Promise<void>(() => {});
function Never(): null { throw never; } // keeps the look-ahead from ever being committed: no DOM, no effects
function LookAhead() {
  const [url, setUrl] = useState(""), here = useLocation(), nav = useNavigate();
  useEffect(() => { ahead = setUrl; return () => { ahead = () => {}; }; }, []);
  useEffect(() => { setUrl(""); }, [here.pathname, here.search]);
  // go on press rather than on release: the click that follows lands on the page already showing
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const a = inApp(e);
      // `as`: a mouse press always lands on an element
      if (!a || (e.target as Element).closest("button, input, select, textarea, [role=menu]")) return;
      const to = a.pathname + a.search + a.hash;
      if (to !== location.pathname + location.search + location.hash) { nav(to); went = a; }
    };
    // the release that completes this press must not navigate a second time
    const click = (e: MouseEvent) => { if (went && inApp(e) === went) e.preventDefault(); went = null; };
    let went: HTMLAnchorElement | null = null;
    document.addEventListener("mousedown", down);
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("click", click, true); };
  }, [nav]);
  if (!url || url === here.pathname + here.search) return null;
  const at = new URL(url, location.origin);
  return (
    <Suspense key={url} fallback={null}>
      <LocationContext.Provider value={{ location: { pathname: at.pathname, search: at.search, hash: "", state: null, key: "ahead" }, navigationType: NavigationType.Pop }}>
        <Pages />
        <Never />
      </LocationContext.Provider>
    </Suspense>
  );
}

// the first page's data is requested straight away, alongside the session check, rather than after it
for (const path of apisFor(location.pathname + location.search)) prefetch(path);

// A click shows the next page at once. If its code or data has not arrived yet (nothing preloaded it on hover),
// the old page gives way to a spinner rather than sitting there as if the click did nothing. Keying on the path
// remounts the page so it cannot hold on to the previous one; changes to the query string (period, page) stay in place.
function Routed() {
  const { pathname } = useLocation();
  return <Suspense key={pathname} fallback={<Spinner page />}><Pages /></Suspense>;
}

const boot = (window as { __ME?: MeResponse }).__ME;

function App() {
  // the server puts the answer to /api/me in the page (server/app.ts); in development it is fetched
  const [me, setMeRaw] = useState<Me | null>(() => boot?.user ?? null), [ready, setReady] = useState(!!boot);
  // what the API returns depends on who is asking, so a change of viewer refetches everything on screen
  const setMe = useCallback((m: Me | null) => { setMeRaw(prev => { if ((prev?.username ?? null) !== (m?.username ?? null)) invalidateAll(); return m; }); }, []);
  const refresh = useCallback(() => { api<MeResponse>("/me").then(r => setMeRaw(r.user)).catch(() => {}).finally(() => setReady(true)); }, []);
  useEffect(() => { if (!boot) refresh(); }, [refresh]);
  // live updates: one socket while signed in. Events patch the cached pages and the unread badge.
  useEffect(() => { liveConnect(!!me?.id); }, [me?.id]);
  useLive(e => {
    if (e.t === "open" && e.again) { invalidateAll(); refresh(); return; } // back online: catch up on what was missed
    applyDmEvent(e);
    if ("counts" in e) { const counts = e.counts; setMeRaw(m => m && { ...m, dm: counts }); }
  });
  if (!ready) return <><header className="site-header"><div className="wrap"><span className="logo"><Logo /></span></div></header><Spinner page /></>;
  return (
    <Theme theme={needleTheme} mode="light">
    <LinkProvider component={RouteLink}>
    <AuthContext.Provider value={{ me, setMe, refresh }}>
      <BrowserRouter>
        <PlayerProvider>
          <ScrollTop />
          <LookAhead />
          <Header />
          <SiteBanner />
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

createRoot(document.getElementById("root")!).render(<App />);
