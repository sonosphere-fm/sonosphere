import { useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Ico } from "../icons";
import { Button, SearchField, Select, Textarea } from "../kit";
import { ago, api, date, dateTime, num, plural, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Avatar, Empty, Pager, Section, Stat } from "../ui/base";
import { type Role, REASON, TYPE, ROLE, adminUrl, useQuery, useRole, useConfirm, useFlash, StatusBadges } from "./common";
import { COMPACT_LIST, FACTS, LIST, RED, SCROLL, SEARCH, TABLE, TILES } from "./common";
import { TOOLBAR, TYPE_LABEL } from "./common";
import { USER_HEAD, USER_HEAD_SUB, USER_HEAD_TITLE, WHO, cx, sortButton } from "./common";
import { AuditList } from "./audit";
import { ManageUserLabels } from "./user-labels";
import type {
  BanResult, DmMuteResult, NoteAdded, Ok, ProbationResult, ReportBrief, RoleResult, SessionsResult, StaffTrust, StaffUserList, StaffUserPage, SuspendResult,
} from "../../shared/admin";

type AccountReply = NoteAdded | DmMuteResult | SuspendResult | BanResult | SessionsResult | RoleResult | ProbationResult;
const ROLES: Role[] = ["user", "moderator", "admin"];

const USER_FILTERS: [string, string][] = [
  ["all", "Everyone"],
  ["reported", "With open reports"],
  ["suspended", "Suspended"],
  ["banned", "Banned"],
  ["unconfirmed", "Email not confirmed"],
  ["probation", "On probation"],
  ["staff", "All staff"],
  ["admins", "Admins"],
  ["moderators", "Moderators"],
];
const POLICY: Record<string, string> = {
  everyone: "Messages from anyone",
  requests: "Requests from people they don't follow",
  following: "Only people they follow",
  nobody: "No messages",
};
const ROLE_BLURB: Record<Role, string> = {
  admin: "Admins can manage accounts, roles, the catalogue and site settings.",
  moderator: "Moderators handle reports, content and posting suspensions.",
  user: "They lose access to the admin area.",
};

function roleTitle(r: Role) {
  if (r === "user") return "a regular user";
  return `a${r === "admin" ? "n" : ""} ${r}`;
}

const defaultDir = (key: string) => (key === "username" ? "asc" : "desc");

