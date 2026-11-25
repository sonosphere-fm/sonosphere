import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import type { MeResponse } from "../../shared/auth";
import { Ico } from "../icons";
import { Button, SearchField, Select, Textarea } from "../kit";
import { ago, api, date, dateTime, num, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Avatar, Empty, Pager, Section, Stat } from "../ui/base";
import {
  type AdminKey,
  type Role,
  adminUrl,
  outcomeLabel,
  reasonLabel,
  roleLabel,
  typeLabel,
  useQuery,
  useRole,
  useConfirm,
  useFlash,
  StatusBadges,
} from "./common";
import { COMPACT_LIST, FACTS, LIST, RED, SCROLL, SEARCH, TABLE, TILES } from "./common";
import { TOOLBAR, TYPE_LABEL } from "./common";
import { USER_HEAD, USER_HEAD_SUB, USER_HEAD_TITLE, WHO, cx, sortButton } from "./common";
import { AuditList } from "./audit";
import { t, tx } from "./i18n";
import { ManageUserLabels } from "./user-labels";
import type {
  BanResult,
  DmMuteResult,
  NoteAdded,
  Ok,
  ProbationResult,
  ReportBrief,
  RoleResult,
  SessionsResult,
  StaffTrust,
  StaffUserList,
  StaffUserPage,
  StaffUserSeen,
  SuspendResult,
} from "../../shared/admin";

type AccountReply =
  | NoteAdded
  | DmMuteResult
  | SuspendResult
  | BanResult
  | SessionsResult
  | RoleResult
  | ProbationResult;
const ROLES: Role[] = ["user", "moderator", "admin"];

