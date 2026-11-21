// Types shared by the server and the browser for the staff portal: the dashboard, accounts, reports and
// direct-message moderation. (Content, catalogue, audit and settings pages are in shared/admin-content.ts.)
import type { Role } from "./site";
import type { PublicUser } from "./users";

/** A page on the site: what to call it and where it is. */
export type PageRef = { label: string; link: string };
/** The paging every staff list echoes back. */
export type Paged = { limit: number; page: number; offset: number };
/** A plain "done". */
export type Ok = { ok: true };

/** GET /api/site: what every page needs to know about the site. */
export type SiteInfo = { registrationsOpen: boolean; maxShoutLength: number; announcement: { id: number; text: string; tone: "info" | "warning" } | null };

/** One entry of the audit log. `subject` is the username of the account it concerns; `data` depends on the action. */
export type AuditRow = {
  id: number; actor: string; action: string; targetType: string; targetId: number | null; label: string; subject: string | null;
  note: string; data: Record<string, unknown>; createdAt: number;
};

// ---------- dashboard ----------
/** A count for one UTC day; `day` is the Unix time the day starts. */
export type DayCount = { day: number; count: number };
export type Dashboard = {
  totals: {
    users: number; newUsers7: number; newUsers30: number; active7: number; scrobbles: number; scrobbles7: number; openReports: number; openFlags: number;
    reports7: number; suspended: number; banned: number; admins: number; moderators: number; shouts7: number; journals7: number; wikis7: number;
    artists: number; albums: number; tracks: number; lockedWikis: number;
  };
  series: { scrobbles: DayCount[]; signups: DayCount[]; reports: DayCount[]; posts: DayCount[] };
  recentUsers: (PublicUser & { registeredAt: number })[];
  recentActions: AuditRow[];
};

// ---------- accounts ----------
/** A row of the account list. `email` is only sent to admins. */
export type StaffUserRow = {
  id: number; username: string; realname: string; image: string | null; email?: string; registeredAt: number; role: Role; suspended: boolean; banned: boolean;
  /** still has to confirm a real address (imported profiles with placeholder addresses don't count) */
  unconfirmed: boolean; scrobbles: number; openReports: number; lastLogin: number | null;
};
export type StaffUserList = { items: StaffUserRow[]; total: number } & Paged;
/** A report as listed on an account's page. */
export type ReportBrief = {
  id: number; type: string; reason: string; status: string; outcome: string; createdAt: number; reporter: string | null; resolver: string | null;
  where: string; author: string | null;
};
export type ModNote = { id: number; body: string; createdAt: number; author: string | null };
/** Everything staff see about one account. */
export type StaffUserPage = {
  user: {
    id: number; username: string; realname: string; email?: string; country: string; website: string; about: string; image: string | null; registeredAt: number;
    role: Role; suspended: boolean; banned: boolean; bannedAt: number | null; banReason: string; hideRecent: boolean; configAdmin: boolean; self: boolean;
    /** when the address was confirmed; `placeholder` marks an imported profile's address, which can't receive mail */
    emailVerifiedAt: number | null; placeholder: boolean; unconfirmed: boolean;
  };
  counts: {
    scrobbles: number; loved: number; shouts: number; journals: number; wikiEdits: number; playlists: number; tags: number; followers: number; following: number;
    blockedBy: number; sessions: number; apiSessions: number;
  };
  lastLogin: number | null;
  lastScrobble: number | null;
  reportsAgainst: ReportBrief[];
  reportsBy: ReportBrief[];
  recentShouts: { id: number; body: string; createdAt: number; where: PageRef | null }[];
  history: AuditRow[];
  dm: { muted: boolean; policy: string; threads: number; startedDay: number; startedWeek: number; sent: number; sentWeek: number; openFlags: number; openReports: number };
  notes: ModNote[];
};
export type SuspendResult = { suspended: boolean };
export type BanResult = { banned: boolean };
export type RoleResult = { role: Role };
export type SessionsResult = { revoked: number };
export type VerifyResult = { verifiedAt: number };
export type NoteAdded = { id: number };

// ---------- reports ----------
/** A report in the queue, with its target as it stands now (or as it was when reported, if it is gone). */
export type StaffReport = {
  id: number; type: string; targetId: number; reason: string; detail: string; status: string; outcome: string; note: string;
  reporter: string | null; resolver: string | null; createdAt: number; resolvedAt: number | null; exists: boolean;
  author: string | null; authorSuspended: boolean; authorBanned: boolean; authorStaff: boolean; text: string; where: string; link: string | null; others: number;
  /** Only on reports of a direct message. */
  threadId?: number | null; authorMuted?: boolean; removed?: boolean;
};
export type StaffReportList = { items: StaffReport[]; total: number } & Paged & { open: number; byType: Record<string, number>; byReason: Record<string, number> };
export type ReportsClosed = { closed: number };
export type ReportResolved = { ok: true; closed: number };

// ---------- direct messages ----------
export type DmSummary = { openFlags: number };
/** One side of a conversation. Only the id is left once the account is gone. */
export type DmPerson =
  | { id: number; username: string; image: string | null; role: Role; suspended: boolean; banned: boolean; dmMuted: boolean }
  | { id: number; username: null };
/** A conversation without its text. */
export type DmThreadHead = {
  id: number; status: string; requester: string | null; createdAt: number; lastAt: number; users: [DmPerson, DmPerson];
  messages: number; deleted: number; reports: number;
};
export type DmThreadList = { items: DmThreadHead[]; total: number; user: string | null } & Paged;
export type DmTranscriptMessage = {
  id: number; from: number; body: string; at: number; deletedAt: number | null; deletedBy: string | null; bySender: boolean; reports: number;
};
/** A transcript. It stays locked until the admin gives a reason; `window` is how long (seconds) one reason lasts. */
export type DmTranscript =
  | { thread: DmThreadHead; locked: true; window: number }
  | { thread: DmThreadHead; locked: false; window: number; openedAt: number; reason: string; more: boolean; messages: DmTranscriptMessage[] };
export type DmMessageDeleted = { ok: true; closedReports: number };
export type DmMuteResult = { muted: boolean };
/** An automatic spam flag on an account's messaging. */
export type DmFlag = {
  id: number; kind: string; detail: string; sample: string; createdAt: number; resolvedAt: number | null; resolver: string | null;
  user: { username: string; role: Role; suspended: boolean; banned: boolean; dmMuted: boolean };
  threadsDay: number;
};
export type DmFlagList = { items: DmFlag[]; total: number; open: number; canRead: boolean } & Paged;
