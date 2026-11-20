import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Ico } from "../icons";
import { Button, SearchField, Select, Textarea } from "../kit";
import { ago, api, date, dateTime, num, plural, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Avatar, Empty, Pager, Section, Stat } from "../ui/base";
import { type Role, REASON, TYPE, ROLE, adminUrl, useQuery, useRole, useConfirm, useFlash, StatusBadges } from "./common";
import { AuditList } from "./audit";
import type { BanResult, DmMuteResult, NoteAdded, Ok, ReportBrief, RoleResult, SessionsResult, StaffUserList, StaffUserPage, SuspendResult } from "../../shared/admin";

/** What the account actions on a user's page answer with. */
type AccountReply = NoteAdded | DmMuteResult | SuspendResult | BanResult | SessionsResult | RoleResult;
const ROLES: Role[] = ["user", "moderator", "admin"];

// ---------- users ----------
const USER_FILTERS: [string, string][] = [["all", "Everyone"], ["reported", "With open reports"], ["suspended", "Suspended"], ["banned", "Banned"], ["staff", "All staff"], ["admins", "Admins"], ["moderators", "Moderators"]];
const POLICY: Record<string, string> = { everyone: "Messages from anyone", requests: "Requests from people they don't follow", following: "Only people they follow", nobody: "No messages" };
export function Users() {
  const [sp, set] = useQuery(), role = useRole();
  const term = sp.get("q") || "", filter = sp.get("filter") || "all", sort = sp.get("sort") || "registered", dir = sp.get("dir") || (sort === "username" ? "asc" : "desc"), page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const q = useApi<StaffUserList>(`/admin/users${qs({ q: term, filter: filter === "all" ? "" : filter, sort, dir, page })}`);
  useTitle("Users");
  const th = (key: string, label: string, cls = "") => (
    <th className={cls} aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={sort === key ? "on" : ""} onClick={() => set({ sort: key, dir: sort === key ? (dir === "asc" ? "desc" : "asc") : key === "username" ? "asc" : "desc" })}>
        {label}{sort === key && <span aria-hidden="true">{dir === "asc" ? " ↑" : " ↓"}</span>}
      </button>
    </th>
  );
  return (
    <>
      <div className="toolbar">
        <form className="adm-search" onSubmit={e => { e.preventDefault(); set({ q: text.trim() }); }}>
          <SearchField value={text} onChange={setText} placeholder={role === "admin" ? "Username, name or email" : "Username or name"} label="Search users" clearable />
        </form>
        <Select label="Show" value={filter} onChange={v => set({ filter: v === "all" ? "" : v })} options={USER_FILTERS} />
      </div>
      <Async q={q}>{d => (
        <>
          <p className="muted small">{plural(d.total, "account")}{term && <> matching “{term}”</>}</p>
          {d.items.length === 0 ? <Empty>No accounts match.</Empty> : (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr>{th("username", "Account")}<th>Status</th>{th("scrobbles", "Scrobbles", "num")}{th("reports", "Open reports", "num")}{th("registered", "Joined")}{th("login", "Last login")}</tr></thead>
                <tbody>{d.items.map(u => (
                  <tr key={u.id}>
                    <td><div className="adm-who"><Avatar user={u} size={28} /><span><Link className="strong" to={adminUrl(u.username)}>{u.username}</Link>{(u.realname || u.email) && <span className="muted small"> {[u.realname, u.email].filter(Boolean).join(" · ")}</span>}</span></div></td>
                    <td><StatusBadges u={u} /></td>
                    <td className="num">{num(u.scrobbles)}</td>
                    <td className="num">{u.openReports ? <b className="adm-red">{u.openReports}</b> : <span className="muted">0</span>}</td>
                    <td className="nowrap" title={dateTime(u.registeredAt)}>{date(u.registeredAt)}</td>
                    <td className="nowrap muted">{u.lastLogin ? ago(u.lastLogin) : "–"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
    </>
  );
}
export function UserDetail() {
  const name = useParams().name!, role = useRole(), { refresh } = useAuth(), [modal, ask] = useConfirm(), flash = useFlash();
  const q = useApi<StaffUserPage>(`/admin/users/${encodeURIComponent(name)}`);
  const [noteText, setNoteText] = useState(""), [deleted, setDeleted] = useState(false);
  useTitle(name);
  if (deleted) return <Navigate to="/admin/users" replace />;
  return (
    <>
      {modal}
      <p className="small"><Link to="/admin/users"><Ico.Left /> All users</Link></p>
      <Async q={q}>{d => {
        const u = d.user, staffTarget = u.role !== "user", locked = u.self || u.configAdmin;
        const post = (path: string, body: Record<string, unknown>) => api<AccountReply>(`/admin/users/${encodeURIComponent(u.username)}/${path}`, { body }).then(() => { q.reload(); refresh(); });
        const why = u.self ? "This is your account." : u.configAdmin ? "This admin is set in the server configuration (ADMIN_USERS)." : "";
        return (
          <>
            <div className="adm-user-head">
              <Avatar user={u} size={64} />
              <div className="grow">
                <h2>{u.username} <StatusBadges u={u} /></h2>
                <p className="muted">{[u.realname, u.country].filter(Boolean).join(" · ") || "No name or country set"}</p>
              </div>
              {!u.banned && <Button kind="btn ghost small" href={userUrl(u.username)}>View profile <Ico.Right /></Button>}
            </div>
            {u.banned && <p className="notice">Banned {u.bannedAt ? ago(u.bannedAt) : ""}{u.banReason ? `: ${u.banReason}` : ""}. The account can't log in and its profile is hidden from everyone but staff.</p>}
            {u.suspended && !u.banned && <p className="notice">Suspended from posting. They can still listen and scrobble.</p>}
            <div className="stats boxed adm-tiles">
              <Stat label="Scrobbles" value={num(d.counts.scrobbles)} hint={d.lastScrobble ? `last ${ago(d.lastScrobble)}` : "none yet"} />
              <Stat label="Wall posts" value={num(d.counts.shouts)} />
              <Stat label="Journal posts" value={num(d.counts.journals)} />
              <Stat label="Wiki edits" value={num(d.counts.wikiEdits)} />
              <Stat label="Reports against" value={num(d.reportsAgainst.filter(r => r.status === "open").length)} hint={`${d.reportsAgainst.length} in total`} />
            </div>
            <div className="cols">
              <div className="main">
                <Section title="Internal notes">
                  <p className="muted small">Only staff can see these.</p>
                  <form className="adm-note-form" onSubmit={e => { e.preventDefault(); flash.run(async () => { await post("notes", { body: noteText }); setNoteText(""); }); }}>
                    <Textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note for other staff" maxLength={2000} />
                    <Button kind="btn small" disabled={!noteText.trim()}>Add note</Button>
                  </form>
                  {flash.note}
                  {d.notes.length > 0 && <ul className="adm-notes">{d.notes.map(n => (
                    <li key={n.id}><p>{n.body}</p><span className="muted small">{n.author || "deleted staff"} · {ago(n.createdAt)} · <Button kind="link small" type="button" onClick={() => ask({
                      title: "Delete note", action: "Delete", danger: true, note: false, body: <p>Delete this note? This can't be undone.</p>,
                      run: () => api<Ok>(`/admin/notes/${n.id}`, { method: "DELETE" }).then(() => q.reload()),
                    })}>Delete</Button></span></li>
                  ))}</ul>}
                </Section>
                <Section title="Reports against this account">
                  <ReportMini items={d.reportsAgainst} empty="No one has reported this account or its posts." show="reporter" />
                </Section>
                <Section title="Reports filed by this account">
                  <ReportMini items={d.reportsBy} empty="They haven't reported anything." show="author" />
                </Section>
                <Section title="Moderation history"><AuditList items={d.history} empty="No staff actions on this account yet." /></Section>
                {d.recentShouts.length > 0 && <Section title="Recent wall posts" more={`/admin/content?kind=shouts&user=${encodeURIComponent(u.username)}`} moreLabel="All their posts">
                  <ul className="adm-list">{d.recentShouts.map(s => (
                    <li key={s.id}><p>{s.body}</p><span className="muted small">{s.where ? <Link to={s.where.link}>{s.where.label}</Link> : "a page"} · {ago(s.createdAt)}</span></li>
                  ))}</ul>
                </Section>}
              </div>
              <aside className="side">
                <Section title="Account">
                  <dl className="adm-facts">
                    {u.email !== undefined && <><dt>Email</dt><dd>{u.email}</dd></>}
                    <dt>Joined</dt><dd>{dateTime(u.registeredAt)}</dd>
                    <dt>Last login</dt><dd>{d.lastLogin ? dateTime(d.lastLogin) : "No active session"}</dd>
                    <dt>Sessions</dt><dd>{num(d.counts.sessions)} web, {num(d.counts.apiSessions)} app</dd>
                    {u.website && <><dt>Website</dt><dd className="adm-break">{u.website}</dd></>}
                    <dt>Social</dt><dd>{num(d.counts.followers)} followers, {num(d.counts.following)} following{d.counts.blockedBy ? `, blocked by ${num(d.counts.blockedBy)}` : ""}</dd>
                    <dt>Library</dt><dd>{num(d.counts.loved)} loved, {num(d.counts.playlists)} playlists, {num(d.counts.tags)} tags</dd>
                  </dl>
                </Section>
                <Section title="Direct messages">
                  {d.dm.muted && <p className="notice small">Messaging is turned off. They can read their conversations but can't send.</p>}
                  <dl className="adm-facts">
                    <dt>Conversations</dt><dd>{num(d.dm.threads)}{role === "admin" && d.dm.threads > 0 && <> · <Link to={`/admin/messages${qs({ user: u.username })}`}>View</Link></>}</dd>
                    <dt>Started</dt><dd>{num(d.dm.startedDay)} in the last day, {num(d.dm.startedWeek)} in the last week</dd>
                    <dt>Sent</dt><dd>{plural(d.dm.sent, "message")}, {num(d.dm.sentWeek)} in the last week</dd>
                    <dt>Spam flags</dt><dd>{d.dm.openFlags ? <Link to="/admin/messages?tab=flags"><b className="adm-red">{num(d.dm.openFlags)} open</b></Link> : "None open"}</dd>
                    <dt>Reported</dt><dd>{d.dm.openReports ? <Link to="/admin/reports?type=dm"><b className="adm-red">{plural(d.dm.openReports, "message")}</b></Link> : "No open reports"}</dd>
                    <dt>Accepts</dt><dd>{POLICY[d.dm.policy] ?? d.dm.policy}</dd>
                  </dl>
                  {!staffTarget && !locked && <div className="adm-actions adm-dm-act">{d.dm.muted
                    ? <Button kind="btn ghost" type="button" onClick={() => ask({ title: "Turn messaging back on", action: "Allow messaging", body: <p>{u.username} will be able to send direct messages again, within the usual limits.</p>, run: note => post("dm-mute", { muted: false, note }) })}>Allow messaging again</Button>
                    : <Button kind="btn ghost" type="button" onClick={() => ask({ title: "Turn off messaging", action: "Turn off", danger: true, body: <p>{u.username} won't be able to send direct messages. They can still read their conversations and use the rest of the site.</p>, run: note => post("dm-mute", { muted: true, note }) })}>Turn off messaging</Button>}
                  </div>}
                </Section>
                <Section title="Actions">
                  {why && <p className="muted small">{why}</p>}
                  <div className="adm-actions">
                    {(!staffTarget || role === "admin") && !u.banned && !u.self && (u.suspended
                      ? <Button kind="btn ghost" type="button" onClick={() => ask({ title: "Lift suspension", action: "Lift suspension", body: <p>{u.username} will be able to post on walls, journals and wiki edits again.</p>, run: note => post("suspend", { suspended: false, note }) })}>Lift suspension</Button>
                      : <Button kind="btn ghost" type="button" disabled={staffTarget || locked} onClick={() => ask({ title: "Suspend from posting", action: "Suspend", danger: true, body: <p>{u.username} can keep listening and scrobbling but can't post on walls, journals or wiki edits.</p>, run: note => post("suspend", { suspended: true, note }) })}>Suspend from posting</Button>)}
                    {role === "admin" && <>
                      {u.banned
                        ? <Button kind="btn ghost" type="button" onClick={() => ask({ title: "Lift ban", action: "Unban", body: <p>{u.username} will be able to log in again and their profile becomes visible.</p>, run: note => post("ban", { banned: false, note }) })}>Lift ban</Button>
                        : <Button kind="btn danger" type="button" disabled={staffTarget || locked} onClick={() => ask({ title: `Ban ${u.username}`, action: "Ban account", danger: true, note: "Reason (kept with the ban)",
                            body: <p>They are signed out everywhere, can't log in, and their profile is hidden from everyone but staff. Their scrobbles and posts are kept.</p>, run: note => post("ban", { banned: true, note }) })}>Ban account</Button>}
                      <Button kind="btn ghost" type="button" disabled={u.self || !(d.counts.sessions + d.counts.apiSessions)} onClick={() => ask({ title: "Sign out everywhere", action: "Revoke sessions",
                        body: <p>End {u.username}'s {plural(d.counts.sessions, "web session")} and {plural(d.counts.apiSessions, "app session")}. They can log in again.</p>, run: note => post("sessions", { note }).then(() => {}) })}>Revoke sessions</Button>
                      {!u.banned && !locked && <RolePicker current={u.role} onPick={r => ask({ title: `Make ${u.username} ${r === "user" ? "a regular user" : `a${r === "admin" ? "n" : ""} ${r}`}`, action: "Change role", danger: r === "admin",
                        body: <p>{r === "admin" ? "Admins can manage accounts, roles, the catalogue and site settings." : r === "moderator" ? "Moderators handle reports, content and posting suspensions." : "They lose access to the admin area."}</p>,
                        run: note => post("role", { role: r, note }) })} />}
                      <Button kind="btn danger" type="button" disabled={staffTarget || locked} onClick={() => ask({ title: `Delete ${u.username}`, action: "Delete account", danger: true, typed: u.username,
                        body: <p>Permanently deletes the account with its {plural(d.counts.scrobbles, "scrobble")}, {plural(d.counts.shouts, "wall post")}, {plural(d.counts.journals, "journal post")}, loved tracks, playlists and tags. Open reports about them are closed. This can't be undone.</p>,
                        run: note => api<Ok>(`/admin/users/${encodeURIComponent(u.username)}/delete`, { body: { confirm: u.username, note } }).then(() => setDeleted(true)) })}>Delete account</Button>
                    </>}
                    {staffTarget && !locked && role === "admin" && <p className="muted small">Staff can't be suspended, banned or deleted. Change their role to user first.</p>}
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
function RolePicker({ current, onPick }: { current: Role; onPick: (r: Role) => void }) {
  return (
    <div className="adm-roles" role="group" aria-label="Role">
      {ROLES.map(r => (
        <button key={r} type="button" className={r === current ? "on" : ""} aria-pressed={r === current} onClick={() => r !== current && onPick(r)}>{ROLE[r]}</button>
      ))}
    </div>
  );
}
function ReportMini({ items, empty, show }: { items: ReportBrief[]; empty: string; show: "reporter" | "author" }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="adm-list compact">{items.map(r => (
      <li key={r.id}>
        <span><span className="badge">{REASON[r.reason] || r.reason}</span> <span className="adm-type">{TYPE[r.type]}</span> {r.where}</span>
        <span className="muted small">{show === "reporter" ? (r.reporter ? <>by <Link to={adminUrl(r.reporter)}>{r.reporter}</Link> · </> : null) : (r.author ? <>against <Link to={adminUrl(r.author)}>{r.author}</Link> · </> : null)}{ago(r.createdAt)} · {r.status === "open" ? <Link to="/admin/reports"><b className="adm-red">open</b></Link> : `${r.outcome}${r.resolver ? ` by ${r.resolver}` : ""}`}</span>
      </li>
    ))}</ul>
  );
}
