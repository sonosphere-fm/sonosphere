import common from "./i18n/en/common";
import { format, type Params } from "./i18n/core";

type CommonKey = keyof typeof common;
type Translate = (key: CommonKey, params?: Params) => string;

const SITE = "Sonosphere";

export const fullTitle = (title: string) => (title.startsWith(SITE) ? title : `${title} | ${SITE}`);

const TITLE_KEYS = {
  home: "titleHome",
  guestHome: "titleGuestHome",
  charts: "titleCharts",
  leaderboards: "titleLeaderboards",
  chartMaker: "titleChartMaker",
  events: "titleEvents",
  addEvent: "titleAddEvent",
  help: "titleHelp",
  developers: "titleDevelopers",
  terms: "titleTerms",
  changelog: "titleChangelog",
  privacy: "titlePrivacy",
  guidelines: "titleGuidelines",
  login: "titleLogin",
  join: "titleJoin",
  forgot: "titleForgot",
  reset: "titleReset",
  verify: "titleVerify",
  settings: "titleSettings",
  inbox: "titleInbox",
  messages: "titleMessages",
  moderation: "titleModeration",
  recommended: "titleRecommended",
  scrobble: "titleScrobble",
  import: "titleImport",
  connect: "titleConnect",
  welcome: "titleWelcome",
  notFound: "titleNotFound",
  editJournal: "titleEditJournal",
  profile: "titleProfile",
} as const satisfies Record<string, CommonKey>;

const ARTIST_TAB_KEYS: Record<string, CommonKey> = {
  tracks: "artistTabTracks",
  albums: "artistTabAlbums",
  images: "artistTabImages",
  similar: "artistTabSimilar",
  wiki: "artistTabWiki",
  listeners: "artistTabListeners",
  shoutbox: "artistTabShoutbox",
};

const USER_TAB_KEYS: Record<string, CommonKey> = {
  library: "userTabLibrary",
  "listening-report": "userTabReport",
  journal: "userTabJournal",
  following: "userTabFollowing",
  followers: "userTabFollowers",
  loved: "userTabLoved",
  obsessions: "userTabObsessions",
  playlists: "userTabPlaylists",
  events: "userTabEvents",
  neighbours: "userTabNeighbours",
  tags: "userTabTags",
  shoutbox: "userTabShoutbox",
  cosmetics: "userTabCosmetics",
};

function lazy<K extends string>(keys: Record<K, CommonKey>, tr: Translate) {
  const out = {} as Record<K, string>;
  for (const [name, key] of Object.entries(keys) as [K, CommonKey][]) {
    Object.defineProperty(out, name, { enumerable: true, get: () => tr(key) });
  }
  return out;
}

export function titles(tr: Translate) {
  const TITLES = lazy(TITLE_KEYS, tr);
  const ARTIST_TABS = lazy(ARTIST_TAB_KEYS, tr);
  const USER_TABS = lazy(USER_TAB_KEYS, tr);
  const withWiki = (title: string, wiki: boolean) => (wiki ? tr("titleWiki", { title }) : title);
  return {
    TITLES,
    ARTIST_TABS,
    USER_TABS,
    artistTitle: (name: string, tab = "") =>
      Object.hasOwn(ARTIST_TABS, tab)
        ? tr("titleSubpage", { name, tab: ARTIST_TABS[tab]! })
        : tr("titleArtist", { name }),
    releaseTitle: (title: string, artist: string, wiki = false) =>
      withWiki(tr("titleRelease", { title, artist }), wiki),
    tagTitle: (name: string, wiki = false) => withWiki(tr("titleTag", { name }), wiki),
    searchTitle: (query: string) => (query ? tr("titleSearchFor", { query }) : tr("titleSearch")),
    userTitle: (username: string, tab = "") =>
      tr("titleSubpage", { name: username, tab: Object.hasOwn(USER_TABS, tab) ? USER_TABS[tab]! : TITLES.profile }),
    journalTitle: (post: string, username: string) => tr("titleJournal", { post, name: username }),
  };
}

export const {
  TITLES,
  ARTIST_TABS,
  USER_TABS,
  artistTitle,
  releaseTitle,
  tagTitle,
  searchTitle,
  userTitle,
  journalTitle,
} = titles((key, params) => format("en", common[key], params));