const USER_FILTERS = [
  ["all", "admin.filterEveryone"],
  ["reported", "admin.filterReported"],
  ["suspended", "admin.suspended"],
  ["banned", "admin.banned"],
  ["unconfirmed", "admin.filterUnconfirmed"],
  ["probation", "admin.filterProbation"],
  ["staff", "admin.filterStaff"],
  ["admins", "admin.filterAdmins"],
  ["moderators", "admin.filterModerators"],
] as const;
const POLICY: Record<string, AdminKey> = {
  everyone: "admin.policyEveryone",
  requests: "admin.policyRequests",
  following: "admin.policyFollowing",
  nobody: "admin.policyNobody",
};
const ROLE_BLURB: Record<Role, AdminKey> = {
  admin: "admin.roleBlurbAdmin",
  moderator: "admin.roleBlurbModerator",
  user: "admin.roleBlurbUser",
};
const MAKE_ROLE: Record<Role, AdminKey> = {
  admin: "admin.makeAdmin",
  moderator: "admin.makeModerator",
  user: "admin.makeUser",
};

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
  const q = useApi<StaffUserList>(
    `/admin/users${qs({ q: term, filter: filter === "all" ? "" : filter, sort, dir, page })}`
  );
  useTitle(t("admin.navUsers"));
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
          {label}
          {on && (dir === "asc" ? <Ico.SortUp /> : <Ico.SortDown />)}
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
            placeholder={role === "admin" ? t("admin.searchUsersAdmin") : t("admin.searchUsersModerator")}
            label={t("admin.searchUsers")}
            clearable
          />
        </form>
        <Select
          label={t("admin.show")}
          value={filter}
          onChange={(v) => set({ filter: v === "all" ? "" : v })}
          options={USER_FILTERS.map(([k, l]): [string, string] => [k, t(l)])}
        />
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">
              {term
                ? t("admin.accountsMatching", { count: d.total, term })
                : t("admin.accountCount", { count: d.total })}
            </p>
            {d.items.length === 0 ? (
              <Empty>{t("admin.noAccountsMatch")}</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      {th("username", t("admin.account"))}
                      <th>{t("admin.status")}</th>
                      {th("scrobbles", t("admin.colScrobbles"), "num")}
                      {th("reports", t("admin.openReportsLabel"), "num")}
                      {th("registered", t("admin.joined"))}
                      {th("login", t("admin.lastLogin"))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className={WHO}>
                            <Avatar user={u} size={28} />
                            <span>
                              <Link className="strong" to={adminUrl(u.username)}>
                                <Username user={u} />
                              </Link>
                              {(u.realname || u.email) && (
                                <span className="muted small">
                                  {" "}
                                  {[u.realname, u.email].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          <StatusBadges u={u} />
                        </td>
                        <td className="num">{num(u.scrobbles)}</td>
                        <td className="num">
                          {u.openReports ? <b className={RED}>{u.openReports}</b> : <span className="muted">0</span>}
                        </td>
                        <td className="nowrap" title={dateTime(u.registeredAt)}>
                          {date(u.registeredAt)}
                        </td>
                        <td className="nowrap muted">{u.lastLogin ? ago(u.lastLogin) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
    </>
  );
}

const NOTE_FORM = "flex gap-[10px] items-start mb-2 max-[860px]:flex-col max-[860px]:items-stretch";
const STAFF_NOTE = cx("py-[10px] px-3 mb-2 bg-[light-dark(#fffbea,#2a2718)]", "border-s-[3px] border-s-site-sun");
const ACTIONS = "flex flex-col items-stretch gap-2 *:w-full";

export function UserDetail() {
  const name = useParams().name!;
  const role = useRole();
  const { refresh, setMe } = useAuth();
  const navigate = useNavigate();
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
      <p className="small">
        <Link to="/admin/users">
          <Ico.Left /> {t("admin.allUsers")}
        </Link>
      </p>
      <Async q={q}>
        {(d) => {
          const u = d.user;
          const staffTarget = u.role !== "user";
          const impersonate = () =>
            ask({
              title: t("admin.actAsName", { name: u.username }),
              action: t("admin.actAsUser"),
              body: <p>{tx("admin.actAsBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) =>
                api<MeResponse>(`/admin/users/${encodeURIComponent(u.username)}/impersonate`, { body: { note } }).then(
                  (r) => {
                    setMe(r.user);
                    navigate(userUrl(u.username));
                  }
                ),
            });
          const locked = u.self || u.configAdmin;
          const post = (path: string, body: Record<string, unknown>) =>
            api<AccountReply>(`/admin/users/${encodeURIComponent(u.username)}/${path}`, { body }).then(() => {
              q.reload();
              refresh();
            });
          let why = "";
          if (u.self) why = t("admin.yourAccount");
          else if (u.configAdmin) why = t("admin.configAdmin");
          let confirmed = t("admin.notYet");
          if (u.emailVerifiedAt) confirmed = dateTime(u.emailVerifiedAt);
          else if (u.placeholder) confirmed = t("admin.placeholderAddress");
          const canSuspend = (!staffTarget || role === "admin") && !u.banned && !u.self;

          const addNote = (e: FormEvent) => {
            e.preventDefault();
            flash.run(async () => {
              await post("notes", { body: noteText });
              setNoteText("");
            });
          };
          const deleteNote = (id: number) =>
            ask({
              title: t("admin.deleteNote"),
              action: t("admin.delete"),
              danger: true,
              note: false,
              body: <p>{t("admin.deleteNoteBody")}</p>,
              run: () => api<Ok>(`/admin/notes/${id}`, { method: "DELETE" }).then(() => q.reload()),
            });
          const allowMessaging = () =>
            ask({
              title: t("admin.turnMessagingBackOn"),
              action: t("admin.allowMessaging"),
              body: <p>{tx("admin.allowMessagingBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("dm-mute", { muted: false, note }),
            });
          const muteMessaging = () =>
            ask({
              title: t("admin.turnOffMessaging"),
              action: t("admin.turnOff"),
              danger: true,
              body: <p>{tx("admin.muteMessagingBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("dm-mute", { muted: true, note }),
            });
          const liftSuspension = () =>
            ask({
              title: t("admin.liftSuspension"),
              action: t("admin.liftSuspension"),
              body: <p>{tx("admin.liftSuspensionBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("suspend", { suspended: false, note }),
            });
          const suspend = () =>
            ask({
              title: t("admin.suspendTitle"),
              action: t("admin.suspend"),
              danger: true,
              body: <p>{tx("admin.suspendPostingBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("suspend", { suspended: true, note }),
            });
          const liftBan = () =>
            ask({
              title: t("admin.liftBan"),
              action: t("admin.unban"),
              body: <p>{tx("admin.liftBanBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("ban", { banned: false, note }),
            });
          const ban = () =>
            ask({
              title: t("admin.banName", { name: u.username }),
              action: t("admin.banAccount"),
              danger: true,
              note: t("admin.banReasonNote"),
              body: <p>{t("admin.banBody")}</p>,
              run: (note) => post("ban", { banned: true, note }),
            });
          const verify = () =>
            ask({
              title: t("admin.markEmailConfirmedTitle"),
              action: t("admin.confirmEmail"),
              body: <p>{tx("admin.verifyBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("verify", { note }),
            });
          const endProbation = () =>
            ask({
              title: t("admin.endProbation"),
              action: t("admin.endProbation"),
              body: <p>{tx("admin.endProbationBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("probation", { probation: false, note }),
            });
          const holdProbation = () =>
            ask({
              title: t("admin.putOnProbation"),
              action: t("admin.putOnProbation"),
              body: <p>{tx("admin.holdProbationBody", { name: <Username name={u.username} /> })}</p>,
              run: (note) => post("probation", { probation: true, note }),
            });
          const revokeSessions = () =>
            ask({
              title: t("admin.signOutEverywhere"),
              action: t("admin.revokeSessions"),
              body: (
                <p>
                  {tx("admin.revokeSessionsBody", {
                    name: <Username name={u.username} />,
                    web: t("admin.webSessionCount", { count: d.counts.sessions }),
                    app: t("admin.appSessionCount", { count: d.counts.apiSessions }),
                  })}
                </p>
              ),
              run: (note) => post("sessions", { note }).then(() => {}),
            });
          const changeRole = (r: Role) =>
            ask({
              title: t(MAKE_ROLE[r], { name: u.username }),
              action: t("admin.changeRole"),
              danger: r === "admin",
              body: <p>{t(ROLE_BLURB[r])}</p>,
              run: (note) => post("role", { role: r, note }),
            });
          const deleteAccount = () =>
            ask({
              title: t("admin.deleteName", { name: u.username }),
              action: t("admin.deleteAccount"),
              danger: true,
              typed: u.username,
              body: (
                <p>
                  {t("admin.deleteAccountBody", {
                    scrobbles: t("admin.scrobbleCount", { count: d.counts.scrobbles }),
                    shouts: t("admin.wallPostCount", { count: d.counts.shouts }),
                    journals: t("admin.journalPostCount", { count: d.counts.journals }),
                  })}
                </p>
              ),
              run: (note) =>
                api<Ok>(`/admin/users/${encodeURIComponent(u.username)}/delete`, {
                  body: { confirm: u.username, note },
                }).then(() => setDeleted(true)),
            });

          return (
            <>
              <div className={USER_HEAD}>
                <Avatar user={u} size={64} />
                <div className="grow">
                  <h2 className={USER_HEAD_TITLE}>
                    <Username name={u.username} /> <StatusBadges u={{ ...u, probation: d.trust.probation }} />
                  </h2>
                  <p className={`muted ${USER_HEAD_SUB}`}>
                    {[u.realname, u.country].filter(Boolean).join(" · ") || t("admin.noNameOrCountry")}
                  </p>
                </div>
                {!u.banned && (
                  <Button kind="btn ghost small" href={userUrl(u.username)}>
                    {t("admin.viewProfile")} <Ico.Right />
                  </Button>
                )}
                {role === "admin" && !staffTarget && !locked && !u.banned && (
                  <Button kind="btn ghost small" type="button" onClick={impersonate}>
                    {t("admin.actAsUser")}
                  </Button>
                )}
              </div>
              {u.banned && (
                <p className="notice">
                  {u.banReason
                    ? t("admin.bannedNoticeReason", { ago: u.bannedAt ? ago(u.bannedAt) : "", reason: u.banReason })
                    : t("admin.bannedNotice", { ago: u.bannedAt ? ago(u.bannedAt) : "" })}
                </p>
              )}
              {u.suspended && !u.banned && <p className="notice">{t("admin.suspendedNotice")}</p>}
              <div className={TILES}>
                <Stat
                  label={t("admin.colScrobbles")}
                  value={num(d.counts.scrobbles)}
                  hint={d.lastScrobble ? t("admin.lastAgo", { ago: ago(d.lastScrobble) }) : t("admin.noneYet")}
                />
                <Stat label={t("admin.wallPosts")} value={num(d.counts.shouts)} />
                <Stat label={t("admin.journalPosts")} value={num(d.counts.journals)} />
                <Stat label={t("admin.wikiEdits")} value={num(d.counts.wikiEdits)} />
                <Stat
                  label={t("admin.reportsAgainst")}
                  value={num(d.reportsAgainst.filter((r) => r.status === "open").length)}
                  hint={t("admin.inTotal", { total: d.reportsAgainst.length })}
                />
              </div>
              <div className="cols">
                <div className="main">
                  {role === "admin" && <ManageUserLabels name={u.username} />}
                  {role === "admin" && <ManageUsernames key={u.username} name={u.username} onChange={q.reload} />}
                  <Section title={t("admin.internalNotes")}>
                    <p className="muted small">{t("admin.onlyStaffSee")}</p>
                    <form className={NOTE_FORM} onSubmit={addNote}>
                      <Textarea
                        rows={2}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder={t("admin.addNotePlaceholder")}
                        maxLength={2000}
                      />
                      <Button kind="btn small" disabled={!noteText.trim()}>
                        {t("admin.addNote")}
                      </Button>
                    </form>
                    {flash.note}
                    {d.notes.length > 0 && (
                      <ul className="list-none m-[10px_0_0] p-0">
                        {d.notes.map((n) => (
                          <li key={n.id} className={STAFF_NOTE}>
                            <p className="m-[0_0_4px] whitespace-pre-wrap wrap-anywhere">{n.body}</p>
                            <span className="muted small">
                              {n.author || t("admin.deletedStaff")} · {ago(n.createdAt)} ·{" "}
                              <Button kind="link small" type="button" onClick={() => deleteNote(n.id)}>
                                {t("admin.delete")}
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                  <Section title={t("admin.reportsAgainstAccount")}>
                    <ReportMini items={d.reportsAgainst} empty={t("admin.noReportsAgainst")} show="reporter" />
                  </Section>
                  <Section title={t("admin.reportsByAccount")}>
                    <ReportMini items={d.reportsBy} empty={t("admin.noReportsBy")} show="author" />
                  </Section>
                  <Section title={t("admin.moderationHistory")}>
                    <AuditList items={d.history} empty={t("admin.noAccountActions")} />
                  </Section>
                  {role === "admin" && <CosmeticsAdmin key={u.username} name={u.username} />}
                  {d.recentShouts.length > 0 && (
                    <Section
                      title={t("admin.recentWallPosts")}
                      more={`/admin/content?kind=shouts&user=${encodeURIComponent(u.username)}`}
                      moreLabel={t("admin.allTheirPosts")}
                    >
                      <ul className={LIST}>
                        {d.recentShouts.map((s) => (
                          <li key={s.id}>
                            <p>{s.body}</p>
                            <span className="muted small">
                              {s.where ? <Link to={s.where.link}>{s.where.label}</Link> : t("admin.aPage")} ·{" "}
                              {ago(s.createdAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
                <aside className="side">
                  <Section title={t("admin.account")}>
                    <dl className={FACTS}>
                      {u.email !== undefined && (
                        <>
                          <dt>{t("admin.email")}</dt>
                          <dd className="wrap-anywhere">{u.email}</dd>
                        </>
                      )}
                      <dt>{t("admin.confirmed")}</dt>
                      <dd>{confirmed}</dd>
                      <dt>{t("admin.joined")}</dt>
                      <dd>{dateTime(u.registeredAt)}</dd>
                      <dt>{t("admin.lastLogin")}</dt>
                      <dd>{d.lastLogin ? dateTime(d.lastLogin) : t("admin.noActiveSession")}</dd>
                      {d.seen !== undefined && (
                        <>
                          <dt>{t("admin.seenFrom")}</dt>
                          <dd>{d.seen ? `${seenPlace(d.seen)} · ${ago(d.seen.at)}` : t("admin.notYet")}</dd>
                        </>
                      )}
                      <dt>{t("admin.sessions")}</dt>
                      <dd>
                        {t("admin.sessionsValue", { web: num(d.counts.sessions), app: num(d.counts.apiSessions) })}
                      </dd>
                      <dt>{t("admin.social")}</dt>
                      <dd>
                        {d.counts.blockedBy
                          ? t("admin.socialValueBlocked", {
                              followers: num(d.counts.followers),
                              following: num(d.counts.following),
                              blocked: num(d.counts.blockedBy),
                            })
                          : t("admin.socialValue", {
                              followers: num(d.counts.followers),
                              following: num(d.counts.following),
                            })}
                      </dd>
                      <dt>{t("admin.library")}</dt>
                      <dd>
                        {t("admin.libraryValue", {
                          loved: num(d.counts.loved),
                          playlists: num(d.counts.playlists),
                          tags: num(d.counts.tags),
                        })}
                      </dd>
                    </dl>
                  </Section>
                  <Section title={t("admin.probation")}>
                    <Probation trust={d.trust} />
                    {!d.trust.staff && !u.banned && (
                      <div className={`${ACTIONS} adm-dm-act`}>
                        {d.trust.probation ? (
                          <Button kind="btn ghost" type="button" onClick={endProbation}>
                            {t("admin.endProbation")}
                          </Button>
                        ) : (
                          <Button kind="btn ghost" type="button" onClick={holdProbation}>
                            {t("admin.putOnProbation")}
                          </Button>
                        )}
                      </div>
                    )}
                  </Section>
                  <Section title={t("admin.directMessages")}>
                    {d.dm.muted && <p className="notice small">{t("admin.messagingTurnedOff")}</p>}
                    <dl className={FACTS}>
                      <dt>{t("admin.conversations")}</dt>
                      <dd>
                        {num(d.dm.threads)}
                        {role === "admin" && d.dm.threads > 0 && (
                          <>
                            {" "}
                            · <Link to={`/admin/messages${qs({ user: u.username })}`}>{t("admin.viewCap")}</Link>
                          </>
                        )}
                      </dd>
                      <dt>{t("admin.started")}</dt>
                      <dd>{t("admin.startedValue", { day: num(d.dm.startedDay), week: num(d.dm.startedWeek) })}</dd>
                      <dt>{t("admin.sent")}</dt>
                      <dd>
                        {t("admin.sentValue", {
                          messages: t("admin.messageCount", { count: d.dm.sent }),
                          week: num(d.dm.sentWeek),
                        })}
                      </dd>
                      <dt>{t("admin.spamFlags")}</dt>
                      <dd>
                        {d.dm.openFlags ? (
                          <Link to="/admin/messages?tab=flags">
                            <b className={RED}>{t("admin.countOpen", { count: d.dm.openFlags })}</b>
                          </Link>
                        ) : (
                          t("admin.noneOpen")
                        )}
                      </dd>
                      <dt>{t("admin.reported")}</dt>
                      <dd>
                        {d.dm.openReports ? (
                          <Link to="/admin/reports?type=dm">
                            <b className={RED}>{t("admin.messageCount", { count: d.dm.openReports })}</b>
                          </Link>
                        ) : (
                          t("admin.noOpenReports")
                        )}
                      </dd>
                      <dt>{t("admin.accepts")}</dt>
                      <dd>{POLICY[d.dm.policy] ? t(POLICY[d.dm.policy]) : d.dm.policy}</dd>
                    </dl>
                    {!staffTarget && !locked && (
                      <div className={`${ACTIONS} adm-dm-act`}>
                        {d.dm.muted ? (
                          <Button kind="btn ghost" type="button" onClick={allowMessaging}>
                            {t("admin.allowMessagingAgain")}
                          </Button>
                        ) : (
                          <Button kind="btn ghost" type="button" onClick={muteMessaging}>
                            {t("admin.turnOffMessaging")}
                          </Button>
                        )}
                      </div>
                    )}
                  </Section>
                  <Section title={t("admin.actions")}>
                    {why && <p className="muted small">{why}</p>}
                    <div className={ACTIONS}>
                      {canSuspend &&
                        (u.suspended ? (
                          <Button kind="btn ghost" type="button" onClick={liftSuspension}>
                            {t("admin.liftSuspension")}
                          </Button>
                        ) : (
                          <Button kind="btn ghost" type="button" disabled={staffTarget || locked} onClick={suspend}>
                            {t("admin.suspendTitle")}
                          </Button>
                        ))}
                      {role === "admin" && (
                        <>
                          {u.banned ? (
                            <Button kind="btn ghost" type="button" onClick={liftBan}>
                              {t("admin.liftBan")}
                            </Button>
                          ) : (
                            <Button kind="btn danger" type="button" disabled={staffTarget || locked} onClick={ban}>
                              {t("admin.banAccount")}
                            </Button>
                          )}
                          {u.unconfirmed && (
                            <Button kind="btn ghost" type="button" onClick={verify}>
                              {t("admin.markEmailConfirmed")}
                            </Button>
                          )}
                          <Button
                            kind="btn ghost"
                            type="button"
                            disabled={u.self || !(d.counts.sessions + d.counts.apiSessions)}
                            onClick={revokeSessions}
                          >
                            {t("admin.revokeSessions")}
                          </Button>
                          {!u.banned && !locked && <RolePicker current={u.role} onPick={changeRole} />}
                          <Button
                            kind="btn danger"
                            type="button"
                            disabled={staffTarget || locked}
                            onClick={deleteAccount}
                          >
                            {t("admin.deleteAccount")}
                          </Button>
                        </>
                      )}
                      {staffTarget && !locked && role === "admin" && (
                        <p className="muted small">{t("admin.staffProtected")}</p>
                      )}
                    </div>
                  </Section>
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}

function Probation({ trust }: { trust: StaffTrust }) {
  if (trust.staff) return <p className="muted small">{t("admin.staffNeverProbation")}</p>;
  let state = t("admin.joinedBeforeProbation");
  if (trust.probation) state = t("admin.probationLimits");
  else if (trust.clearedBy)
    state = t("admin.probationEndedBy", { name: trust.clearedBy, ago: ago(trust.clearedAt ?? 0) });
  else if (trust.checkedAt) state = t("admin.leftProbation", { ago: ago(trust.clearedAt ?? 0) });
  let exit = t("admin.exitWhenScored");
  if (trust.held) exit = t("admin.heldByStaff");
  else if (trust.eligibleAt * 1000 > Date.now()) exit = dateTime(trust.eligibleAt);
  return (
    <>
      <p className="muted small">{state}</p>
      <dl className={FACTS}>
        <dt>{t("admin.score")}</dt>
        <dd>{t("admin.scoreValue", { score: trust.score, needed: trust.needed })}</dd>
        {trust.probation && (
          <>
            <dt>{t("admin.earliestExit")}</dt>
            <dd>{exit}</dd>
          </>
        )}
        {trust.checkedAt && (
          <>
            <dt>{t("admin.lastChecked")}</dt>
            <dd>{ago(trust.checkedAt)}</dd>
          </>
        )}
      </dl>
      {trust.points.length > 0 && (
        <ul className="list-none m-[10px_0_0] p-0 text-[14px]">
          {trust.points.map((p) => (
            <li key={p.label} className="flex justify-between gap-3 py-[3px]">
              <span>{p.label}</span>
              {p.points > 0 ? <b>+{p.points}</b> : <b className={RED}>{p.points}</b>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const ROLE_BUTTON = cx(
  "flex-1 py-[7px] px-1.5 [border:0] not-last:[border-right:1px_solid_var(--line)]",
  "font-semibold text-[13px]"
);
const ROLE_ON = "bg-site-ink text-site-bg cursor-default";
const ROLE_OFF = "bg-site-card text-site-ink-2 cursor-pointer hover:bg-site-panel hover:text-site-ink";
const roleButton = (on: boolean) => `${ROLE_BUTTON} ${on ? ROLE_ON : ROLE_OFF}`;

function RolePicker({ current, onPick }: { current: Role; onPick: (r: Role) => void }) {
  return (
    <div
      className="flex border border-site-line rounded-[4px] overflow-hidden"
      role="group"
      aria-label={t("admin.role")}
    >
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          className={roleButton(r === current)}
          aria-pressed={r === current}
          onClick={() => r !== current && onPick(r)}
        >
          {roleLabel(r)}
        </button>
      ))}
    </div>
  );
}

function ReportMini({ items, empty, show }: { items: ReportBrief[]; empty: string; show: "reporter" | "author" }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className={COMPACT_LIST}>
      {items.map((r) => {
        let who = null;
        if (show === "reporter" && r.reporter)
          who = (
            <>
              {tx("admin.byName", {
                name: (
                  <Link to={adminUrl(r.reporter)}>
                    <Username name={r.reporter} />
                  </Link>
                ),
              })}{" "}
              ·{" "}
            </>
          );
        if (show === "author" && r.author)
          who = (
            <>
              {tx("admin.againstName", {
                name: (
                  <Link to={adminUrl(r.author)}>
                    <Username name={r.author} />
                  </Link>
                ),
              })}{" "}
              ·{" "}
            </>
          );
        const state =
          r.status === "open" ? (
            <Link to="/admin/reports">
              <b className={RED}>{t("admin.openLower")}</b>
            </Link>
          ) : r.resolver ? (
            t("admin.outcomeBy", { outcome: outcomeLabel(r.outcome), name: r.resolver })
          ) : (
            outcomeLabel(r.outcome)
          );
        return (
          <li key={r.id}>
            <span>
              <span className="badge">{reasonLabel(r.reason)}</span>{" "}
              <span className={TYPE_LABEL}>{typeLabel(r.type)}</span> {r.where}
            </span>
            <span className="muted small">
              {who}
              {ago(r.createdAt)} · {state}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
import { ManageUsernames } from "./usernames";
import { countryNameOf } from "../../shared/countries";

// Cloudflare reports Tor exits as T1
function seenPlace(s: StaffUserSeen) {
  const country = s.country === "T1" ? t("admin.torNetwork") : countryNameOf(s.country) || s.country;
  return s.region ? `${s.region}, ${country}` : country;
}
import { CosmeticsAdmin } from "./cosmetics";
import { Username } from "../ui/username";
