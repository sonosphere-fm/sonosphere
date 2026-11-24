import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Arrow, arrowed } from "../icons";
import { Link } from "react-router-dom";
import { Button, Input, Select } from "../kit";
import { ago, api, dateTime, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import {
  FILTERBAR,
  LINKISH,
  LOG_TABLE,
  NOTE,
  SCROLL,
  flagLabel,
  reasonLabel,
  roleLabel,
  type AdminKey,
} from "./common";
import { act, actButton, adminUrl, useConfirm, useFlash, useQuery, useRole } from "./common";
import { t, tx } from "./i18n";
import type { AuditRow } from "../../shared/admin";
import type { AuditList as AuditPage, Ok } from "../../shared/admin-content";

const ACTION: Record<string, AdminKey> = {
  "user.suspend": "admin.actionUserSuspend",
  "user.unsuspend": "admin.actionUserUnsuspend",
  "user.ban": "admin.actionUserBan",
  "user.unban": "admin.actionUserUnban",
  "user.role": "admin.actionUserRole",
  "user.sessions": "admin.actionUserSessions",
  "user.verify": "admin.actionUserVerify",
  "user.probation": "admin.actionUserProbation",
  "user.release": "admin.actionUserRelease",
  "user.delete": "admin.actionUserDelete",
  "user.impersonate": "admin.actionUserImpersonate",
  "user.impersonate.stop": "admin.actionUserImpersonateStop",
  "user.impersonate.request": "admin.actionUserImpersonateRequest",
  "user.clear-scrobbles": "admin.actionUserClearScrobbles",
  "note.add": "admin.actionNoteAdd",
  "note.delete": "admin.actionNoteDelete",
  "report.dismiss": "admin.actionReportDismiss",
  "report.remove": "admin.actionReportRemove",
  "report.suspend": "admin.actionReportSuspend",
  "report.mute": "admin.actionReportMute",
  "shout.delete": "admin.actionShoutDelete",
  "journal.delete": "admin.actionJournalDelete",
  "wiki.delete": "admin.actionWikiDelete",
  "wiki.revert": "admin.actionWikiRevert",
  "wiki.lock": "admin.actionWikiLock",
  "wiki.unlock": "admin.actionWikiUnlock",
  "catalogue.merge": "admin.actionCatalogueMerge",
  "catalogue.rename": "admin.actionCatalogueRename",
  "catalogue.tracklist": "admin.actionCatalogueTracklist",
  "catalogue.edit": "admin.actionCatalogueEdit",
  "catalogue.orphans": "admin.actionCatalogueOrphans",
  "tag.delete": "admin.actionTagDelete",
  "changelog.create": "admin.actionChangelogCreate",
  "changelog.update": "admin.actionChangelogUpdate",
  "changelog.delete": "admin.actionChangelogDelete",
  "settings.update": "admin.actionSettingsUpdate",
  "dm.read": "admin.actionDmRead",
  "dm.delete": "admin.actionDmDelete",
  "dm.mute": "admin.actionDmMute",
  "dm.unmute": "admin.actionDmUnmute",
  "dm.resolve": "admin.actionDmResolve",
};
const actionLabel = (a: string) => (ACTION[a] ? t(ACTION[a]) : a);
const actionGroup = (a: string) => a.split(".")[0];
const count = (v: unknown) => (typeof v === "number" ? v : 0);
function change(v: unknown) {
  if (typeof v === "object" && v !== null && "from" in v && "to" in v) return v;
  return { from: undefined, to: undefined };
}
function settingsChanges(d: Record<string, unknown>) {
  return Object.entries(d).map(([k, v], i) => {
    const c = change(v);
    return (
      <Fragment key={k}>
        {i > 0 && "; "}
        {k}: {JSON.stringify(c.from)}
        <Arrow />
        {JSON.stringify(c.to)}
      </Fragment>
    );
  });
}
const FIELD: Record<string, AdminKey> = {
  releaseDate: "admin.fieldReleaseDate",
  releaseType: "admin.fieldReleaseType",
  mbid: "admin.fieldMbid",
  spotifyId: "admin.fieldSpotifyId",
  duration: "admin.fieldDuration",
};
const shown = (v: unknown) => (v === null || v === "" ? t("admin.none") : String(v));
function fieldChanges(fields: unknown) {
  return Object.entries(fields as Record<string, unknown>).map(([k, v], i) => {
    const c = change(v);
    return (
      <Fragment key={k}>
        {i > 0 && "; "}
        {FIELD[k] ? t(FIELD[k]) : k}: {shown(c.from)}
        <Arrow />
        {shown(c.to)}
      </Fragment>
    );
  });
}
function reportDetails(d: Record<string, unknown>) {
  const report = String(d.report);
  const reason = d.reason ? reasonLabel(d.reason) : "";
  const closed = count(d.closed);
  if (closed > 1 && reason) return t("admin.auditReportReasonClosed", { report, reason, closed });
  if (closed > 1) return t("admin.auditReportClosed", { report, closed });
  if (reason) return t("admin.auditReportReason", { report, reason });
  return t("admin.auditReport", { report });
}
function details(a: AuditRow): ReactNode {
  const d = a.data || {};
  if (a.action === "user.role")
    return (
      <>
        {roleLabel(d.from)}
        <Arrow />
        {roleLabel(d.to)}
      </>
    );
  if (a.action === "settings.update") return settingsChanges(d);
  if (a.action.startsWith("report.")) return reportDetails(d);
  if (a.action === "wiki.revert") return t("admin.auditBackToVersion", { version: String(d.toVersion) });
  if (a.action === "catalogue.merge" && d.merged !== undefined)
    return t("admin.auditMerged", { merged: String(d.merged), moved: String(d.moved) });
  if (a.action === "catalogue.edit")
    return d.reverts === undefined
      ? fieldChanges(d.fields)
      : tx("admin.auditUndoOf", { changes: fieldChanges(d.fields) });
  if (d.reverts !== undefined) return t("admin.auditUndoEarlier");
  if (a.action === "user.sessions") return t("admin.auditSessions", { count: count(d.revoked) });
  if (a.action === "user.clear-scrobbles") return t("admin.auditScrobbles", { count: count(d.deleted) });
  if (a.action === "user.delete")
    return t("admin.auditDeletedAccount", {
      scrobbles: t("admin.auditScrobbles", { count: count(d.scrobbles) }),
      shouts: t("admin.auditShouts", { count: count(d.shouts) }),
    });
  if (a.action === "tag.delete") return t("admin.auditUses", { count: count(d.uses) });
  if (a.action === "dm.resolve") {
    const flag = flagLabel(d.kind);
    return d.detail ? t("admin.auditFlagDetail", { flag, detail: String(d.detail) }) : flag;
  }
  if (a.action === "dm.delete")
    return d.closedReports ? t("admin.auditClosedReports", { count: count(d.closedReports) }) : "";
  if (d.text) {
    const text = String(d.text);
    return `“${text.slice(0, 120)}${text.length > 120 ? "…" : ""}”`;
  }
  return "";
}
function auditUserLink(a: AuditRow) {
  return a.targetType === "user" && (a.subject || a.label) ? adminUrl(a.subject || a.label) : null;
}
const AUDIT_ROW = "flex gap-3 items-baseline flex-wrap py-[9px] text-[14px] border-b border-b-site-line";
export function AuditList({ items, empty }: { items: AuditRow[]; empty: string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="list-none m-0 p-0">
      {items.map((a) => {
        const extra = details(a);
        const userLink = auditUserLink(a);
        let target: ReactNode = <b>{arrowed(a.label || a.targetType)}</b>;
        if (userLink)
          target = (
            <Link className="strong" to={userLink}>
              {arrowed(a.label || a.subject)}
            </Link>
          );
        else if (a.targetType === "dm_thread")
          target = (
            <Link className="strong" to={`/admin/messages/${a.targetId}`}>
              {arrowed(a.label)}
            </Link>
          );
        return (
          <li key={a.id} className={AUDIT_ROW}>
            <span className={act(actionGroup(a.action))}>{actionLabel(a.action)}</span>
            <span className="min-w-0 flex-[1_1_240px] wrap-anywhere">
              {target}
              {a.subject && a.targetType !== "user" && (
                <>
                  {" "}
                  ·{" "}
                  <Link to={adminUrl(a.subject)}>
                    <Username name={a.subject} />
                  </Link>
                </>
              )}
              {extra && <span className="muted"> · {extra}</span>}
              {a.note && <span className={NOTE}>“{a.note}”</span>}
            </span>
            <span className="muted small nowrap" title={dateTime(a.createdAt)}>
              {a.actor} · {ago(a.createdAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Option = [string, string];

const UNDOABLE = new Set(["catalogue.rename", "catalogue.edit", "catalogue.tracklist"]);

export function Audit() {
  const [sp, set] = useQuery();
  const actor = sp.get("actor") || "";
  const action = sp.get("action") || "";
  const who = sp.get("user") || "";
  const term = sp.get("q") || "";
  const page = sp.get("page") || "";
  const automatic = sp.get("automatic") || "";
  const [user, setUser] = useState(who);
  const [text, setText] = useState(term);
  const q = useApi<AuditPage>(`/admin/audit${qs({ actor, action, user: who, q: term, automatic, page })}`);
  const admin = useRole() === "admin";
  const [modal, ask] = useConfirm();
  const flash = useFlash();
  useTitle(t("admin.navAudit"));
  const askUndo = (a: AuditRow) =>
    ask({
      title: t("admin.undoTitle"),
      action: t("admin.undo"),
      body: <p>{t("admin.undoBody", { item: a.label || t("admin.thisItem"), actor: a.actor })}</p>,
      run: (note) =>
        api<Ok>("/admin/catalogue/revert", { body: { id: a.id, note } }).then(() => {
          q.reload();
          flash.set({ ok: true, text: t("admin.changeUndone") });
        }),
    });
  const filter = (e: FormEvent) => {
    e.preventDefault();
    set({ user: user.trim(), q: text.trim() });
  };
  const clear = () => {
    setUser("");
    setText("");
    set({ actor: "", action: "", user: "", q: "", automatic: "" });
  };
  return (
    <Async q={q}>
      {(d) => {
        const groups = [...new Set<string>(d.actions.map(actionGroup))];
        const actorOptions: Option[] = [["", t("admin.anyStaff")], ...d.actors.map((a): Option => [a, a])];
        const actionOptions: Option[] = [["", t("admin.anyAction")]];
        for (const g of groups) {
          actionOptions.push([g, t("admin.allGroupActions", { group: g })]);
          for (const a of d.actions.filter((a) => a.startsWith(g + ".")))
            actionOptions.push([a, `  ${actionLabel(a)}`]);
        }
        return (
          <>
            {modal}
            <form className={FILTERBAR} onSubmit={filter}>
              <Select
                label={t("admin.staffMember")}
                value={actor}
                onChange={(v) => set({ actor: v })}
                options={actorOptions}
              />
              <Select
                label={t("admin.action")}
                value={action}
                onChange={(v) => set({ action: v })}
                options={actionOptions}
              />
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder={t("admin.aboutUser")}
                aria-label={t("admin.aboutUser")}
              />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("admin.searchTargetOrNote")}
                aria-label={t("admin.search")}
              />
              <Button kind="btn small">{t("admin.filter")}</Button>
              {(actor || action || who || term) && (
                <Button kind="link small" type="button" onClick={clear}>
                  {t("admin.clear")}
                </Button>
              )}
            </form>
            <p className="muted small">
              {t("admin.entries", { count: d.total })}
              {!actor && (
                <>
                  {" · "}
                  <button type="button" className={LINKISH} onClick={() => set({ automatic: automatic ? "" : "1" })}>
                    {automatic ? t("admin.hideAutomatic") : t("admin.showAutomatic")}
                  </button>
                </>
              )}
            </p>
            {flash.note}
            {d.items.length === 0 ? (
              <Empty>{t("admin.noEntriesMatch")}</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={LOG_TABLE}>
                  <thead>
                    <tr>
                      <th>{t("admin.colWhen")}</th>
                      <th>{t("admin.colStaff")}</th>
                      <th>{t("admin.action")}</th>
                      <th>{t("admin.colTarget")}</th>
                      <th>{t("admin.colDetails")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((a) => {
                      const extra = details(a);
                      const userLink = auditUserLink(a);
                      let target: ReactNode = <span className="muted">{a.targetType}</span>;
                      if (userLink) target = <Link to={userLink}>{arrowed(a.label || a.subject)}</Link>;
                      else if (a.targetType === "dm_thread")
                        target = <Link to={`/admin/messages/${a.targetId}`}>{arrowed(a.label)}</Link>;
                      else if (a.label) target = arrowed(a.label);
                      return (
                        <tr key={a.id}>
                          <td className="nowrap small" title={dateTime(a.createdAt)}>
                            {dateTime(a.createdAt)}
                          </td>
                          <td>
                            <button type="button" className={LINKISH} onClick={() => set({ actor: a.actor })}>
                              {a.actor}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={actButton(actionGroup(a.action))}
                              onClick={() => set({ action: a.action })}
                            >
                              {actionLabel(a.action)}
                            </button>
                          </td>
                          <td>
                            {target}
                            {a.subject && a.targetType !== "user" && (
                              <span className="muted small">
                                {" "}
                                ·{" "}
                                <Link to={adminUrl(a.subject)}>
                                  <Username name={a.subject} />
                                </Link>
                              </span>
                            )}
                          </td>
                          <td className="small">
                            {extra && <span className="muted">{extra}</span>}
                            {a.note && <span className={NOTE}>“{a.note}”</span>}
                            {admin && UNDOABLE.has(a.action) && (
                              <>
                                {" "}
                                <Button kind="link small" type="button" onClick={() => askUndo(a)}>
                                  {t("admin.undo")}
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pager total={d.total} limit={d.limit} />
          </>
        );
      }}
    </Async>
  );
}
import { Username } from "../ui/username";
