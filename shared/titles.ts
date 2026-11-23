const SITE = "Sonosphere";

export const fullTitle = (title: string) => (title.startsWith(SITE) ? title : `${title} | ${SITE}`);

export const TITLES = {
  home: "Home",
  guestHome: "Sonosphere - Track what you love",
  charts: "Music Charts",
  chartMaker: "Chart Maker",
  events: "Concerts & Music Events",
  addEvent: "Add a Music Event",
  help: "Scrobbling Help",
  developers: "Developer API Docs",
  terms: "Terms of Service",
  changelog: "Changelog",
  privacy: "Privacy Policy",
  guidelines: "Community Guidelines",
  login: "Log In",
  join: "Join Sonosphere",
  forgot: "Recover Your Account",
  reset: "Reset Password",
  verify: "Verify Your Account",
  settings: "Settings",
  inbox: "Inbox",
  messages: "Messages",
  moderation: "Moderation",
  recommended: "Recommendations",
  scrobble: "Scrobble Music",
  import: "Import Listening History",
  connect: "Connect a Music Player",
  welcome: "Welcome",
  notFound: "Page Not Found",
  editJournal: "Edit Journal",
  profile: "Listener Profile",
} as const;

export const ARTIST_TABS: Record<string, string> = {
  tracks: "Top Tracks",
  albums: "Albums",
  similar: "Similar Artists",
  wiki: "Biography",
  listeners: "Listeners",
  shoutbox: "Shoutbox",
};

export const USER_TABS: Record<string, string> = {
  library: "Music Library",
  "listening-report": "Listening Report",
  journal: "Journal",
  following: "Following",
  followers: "Followers",
  loved: "Loved Tracks",
  obsessions: "Obsessions",
  playlists: "Playlists",
  events: "Events",
  neighbours: "Neighbours",
  tags: "Tags",
  shoutbox: "Shoutbox",
};

const wikiSuffix = (wiki: boolean) => (wiki ? " - Wiki" : "");

export const artistTitle = (name: string, tab = "") =>
  Object.hasOwn(ARTIST_TABS, tab) ? `${name} - ${ARTIST_TABS[tab]}` : `${name} - Music, Albums & Tracks`;
export const releaseTitle = (title: string, artist: string, wiki = false) => `${title} by ${artist}${wikiSuffix(wiki)}`;
export const tagTitle = (name: string, wiki = false) => `${name} Music${wikiSuffix(wiki)}`;
export const searchTitle = (query: string) => (query ? `Search for ${query}` : "Search Music");
export const userTitle = (username: string, tab = "") =>
  `${username} - ${Object.hasOwn(USER_TABS, tab) ? USER_TABS[tab] : TITLES.profile}`;
export const journalTitle = (post: string, username: string) => `${post} - ${username}’s Journal`;
