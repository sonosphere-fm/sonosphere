import type { Role } from "./site";
import type { PublicUser } from "./users";

export type PageRef = { label: string; link: string };
export type Paged = { limit: number; page: number; offset: number };
export type Ok = { ok: true };

export type SiteInfo = {
  registrationsOpen: boolean;
  maxShoutLength: number;
  announcement: { id: number; text: string; tone: "info" | "warning" } | null;
};

export type AuditRow = {
  id: number;
  actor: string;
  action: string;
  targetType: string;
  targetId: number | null;
  label: string;
  subject: string | null;
  note: string;
  data: Record<string, unknown>;
  createdAt: number;
};

export type DayCount = { day: number; count: number };
export type Dashboard = {
  totals: {
    users: number;
    newUsers7: number;
    newUsers30: number;
    active7: number;
    scrobbles: number;
    scrobbles7: number;
    openReports: number;
    openFlags: number;
    reports7: number;
    suspended: number;
    banned: number;
    admins: number;
    moderators: number;
    shouts7: number;
    journals7: number;
    wikis7: number;
    artists: number;
    albums: number;
    tracks: number;
    lockedWikis: number;
  };
  series: { scrobbles: DayCount[]; signups: DayCount[]; reports: DayCount[]; posts: DayCount[] };
  recentUsers: (PublicUser & { registeredAt: number })[];
  recentActions: AuditRow[];
};

export type StaffUserRow = UserAppearance & {
  id: number;
  username: string;
  realname: string;
  image: string | null;
  email?: string;
  registeredAt: number;
  role: Role;
  suspended: boolean;
  banned: boolean;
  unconfirmed: boolean;
  probation: boolean;
  scrobbles: number;
  openReports: number;
  lastLogin: number | null;
};
export type StaffTrust = {
  staff: boolean;
  probation: boolean;
  held: boolean;
  score: number;
  needed: number;
  eligibleAt: number;
  checkedAt: number | null;
  clearedAt: number | null;
  clearedBy: string | null;
  points: { label: string; points: number }[];
};
export type StaffUserList = { items: StaffUserRow[]; total: number } & Paged;
export type ReportBrief = {
  id: number;
  type: string;
  reason: string;
  status: string;
  outcome: string;
  createdAt: number;
  reporter: string | null;
  resolver: string | null;
  where: string;
  author: string | null;
};
export type ModNote = { id: number; body: string; createdAt: number; author: string | null };
export type StaffUserPage = {
  user: {
    id: number;
    username: string;
    realname: string;
    email?: string;
    country: string;
    website: string;
    about: string;
    image: string | null;
    registeredAt: number;
    role: Role;
    suspended: boolean;
    banned: boolean;
    bannedAt: number | null;
    banReason: string;
    hideRecent: boolean;
    configAdmin: boolean;
    self: boolean;
    emailVerifiedAt: number | null;
    placeholder: boolean;
    unconfirmed: boolean;
  };
  counts: {
    scrobbles: number;
    loved: number;
    shouts: number;
    journals: number;
    wikiEdits: number;
    playlists: number;
    tags: number;
    followers: number;
    following: number;
    blockedBy: number;
    sessions: number;
    apiSessions: number;
  };
  lastLogin: number | null;
  lastScrobble: number | null;
  reportsAgainst: ReportBrief[];
  reportsBy: ReportBrief[];
  recentShouts: { id: number; body: string; createdAt: number; where: PageRef | null }[];
  history: AuditRow[];
  dm: {
    muted: boolean;
    policy: string;
    threads: number;
    startedDay: number;
    startedWeek: number;
    sent: number;
    sentWeek: number;
    openFlags: number;
    openReports: number;
  };
  trust: StaffTrust;
  notes: ModNote[];
};
export type SuspendResult = { suspended: boolean };
export type BanResult = { banned: boolean };
export type ProbationResult = { probation: boolean };
export type RoleResult = { role: Role };
export type SessionsResult = { revoked: number };
export type VerifyResult = { verifiedAt: number };
export type NoteAdded = { id: number };

export type StaffReport = {
  id: number;
  type: string;
  targetId: number;
  reason: string;
  detail: string;
  status: string;
  outcome: string;
  note: string;
  reporter: string | null;
  resolver: string | null;
  createdAt: number;
  resolvedAt: number | null;
  exists: boolean;
  author: string | null;
  authorSuspended: boolean;
  authorBanned: boolean;
  authorStaff: boolean;
  text: string;
  where: string;
  link: string | null;
  others: number;
  threadId?: number | null;
  authorMuted?: boolean;
  removed?: boolean;
};
export type StaffReportList = { items: StaffReport[]; total: number } & Paged & {
    open: number;
    byType: Record<string, number>;
    byReason: Record<string, number>;
  };
export type ReportsClosed = { closed: number };
export type ReportResolved = { ok: true; closed: number };

export type DmSummary = { openFlags: number };
export type DmPerson =
  | {
      id: number;
      username: string;
      image: string | null;
      role: Role;
      suspended: boolean;
      banned: boolean;
      dmMuted: boolean;
    }
  | { id: number; username: null };
export type DmThreadHead = {
  id: number;
  status: string;
  requester: string | null;
  createdAt: number;
  lastAt: number;
  users: [DmPerson, DmPerson];
  messages: number;
  deleted: number;
  reports: number;
};
export type DmThreadList = { items: DmThreadHead[]; total: number; user: string | null } & Paged;
export type DmTranscriptMessage = {
  id: number;
  from: number;
  body: string;
  at: number;
  deletedAt: number | null;
  deletedBy: string | null;
  bySender: boolean;
  reports: number;
};
export type DmTranscript =
  | { thread: DmThreadHead; locked: true; window: number }
  | {
      thread: DmThreadHead;
      locked: false;
      window: number;
      openedAt: number;
      reason: string;
      more: boolean;
      messages: DmTranscriptMessage[];
    };
export type DmMessageDeleted = { ok: true; closedReports: number };
export type DmMuteResult = { muted: boolean };
export type DmFlag = {
  id: number;
  kind: string;
  detail: string;
  sample: string;
  createdAt: number;
  resolvedAt: number | null;
  resolver: string | null;
  user: { username: string; role: Role; suspended: boolean; banned: boolean; dmMuted: boolean };
  threadsDay: number;
};
export type DmFlagList = { items: DmFlag[]; total: number; open: number; canRead: boolean } & Paged;
import type { UserAppearance } from "./username-fonts";