export function Users() {
  const [sp, set] = useQuery();
  const role = useRole();
  const term = sp.get("q") || "";
  const filter = sp.get("filter") || "all";
  const sort = sp.get("sort") || "registered";
  const dir = sp.get("dir") || defaultDir(sort);
  const page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const q = useApi<StaffUserList>(`/admin/users${qs({ q: term, filter: filter === "all" ? "" : filter, sort, dir, page })}`);
  useTitle("Users");
  const search = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim() });
  };
  const sortBy = (key: string) => {
    if (sort !== key) set({ sort: key, dir: defaultDir(key) });
    else set({ sort: key, dir: dir === "asc" ? "desc" : "asc" });
  };
  const th = (key: string, label: string, cls = "") => {
    const on = sort === key;
    let ariaSort: "ascending" | "descending" | "none" = "none";
    if (on) ariaSort = dir === "asc" ? "ascending" : "descending";
    return (
      <th className={cls} aria-sort={ariaSort}>
        <button type="button" className={sortButton(on)} onClick={() => sortBy(key)}>
          {label}{on && (dir === "asc" ? <Ico.SortUp /> : <Ico.SortDown />)}
        </button>
      </th>
    );
  };
  return (
    <>
      <div className={TOOLBAR}>
        <form className={`${SEARCH} max-[860px]:flex-[1_1_100%]`} onSubmit={search}>
          <SearchField
            value={text}
            onChange={setText}
            placeholder={role === "admin" ? "Username, name or email" : "Username or name"}
            label="Search users"
            clearable
          />
        </form>
        <Select label="Show" value={filter} onChange={v => set({ filter: v === "all" ? "" : v })} options={USER_FILTERS} />
      </div>
      <Async q={q}>{d => (
        <>
          <p className="muted small">{plural(d.total, "account")}{term && <> matching “{term}”</>}</p>
          {d.items.length === 0 ? <Empty>No accounts match.</Empty> : (
            <div className={SCROLL}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    {th("username", "Account")}
                    <th>Status</th>
                    {th("scrobbles", "Scrobbles", "num")}
                    {th("reports", "Open reports", "num")}
                    {th("registered", "Joined")}
                    {th("login", "Last login")}
                  </tr>
                </thead>
                <tbody>
                  {d.items.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className={WHO}>
                          <Avatar user={u} size={28} />
                          <span>
                            <Link className="strong" to={adminUrl(u.username)}>{u.username}</Link>
                            {(u.realname || u.email) && <span className="muted small"> {[u.realname, u.email].filter(Boolean).join(" · ")}</span>}
                          </span>
                        </div>
                      </td>
                      <td><StatusBadges u={u} /></td>
                      <td className="num">{num(u.scrobbles)}</td>
                      <td className="num">{u.openReports ? <b className={RED}>{u.openReports}</b> : <span className="muted">0</span>}</td>
                      <td className="nowrap" title={dateTime(u.registeredAt)}>{date(u.registeredAt)}</td>
                      <td className="nowrap muted">{u.lastLogin ? ago(u.lastLogin) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
    </>
  );
}

const NOTE_FORM = "flex gap-[10px] items-start mb-2 max-[860px]:flex-col max-[860px]:items-stretch";
const STAFF_NOTE = cx(
  "py-[10px] px-3 mb-2 bg-[light-dark(#fffbea,#2a2718)]",
  "border-l-[3px] border-l-site-sun",
);
const ACTIONS = "flex flex-col items-stretch gap-2 *:w-full";

export function UserDetail() {
  const name = useParams().name!;
  const role = useRole();
  const { refresh } = useAuth();
  const [modal, ask] = useConfirm();
  const flash = useFlash();
  const q = useApi<StaffUserPage>(`/admin/users/${encodeURIComponent(name)}`);
  const [noteText, setNoteText] = useState("");
  const [deleted, setDeleted] = useState(false);
  useTitle(name);
  if (deleted) return <Navigate to="/admin/users" replace />;
  return (
    <>
      {modal}
      <p className="small"><Link to="/admin/users"><Ico.Left /> All users</Link></p>
      <Async q={q}>{d => {
        const u = d.user;
        const staffTarget = u.role !== "user";
        const locked = u.self || u.configAdmin;
        const post = (path: string, body: Record<string, unknown>) =>
          api<AccountReply>(`/admin/users/${encodeURIComponent(u.username)}/${path}`, { body }).then(() => {
            q.reload();
            refresh();
          });
        let why = "";
        if (u.self) why = "This is your account.";
        else if (u.configAdmin) why = "This admin is set in the server configuration (ADMIN_USERS).";
        let confirmed = "Not yet";
        if (u.emailVerifiedAt) confirmed = dateTime(u.emailVerifiedAt);
        else if (u.placeholder) confirmed = "No, imported profile with a placeholder address";
        const canSuspend = (!staffTarget || role === "admin") && !u.banned && !u.self;

        const addNote = (e: FormEvent) => {
          e.preventDefault();
          flash.run(async () => {
            await post("notes", { body: noteText });
            setNoteText("");
          });
        };
        const deleteNote = (id: number) => ask({
          title: "Delete note",
          action: "Delete",
          danger: true,
          note: false,
          body: <p>Delete this note? This can't be undone.</p>,
          run: () => api<Ok>(`/admin/notes/${id}`, { method: "DELETE" }).then(() => q.reload()),
        });
        const allowMessaging = () => ask({
          title: "Turn messaging back on",
          action: "Allow messaging",
          body: <p>{u.username} will be able to send direct messages again, within the usual limits.</p>,
          run: note => post("dm-mute", { muted: false, note }),
        });
        const muteMessaging = () => ask({
          title: "Turn off messaging",
          action: "Turn off",
          danger: true,
          body: <p>{u.username} won't be able to send direct messages. They can still read their conversations and use the rest of the site.</p>,
          run: note => post("dm-mute", { muted: true, note }),
        });
        const liftSuspension = () => ask({
          title: "Lift suspension",
          action: "Lift suspension",
          body: <p>{u.username} will be able to post on walls, journals and wiki edits again.</p>,
          run: note => post("suspend", { suspended: false, note }),
        });
        const suspend = () => ask({
          title: "Suspend from posting",
          action: "Suspend",
          danger: true,
          body: <p>{u.username} can keep listening and scrobbling but can't post on walls, journals or wiki edits.</p>,
          run: note => post("suspend", { suspended: true, note }),
        });
        const liftBan = () => ask({
          title: "Lift ban",
          action: "Unban",
          body: <p>{u.username} will be able to log in again and their profile becomes visible.</p>,
          run: note => post("ban", { banned: false, note }),
        });
        const ban = () => ask({
          title: `Ban ${u.username}`,
          action: "Ban account",
          danger: true,
          note: "Reason (kept with the ban)",
          body: <p>They are signed out everywhere, can't log in, and their profile is hidden from everyone but staff. Their scrobbles and posts are kept.</p>,
          run: note => post("ban", { banned: true, note }),
        });
        const verify = () => ask({
          title: "Mark email as confirmed",
          action: "Confirm email",
          body: (
            <p>
              {u.username} gets full access (posting, messaging, following) without using the link, and won't be removed as unconfirmed. Only do this if
              you know the address is theirs.
            </p>
          ),
          run: note => post("verify", { note }),
        });
        const endProbation = () => ask({
          title: "End probation",
          action: "End probation",
          body: <p>{u.username} gets the usual limits from now on.</p>,
          run: note => post("probation", { probation: false, note }),
        });
        const holdProbation = () => ask({
          title: "Put on probation",
          action: "Put on probation",
          body: <p>{u.username} gets the tighter limits again and stays on probation until staff end it. They aren't told.</p>,
          run: note => post("probation", { probation: true, note }),
        });
        const revokeSessions = () => ask({
          title: "Sign out everywhere",
          action: "Revoke sessions",
          body: <p>End {u.username}'s {plural(d.counts.sessions, "web session")} and {plural(d.counts.apiSessions, "app session")}. They can log in again.</p>,
          run: note => post("sessions", { note }).then(() => {}),
        });
        const changeRole = (r: Role) => ask({
          title: `Make ${u.username} ${roleTitle(r)}`,
          action: "Change role",
          danger: r === "admin",
          body: <p>{ROLE_BLURB[r]}</p>,
          run: note => post("role", { role: r, note }),
        });
        const deleteAccount = () => ask({
          title: `Delete ${u.username}`,
          action: "Delete account",
          danger: true,
          typed: u.username,
          body: (
            <p>
              Permanently deletes the account with its {plural(d.counts.scrobbles, "scrobble")}, {plural(d.counts.shouts, "wall post")},{" "}
              {plural(d.counts.journals, "journal post")}, loved tracks, playlists and tags. Open reports about them are closed. This can't be undone.
            </p>
          ),
          run: note => api<Ok>(`/admin/users/${encodeURIComponent(u.username)}/delete`, { body: { confirm: u.username, note } }).then(() => setDeleted(true)),
        });

        return (
          <>
            <div className={USER_HEAD}>
              <Avatar user={u} size={64} />
              <div className="grow">
                <h2 className={USER_HEAD_TITLE}>{u.username} <StatusBadges u={{ ...u, probation: d.trust.probation }} /></h2>
                <p className={`muted ${USER_HEAD_SUB}`}>{[u.realname, u.country].filter(Boolean).join(" · ") || "No name or country set"}</p>
              </div>
              {!u.banned && <Button kind="btn ghost small" href={userUrl(u.username)}>View profile <Ico.Right /></Button>}
            </div>
            {u.banned && (
              <p className="notice">
                Banned {u.bannedAt ? ago(u.bannedAt) : ""}{u.banReason ? `: ${u.banReason}` : ""}. The account can't log in and its profile is hidden from
                everyone but staff.
              </p>
            )}
            {u.suspended && !u.banned && <p className="notice">Suspended from posting. They can still listen and scrobble.</p>}
            <div className={TILES}>
              <Stat label="Scrobbles" value={num(d.counts.scrobbles)} hint={d.lastScrobble ? `last ${ago(d.lastScrobble)}` : "none yet"} />
              <Stat label="Wall posts" value={num(d.counts.shouts)} />
              <Stat label="Journal posts" value={num(d.counts.journals)} />
              <Stat label="Wiki edits" value={num(d.counts.wikiEdits)} />
              <Stat
                label="Reports against"
                value={num(d.reportsAgainst.filter(r => r.status === "open").length)}
                hint={`${d.reportsAgainst.length} in total`}
              />
            </div>
            <div className="cols">
              <div className="main">
                {role === "admin" && <ManageUserLabels name={u.username} />}
                <Section title="Internal notes">
                  <p className="muted small">Only staff can see these.</p>
                  <form className={NOTE_FORM} onSubmit={addNote}>
                    <Textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note for other staff" maxLength={2000} />
                    <Button kind="btn small" disabled={!noteText.trim()}>Add note</Button>
                  </form>
                  {flash.note}
                  {d.notes.length > 0 && (
                    <ul className="list-none m-[10px_0_0] p-0">
                      {d.notes.map(n => (
                        <li key={n.id} className={STAFF_NOTE}>
                          <p className="m-[0_0_4px] whitespace-pre-wrap wrap-anywhere">{n.body}</p>
                          <span className="muted small">
                            {n.author || "deleted staff"} · {ago(n.createdAt)} ·{" "}
                            <Button kind="link small" type="button" onClick={() => deleteNote(n.id)}>Delete</Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title="Reports against this account">
                  <ReportMini items={d.reportsAgainst} empty="No one has reported this account or its posts." show="reporter" />
                </Section>
                <Section title="Reports filed by this account">
                  <ReportMini items={d.reportsBy} empty="They haven't reported anything." show="author" />
                </Section>
                <Section title="Moderation history"><AuditList items={d.history} empty="No staff actions on this account yet." /></Section>
                {d.recentShouts.length > 0 && (
                  <Section
                    title="Recent wall posts"
                    more={`/admin/content?kind=shouts&user=${encodeURIComponent(u.username)}`}
                    moreLabel="All their posts"
                  >
                    <ul className={LIST}>
                      {d.recentShouts.map(s => (
                        <li key={s.id}>
                          <p>{s.body}</p>
                          <span className="muted small">{s.where ? <Link to={s.where.link}>{s.where.label}</Link> : "a page"} · {ago(s.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
              <aside className="side">
                <Section title="Account">
                  <dl className={FACTS}>
                    {u.email !== undefined && <><dt>Email</dt><dd className="wrap-anywhere">{u.email}</dd></>}
                    <dt>Confirmed</dt><dd>{confirmed}</dd>
                    <dt>Joined</dt><dd>{dateTime(u.registeredAt)}</dd>
                    <dt>Last login</dt><dd>{d.lastLogin ? dateTime(d.lastLogin) : "No active session"}</dd>
                    <dt>Sessions</dt><dd>{num(d.counts.sessions)} web, {num(d.counts.apiSessions)} app</dd>
                    {u.website && <><dt>Website</dt><dd className="wrap-anywhere">{u.website}</dd></>}
                    <dt>Social</dt>
                    <dd>
                      {num(d.counts.followers)} followers, {num(d.counts.following)} following
                      {d.counts.blockedBy ? `, blocked by ${num(d.counts.blockedBy)}` : ""}
                    </dd>
                    <dt>Library</dt><dd>{num(d.counts.loved)} loved, {num(d.counts.playlists)} playlists, {num(d.counts.tags)} tags</dd>
                  </dl>
                </Section>
                <Section title="Probation">
                  <Probation t={d.trust} />
                  {!d.trust.staff && !u.banned && (
                    <div className={`${ACTIONS} adm-dm-act`}>
                      {d.trust.probation ? (
                        <Button kind="btn ghost" type="button" onClick={endProbation}>End probation</Button>
                      ) : (
                        <Button kind="btn ghost" type="button" onClick={holdProbation}>Put on probation</Button>
                      )}
                    </div>
                  )}
                </Section>
                <Section title="Direct messages">
                  {d.dm.muted && <p className="notice small">Messaging is turned off. They can read their conversations but can't send.</p>}
                  <dl className={FACTS}>
                    <dt>Conversations</dt>
                    <dd>
                      {num(d.dm.threads)}
                      {role === "admin" && d.dm.threads > 0 && <> · <Link to={`/admin/messages${qs({ user: u.username })}`}>View</Link></>}
                    </dd>
                    <dt>Started</dt><dd>{num(d.dm.startedDay)} in the last day, {num(d.dm.startedWeek)} in the last week</dd>
                    <dt>Sent</dt><dd>{plural(d.dm.sent, "message")}, {num(d.dm.sentWeek)} in the last week</dd>
                    <dt>Spam flags</dt>
                    <dd>
                      {d.dm.openFlags ? <Link to="/admin/messages?tab=flags"><b className={RED}>{num(d.dm.openFlags)} open</b></Link> : "None open"}
                    </dd>
                    <dt>Reported</dt>
                    <dd>
                      {d.dm.openReports ? (
                        <Link to="/admin/reports?type=dm"><b className={RED}>{plural(d.dm.openReports, "message")}</b></Link>
                      ) : "No open reports"}
                    </dd>
                    <dt>Accepts</dt><dd>{POLICY[d.dm.policy] ?? d.dm.policy}</dd>
                  </dl>
                  {!staffTarget && !locked && (
                    <div className={`${ACTIONS} adm-dm-act`}>
                      {d.dm.muted ? (
                        <Button kind="btn ghost" type="button" onClick={allowMessaging}>Allow messaging again</Button>
                      ) : (
                        <Button kind="btn ghost" type="button" onClick={muteMessaging}>Turn off messaging</Button>
                      )}
                    </div>
                  )}
                </Section>
                <Section title="Actions">
                  {why && <p className="muted small">{why}</p>}
                  <div className={ACTIONS}>
                    {canSuspend && (u.suspended ? (
                      <Button kind="btn ghost" type="button" onClick={liftSuspension}>Lift suspension</Button>
                    ) : (
                      <Button kind="btn ghost" type="button" disabled={staffTarget || locked} onClick={suspend}>Suspend from posting</Button>
                    ))}
                    {role === "admin" && (
                      <>
                        {u.banned ? (
                          <Button kind="btn ghost" type="button" onClick={liftBan}>Lift ban</Button>
                        ) : (
                          <Button kind="btn danger" type="button" disabled={staffTarget || locked} onClick={ban}>Ban account</Button>
                        )}
                        {u.unconfirmed && <Button kind="btn ghost" type="button" onClick={verify}>Mark email confirmed</Button>}
                        <Button
                          kind="btn ghost"
                          type="button"
                          disabled={u.self || !(d.counts.sessions + d.counts.apiSessions)}
                          onClick={revokeSessions}
                        >
                          Revoke sessions
                        </Button>
                        {!u.banned && !locked && <RolePicker current={u.role} onPick={changeRole} />}
                        <Button kind="btn danger" type="button" disabled={staffTarget || locked} onClick={deleteAccount}>Delete account</Button>
                      </>
                    )}
                    {staffTarget && !locked && role === "admin" && (
                      <p className="muted small">Staff can't be suspended, banned or deleted. Change their role to user first.</p>
                    )}
                  </div>
                </Section>
              </aside>
            </div>
          </>
        );
      }}</Async>
    </>
  );
}

function Probation({ t }: { t: StaffTrust }) {
  if (t.staff) return <p className="muted small">Staff are never on probation.</p>;
  let state = "Joined before probation started.";
  if (t.probation) {
    state = "Tighter limits on messages, new conversations, groups, follows, wall posts, journal posts, tags, wiki edits and reports. They aren't told.";
  } else if (t.clearedBy) state = `Ended by ${t.clearedBy} ${ago(t.clearedAt ?? 0)}.`;
  else if (t.checkedAt) state = `Left probation ${ago(t.clearedAt ?? 0)}.`;
  let exit = "As soon as the score is reached";
  if (t.held) exit = "Held by staff";
  else if (t.eligibleAt * 1000 > Date.now()) exit = dateTime(t.eligibleAt);
  return (
    <>
      <p className="muted small">{state}</p>
      <dl className={FACTS}>
        <dt>Score</dt><dd>{t.score} of {t.needed}</dd>
        {t.probation && <><dt>Earliest exit</dt><dd>{exit}</dd></>}
        {t.checkedAt && <><dt>Last checked</dt><dd>{ago(t.checkedAt)}</dd></>}
      </dl>
      {t.points.length > 0 && (
        <ul className="list-none m-[10px_0_0] p-0 text-[14px]">
          {t.points.map(p => (
            <li key={p.label} className="flex justify-between gap-3 py-[3px]"><span>{p.label}</span>{p.points > 0 ? <b>+{p.points}</b> : <b className={RED}>{p.points}</b>}</li>
          ))}
        </ul>
      )}
    </>
  );
}

const ROLE_BUTTON = cx(
  "flex-1 py-[7px] px-1.5 [border:0] not-last:[border-right:1px_solid_var(--line)]",
  "font-semibold text-[13px]",
);
const ROLE_ON = "bg-site-ink text-site-bg cursor-default";
const ROLE_OFF = "bg-site-card text-site-ink-2 cursor-pointer hover:bg-site-panel hover:text-site-ink";
const roleButton = (on: boolean) => `${ROLE_BUTTON} ${on ? ROLE_ON : ROLE_OFF}`;

function RolePicker({ current, onPick }: { current: Role; onPick: (r: Role) => void }) {
  return (
    <div className="flex border border-site-line rounded-[4px] overflow-hidden" role="group" aria-label="Role">
      {ROLES.map(r => (
        <button key={r} type="button" className={roleButton(r === current)} aria-pressed={r === current} onClick={() => r !== current && onPick(r)}>
          {ROLE[r]}
        </button>
      ))}
    </div>
  );
}

function ReportMini({ items, empty, show }: { items: ReportBrief[]; empty: string; show: "reporter" | "author" }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className={COMPACT_LIST}>
      {items.map(r => {
        let who = null;
        if (show === "reporter" && r.reporter) who = <>by <Link to={adminUrl(r.reporter)}>{r.reporter}</Link> · </>;
        if (show === "author" && r.author) who = <>against <Link to={adminUrl(r.author)}>{r.author}</Link> · </>;
        const state = r.status === "open"
          ? <Link to="/admin/reports"><b className={RED}>open</b></Link>
          : `${r.outcome}${r.resolver ? ` by ${r.resolver}` : ""}`;
        return (
          <li key={r.id}>
            <span><span className="badge">{REASON[r.reason] || r.reason}</span> <span className={TYPE_LABEL}>{TYPE[r.type]}</span> {r.where}</span>
            <span className="muted small">{who}{ago(r.createdAt)} · {state}</span>
          </li>
        );
      })}
    </ul>
  );
}
