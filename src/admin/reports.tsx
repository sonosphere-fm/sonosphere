import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ico } from "../icons";
import { Button, Input, Select } from "../kit";
import { ago, api, dateTime, qs, useApi, useAuth, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { CHECK, NOTE, PICKED_BG, TOOLBAR, TYPE_LABEL } from "./common";
import { REASONS, TYPES, adminUrl, outcomeLabel, reasonLabel, typeLabel, useQuery, useConfirm } from "./common";
import type { AdminKey } from "./common";
import { t, tx } from "./i18n";
import type { ReportResolved, ReportsClosed, StaffReport, StaffReportList } from "../../shared/admin";

type Decision = "dismiss" | "remove" | "suspend" | "mute";
type Option = [string, string];

const THIS_TYPE: Record<string, AdminKey> = {
  shout: "admin.thisShout",
  wiki: "admin.thisWiki",
  journal: "admin.thisJournal",
  event: "admin.thisEvent",
  playlist: "admin.thisPlaylist",
  obsession: "admin.thisObsession",
  dm: "admin.thisDm",
  group: "admin.thisGroup",
};
const THIS_TYPE_BY: Record<string, AdminKey> = {
  shout: "admin.thisShoutBy",
  wiki: "admin.thisWikiBy",
  journal: "admin.thisJournalBy",
  event: "admin.thisEventBy",
  playlist: "admin.thisPlaylistBy",
  obsession: "admin.thisObsessionBy",
  dm: "admin.thisDmBy",
  group: "admin.thisGroupBy",
};
const GONE: Record<string, AdminKey> = { dm: "admin.goneDm", group: "admin.goneGroup" };
const sentences = (...parts: string[]) => parts.filter(Boolean).join(" ");

function decisionCopy(r: StaffReport, action: Decision) {
  const isUser = r.type === "user";
  const dm = r.type === "dm" || r.type === "group";
  const author = r.author ?? "";
  let what = t(THIS_TYPE[r.type]);
  if (isUser) what = t("admin.whoseProfile", { name: author });
  else if (r.author) what = t(THIS_TYPE_BY[r.type], { name: r.author });
  const gone = t(GONE[r.type] ?? "admin.goneDefault");
  const others = r.others ? t("admin.othersClosed", { count: r.others }) : "";
  switch (action) {
    case "dismiss":
      return {
        title: t("admin.dismissReport"),
        action: t("admin.dismiss"),
        body: <p>{sentences(t("admin.dismissBody", { what }), others)}</p>,
      };
    case "remove":
      return {
        title: dm ? t("admin.removeMessage") : t("admin.removeContent"),
        action: t("admin.remove"),
        danger: true,
        body: <p>{sentences(t(dm ? "admin.removeWhat" : "admin.deleteWhat", { what }), gone, others)}</p>,
      };
    case "suspend": {
      let text = t("admin.suspendFromPosting", { name: author });
      if (!isUser) text = t(dm ? "admin.removeAndSuspendDm" : "admin.deleteAndSuspend", { what, name: author });
      return {
        title: isUser ? t("admin.suspendAccount") : t("admin.removeAndSuspend"),
        action: isUser ? t("admin.suspend") : t("admin.removeAndSuspend"),
        danger: true,
        body: <p>{sentences(text, others)}</p>,
      };
    }
    case "mute":
      return {
        title: t("admin.removeAndMuteTitle"),
        action: t("admin.removeAndMute"),
        danger: true,
        body: <p>{sentences(t("admin.removeAndMuteBody", { what, name: author }), others)}</p>,
      };
  }
}

const PILL = "text-[12px] font-semibold text-site-accent-dark";
const AUTHOR_LINE: Record<string, AdminKey> = {
  user: "admin.authorAccount",
  dm: "admin.authorSent",
  group: "admin.authorSent",
};

export function Reports() {
  const { refresh } = useAuth();
  const [sp, set] = useQuery();
  const [modal, ask] = useConfirm();
  const status = sp.get("status") || "open";
  const type = sp.get("type") || "";
  const reason = sp.get("reason") || "";
  const page = sp.get("page") || "";
  const q = useApi<StaffReportList>(`/admin/reports${qs({ status, type, reason, page })}`);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const counts = q.data;
  useTitle(t("admin.navReports"));
  useEffect(() => setPicked(new Set()), [status, type, reason, page]);
  const done = () => {
    q.reload();
    refresh();
    setPicked(new Set());
  };
  const decide = (r: StaffReport, action: Decision) => {
    ask({
      ...decisionCopy(r, action),
      note: t("admin.resolutionNote"),
      run: (note) => api<ReportResolved>(`/admin/reports/${r.id}`, { body: { action, note } }).then(done),
    });
  };
  const dismissPicked = () =>
    ask({
      title: t("admin.dismissReports", { count: picked.size }),
      action: t("admin.dismissAll"),
      note: t("admin.resolutionNote"),
      body: <p>{t("admin.dismissReportsBody")}</p>,
      run: (note) => api<ReportsClosed>("/admin/reports/bulk", { body: { ids: [...picked], note } }).then(done),
    });
  const togglePick = (id: number, on: boolean) => {
    const n = new Set(picked);
    if (on) n.add(id);
    else n.delete(id);
    setPicked(n);
  };
  return (
    <>
      {modal}
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {(
            [
              ["open", "admin.flagsOpen"],
              ["closed", "admin.flagsResolved"],
              ["all", "admin.flagsAll"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={status === k ? "active" : ""}
              onClick={() => set({ status: k === "open" ? "" : k })}
            >
              {k === "open" && q.data ? t("admin.labelCount", { label: t(l), count: q.data.open }) : t(l)}
            </button>
          ))}
        </nav>
        {counts && (
          <div className="row">
            <Select
              label={t("admin.type")}
              value={type}
              onChange={(v) => set({ type: v })}
              options={[
                ["", t("admin.allTypes")],
                ...TYPES.map(
                  (k): Option => [k, t("admin.labelCount", { label: typeLabel(k), count: counts.byType[k] ?? 0 })]
                ),
              ]}
            />
            <Select
              label={t("admin.reason")}
              value={reason}
              onChange={(v) => set({ reason: v })}
              options={[
                ["", t("admin.allReasons")],
                ...REASONS.map(
                  (k): Option => [k, t("admin.labelCount", { label: reasonLabel(k), count: counts.byReason[k] ?? 0 })]
                ),
              ]}
            />
          </div>
        )}
      </div>
      <Async q={q}>
        {(d) => {
          const open = d.items.filter((r) => r.status === "open");
          return (
            <>
              {open.length > 0 && (
                <div className="bulk-bar">
                  <label className={CHECK}>
                    <Input
                      type="checkbox"
                      aria-label={t("admin.selectAllOnPage")}
                      checked={picked.size > 0 && picked.size === open.length}
                      onChange={(e) => setPicked(new Set(e.target.checked ? open.map((r) => r.id) : []))}
                    />{" "}
                    {t("admin.selectAll")}
                  </label>
                  {picked.size > 0 && (
                    <Button kind="btn ghost small" type="button" onClick={dismissPicked}>
                      {t("admin.dismissSelected", { count: picked.size })}
                    </Button>
                  )}
                </div>
              )}
              {d.items.length === 0 && (
                <Empty>{status === "open" ? t("admin.nothingWaiting") : t("admin.noReportsMatch")}</Empty>
              )}
              <ul className="reports [&>li]:py-[14px] [&>li]:px-3">
                {d.items.map((r) => {
                  const dm = r.type === "dm" || r.type === "group";
                  const automatic = r.reason === "listening";
                  const canRemove = r.exists && r.type !== "user" && !r.removed;
                  const canMute = r.exists && dm && r.author && !r.authorStaff && !r.authorMuted && !r.authorBanned;
                  const canSuspend = r.exists && r.author && !r.authorStaff && !r.authorSuspended && !r.authorBanned;
                  let authorState = null;
                  if (r.authorBanned) authorState = <span className="muted"> {t("admin.bannedParen")}</span>;
                  else if (r.authorSuspended) authorState = <span className="muted"> {t("admin.suspendedParen")}</span>;
                  return (
                    <li key={r.id} className={picked.has(r.id) ? PICKED_BG : ""}>
                      <div className="row gap-2">
                        {r.status === "open" && (
                          <Input
                            type="checkbox"
                            aria-label={t("admin.selectReport", { id: r.id })}
                            checked={picked.has(r.id)}
                            onChange={(e) => togglePick(r.id, e.target.checked)}
                          />
                        )}
                        <span className="badge">{reasonLabel(r.reason)}</span>
                        <span className={TYPE_LABEL}>{typeLabel(r.type)}</span>
                        <b>{r.where}</b>
                        {!r.exists && <span className="muted">· {t("admin.noLongerExists")}</span>}
                        {r.removed && <span className="muted">· {t("admin.removedFromConversation")}</span>}
                        {r.others > 0 && r.status === "open" && (
                          <span className={PILL}>{t("admin.moreReports", { count: r.others })}</span>
                        )}
                      </div>
                      <blockquote className={dm ? "adm-dm-snap" : undefined}>
                        {(automatic ? r.detail : r.text) || <span className="muted">{t("admin.emptyParen")}</span>}
                      </blockquote>
                      <p className="small">
                        {tx(AUTHOR_LINE[r.type] ?? "admin.authorWritten", {
                          author: r.author ? (
                            <Link to={adminUrl(r.author)}>
                              <Username name={r.author} />
                            </Link>
                          ) : (
                            t("admin.aDeletedUser")
                          ),
                        })}
                        {authorState}
                        {r.authorMuted && <span className="muted"> {t("admin.messagingOffParen")}</span>}
                        {r.authorStaff && <span className="muted"> {t("admin.staffParen")}</span>}
                        {" · "}
                        {automatic
                          ? tx("admin.flaggedAutomatically", {
                              ago: <span title={dateTime(r.createdAt)}>{ago(r.createdAt)}</span>,
                            })
                          : tx("admin.reportedBy", {
                              reporter: r.reporter ? (
                                <Link to={adminUrl(r.reporter)}>
                                  <Username name={r.reporter} />
                                </Link>
                              ) : (
                                t("admin.aDeletedUser")
                              ),
                              ago: <span title={dateTime(r.createdAt)}>{ago(r.createdAt)}</span>,
                            })}
                        {r.link && (
                          <>
                            {" "}
                            ·{" "}
                            <Link to={dm ? `${r.link}?report=${r.id}` : r.link}>
                              {dm ? t("admin.openTranscript") : t("admin.viewInContext")} <Ico.Right />
                            </Link>
                          </>
                        )}
                      </p>
                      {r.detail && !automatic && (
                        <p className="small">
                          {tx("admin.reportersNote", { label: <b>{t("admin.reportersNoteLabel")}</b>, note: r.detail })}
                        </p>
                      )}
                      {r.status === "open" ? (
                        <div className="row">
                          <Button kind="btn ghost small" type="button" onClick={() => decide(r, "dismiss")}>
                            {t("admin.dismiss")}
                          </Button>
                          {canRemove && (
                            <Button kind="btn ghost small" type="button" onClick={() => decide(r, "remove")}>
                              {dm ? t("admin.removeMessage") : t("admin.removeContent")}
                            </Button>
                          )}
                          {canMute && (
                            <Button kind="btn ghost small" type="button" onClick={() => decide(r, "mute")}>
                              {t("admin.removeAndMuteTitle")}
                            </Button>
                          )}
                          {canSuspend && (
                            <Button kind="btn danger small" type="button" onClick={() => decide(r, "suspend")}>
                              {r.type === "user" ? t("admin.suspendAccount") : t("admin.removeAndSuspendAuthor")}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="muted small">
                          {t("admin.resolvedByOutcome", {
                            ago: ago(r.resolvedAt ?? 0),
                            name: r.resolver || t("admin.aDeletedModerator"),
                            outcome: outcomeLabel(r.outcome),
                          })}
                          {r.note && <span className={NOTE}>“{r.note}”</span>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Pager total={d.total} limit={d.limit} />
            </>
          );
        }}
      </Async>
    </>
  );
}
import { Username } from "../ui/username";
