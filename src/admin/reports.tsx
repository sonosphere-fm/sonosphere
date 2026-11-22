import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ico } from "../icons";
import { Button, Input, Select } from "../kit";
import { ago, api, dateTime, plural, qs, useApi, useAuth, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { CHECK, NOTE, PICKED_BG, TOOLBAR, TYPE_LABEL } from "./common";
import { REASON, TYPE, adminUrl, useQuery, useConfirm } from "./common";
import type { ReportResolved, ReportsClosed, StaffReport, StaffReportList } from "../../shared/admin";

type Decision = "dismiss" | "remove" | "suspend" | "mute";
type Option = [string, string];

function decisionCopy(r: StaffReport, action: Decision) {
  const isUser = r.type === "user";
  const dm = r.type === "dm" || r.type === "group";
  const what = isUser ? `${r.author}'s profile` : `this ${TYPE[r.type].toLowerCase()}${r.author ? ` by ${r.author}` : ""}`;
  let gone = " This can't be undone.";
  if (r.type === "dm") gone = " It disappears for both people at once; staff can still see it in the transcript.";
  if (r.type === "group") gone = " It disappears for everyone in the group at once.";
  const others = r.others ? ` The ${plural(r.others, "other open report")} on it will be closed too.` : "";
  const removeVerb = dm ? "Remove" : "Delete";
  switch (action) {
    case "dismiss":
      return { title: "Dismiss report", action: "Dismiss", body: <p>Leave {what} as it is and close the report.{others}</p> };
    case "remove":
      return {
        title: dm ? "Remove message" : "Remove content",
        action: "Remove",
        danger: true,
        body: <p>{removeVerb} {what}.{gone}{others}</p>,
      };
    case "suspend": {
      const text = isUser
        ? `Suspend ${r.author} from posting.`
        : `${removeVerb} ${what} and suspend ${r.author} from posting${dm ? " and messaging" : ""}.`;
      return {
        title: isUser ? "Suspend account" : "Remove and suspend",
        action: isUser ? "Suspend" : "Remove and suspend",
        danger: true,
        body: <p>{text}{others}</p>,
      };
    }
    case "mute":
      return {
        title: "Remove and turn off messaging",
        action: "Remove and mute",
        danger: true,
        body: <p>Remove {what} and turn off direct messages for {r.author}. They can still read their conversations and use the rest of the site.{others}</p>,
      };
  }
}

const PILL = "text-[12px] font-semibold text-site-accent-dark";
const AUTHOR_PREFIX: Record<string, string> = { user: "Account ", dm: "Sent by ", group: "Sent by " };

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
  useTitle("Reports");
  useEffect(() => setPicked(new Set()), [status, type, reason, page]);
  const done = () => {
    q.reload();
    refresh();
    setPicked(new Set());
  };
  const decide = (r: StaffReport, action: Decision) => {
    ask({
      ...decisionCopy(r, action),
      note: "Resolution note",
      run: note => api<ReportResolved>(`/admin/reports/${r.id}`, { body: { action, note } }).then(done),
    });
  };
  const dismissPicked = () => ask({
    title: `Dismiss ${plural(picked.size, "report")}`,
    action: "Dismiss all",
    note: "Resolution note",
    body: <p>Close the selected reports without changing anything. Other open reports on the same items are closed too.</p>,
    run: note => api<ReportsClosed>("/admin/reports/bulk", { body: { ids: [...picked], note } }).then(done),
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
          {[["open", "Open"], ["closed", "Resolved"], ["all", "All"]].map(([k, l]) => (
            <button key={k} type="button" className={status === k ? "active" : ""} onClick={() => set({ status: k === "open" ? "" : k })}>
              {l}{k === "open" && q.data ? ` (${q.data.open})` : ""}
            </button>
          ))}
        </nav>
        {counts && (
          <div className="row">
            <Select
              label="Type"
              value={type}
              onChange={v => set({ type: v })}
              options={[["", "All types"], ...Object.keys(TYPE).map((k): Option => [k, `${TYPE[k]} (${counts.byType[k] ?? 0})`])]}
            />
            <Select
              label="Reason"
              value={reason}
              onChange={v => set({ reason: v })}
              options={[["", "All reasons"], ...Object.keys(REASON).map((k): Option => [k, `${REASON[k]} (${counts.byReason[k] ?? 0})`])]}
            />
          </div>
        )}
      </div>
      <Async q={q}>{d => {
        const open = d.items.filter(r => r.status === "open");
        return (
          <>
            {open.length > 0 && (
              <div className="bulk-bar">
                <label className={CHECK}>
                  <Input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={picked.size > 0 && picked.size === open.length}
                    onChange={e => setPicked(new Set(e.target.checked ? open.map(r => r.id) : []))}
                  />{" "}
                  Select all
                </label>
                {picked.size > 0 && (
                  <Button kind="btn ghost small" type="button" onClick={dismissPicked}>Dismiss {picked.size} selected</Button>
                )}
              </div>
            )}
            {d.items.length === 0 && (
              <Empty>{status === "open" ? "Nothing waiting. Reports from listeners show up here." : "No reports match."}</Empty>
            )}
            <ul className="reports [&>li]:py-[14px] [&>li]:px-3">
              {d.items.map(r => {
                const dm = r.type === "dm" || r.type === "group";
                const canRemove = r.exists && r.type !== "user" && !r.removed;
                const canMute = r.exists && dm && r.author && !r.authorStaff && !r.authorMuted && !r.authorBanned;
                const canSuspend = r.exists && r.author && !r.authorStaff && !r.authorSuspended && !r.authorBanned;
                let authorState = null;
                if (r.authorBanned) authorState = <span className="muted"> (banned)</span>;
                else if (r.authorSuspended) authorState = <span className="muted"> (suspended)</span>;
                return (
                  <li key={r.id} className={picked.has(r.id) ? PICKED_BG : ""}>
                    <div className="row gap-2">
                      {r.status === "open" && (
                        <Input
                          type="checkbox"
                          aria-label={`Select report ${r.id}`}
                          checked={picked.has(r.id)}
                          onChange={e => togglePick(r.id, e.target.checked)}
                        />
                      )}
                      <span className="badge">{REASON[r.reason] || r.reason}</span>
                      <span className={TYPE_LABEL}>{TYPE[r.type]}</span>
                      <b>{r.where}</b>
                      {!r.exists && <span className="muted">· no longer exists</span>}
                      {r.removed && <span className="muted">· removed from the conversation</span>}
                      {r.others > 0 && r.status === "open" && <span className={PILL}>+{plural(r.others, "more report")}</span>}
                    </div>
                    <blockquote className={dm ? "adm-dm-snap" : undefined}>{r.text || <span className="muted">(empty)</span>}</blockquote>
                    <p className="small">
                      {AUTHOR_PREFIX[r.type] ?? "Written by "}
                      {r.author ? <Link to={adminUrl(r.author)}>{r.author}</Link> : "a deleted user"}
                      {authorState}
                      {r.authorMuted && <span className="muted"> (messaging off)</span>}
                      {r.authorStaff && <span className="muted"> (staff)</span>}
                      {" · "}reported by {r.reporter ? <Link to={adminUrl(r.reporter)}>{r.reporter}</Link> : "a deleted user"}{" "}
                      <span title={dateTime(r.createdAt)}>{ago(r.createdAt)}</span>
                      {r.link && (
                        <> · <Link to={dm ? `${r.link}?report=${r.id}` : r.link}>{dm ? "Open transcript" : "View in context"} <Ico.Right /></Link></>
                      )}
                    </p>
                    {r.detail && <p className="small"><b>Reporter's note:</b> {r.detail}</p>}
                    {r.status === "open" ? (
                      <div className="row">
                        <Button kind="btn ghost small" type="button" onClick={() => decide(r, "dismiss")}>Dismiss</Button>
                        {canRemove && (
                          <Button kind="btn ghost small" type="button" onClick={() => decide(r, "remove")}>
                            {dm ? "Remove message" : "Remove content"}
                          </Button>
                        )}
                        {canMute && (
                          <Button kind="btn ghost small" type="button" onClick={() => decide(r, "mute")}>Remove and turn off messaging</Button>
                        )}
                        {canSuspend && (
                          <Button kind="btn danger small" type="button" onClick={() => decide(r, "suspend")}>
                            {r.type === "user" ? "Suspend account" : "Remove and suspend author"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="muted small">
                        Resolved {ago(r.resolvedAt ?? 0)} by {r.resolver || "a deleted moderator"}: {r.outcome}
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
      }}</Async>
    </>
  );
}
