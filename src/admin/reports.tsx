import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ico } from "../icons";
import { Button, Input, Select } from "../kit";
import { ago, api, dateTime, plural, qs, useApi, useAuth, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { REASON, TYPE, adminUrl, useQuery, useConfirm } from "./common";
import type { ReportResolved, ReportsClosed, StaffReport, StaffReportList } from "../../shared/admin";

// ---------- reports ----------
export function Reports() {
  const { refresh } = useAuth(), [sp, set] = useQuery(), [modal, ask] = useConfirm();
  const status = sp.get("status") || "open", type = sp.get("type") || "", reason = sp.get("reason") || "", page = sp.get("page") || "";
  const q = useApi<StaffReportList>(`/admin/reports${qs({ status, type, reason, page })}`);
  const [picked, setPicked] = useState<Set<number>>(new Set()), counts = q.data;
  useTitle("Reports");
  useEffect(() => setPicked(new Set()), [status, type, reason, page]);
  const done = () => { q.reload(); refresh(); setPicked(new Set()); };
  const decide = (r: StaffReport, action: "dismiss" | "remove" | "suspend" | "mute") => {
    const what = r.type === "user" ? `${r.author}'s profile` : `this ${TYPE[r.type].toLowerCase()}${r.author ? ` by ${r.author}` : ""}`;
    const dm = r.type === "dm", gone = dm ? " It disappears for both people at once; staff can still see it in the transcript." : " This can't be undone.";
    const others = r.others ? ` The ${plural(r.others, "other open report")} on it will be closed too.` : "";
    ask({ ...{
      dismiss: { title: "Dismiss report", action: "Dismiss", body: <p>Leave {what} as it is and close the report.{others}</p> },
      remove: { title: dm ? "Remove message" : "Remove content", action: "Remove", danger: true, body: <p>{dm ? "Remove" : "Delete"} {what}.{gone}{others}</p> },
      suspend: { title: r.type === "user" ? "Suspend account" : "Remove and suspend", action: r.type === "user" ? "Suspend" : "Remove and suspend", danger: true,
        body: <p>{r.type === "user" ? `Suspend ${r.author} from posting.` : `${dm ? "Remove" : "Delete"} ${what} and suspend ${r.author} from posting${dm ? " and messaging" : ""}.`}{others}</p> },
      mute: { title: "Remove and turn off messaging", action: "Remove and mute", danger: true,
        body: <p>Remove {what} and turn off direct messages for {r.author}. They can still read their conversations and use the rest of the site.{others}</p> },
    }[action], note: "Resolution note", run: note => api<ReportResolved>(`/admin/reports/${r.id}`, { body: { action, note } }).then(done) });
  };
  return (
    <>
      {modal}
      <div className="toolbar">
        <nav className="tabs sub">{[["open", "Open"], ["closed", "Resolved"], ["all", "All"]].map(([k, l]) => (
          <button key={k} type="button" className={status === k ? "active" : ""} onClick={() => set({ status: k === "open" ? "" : k })}>{l}{k === "open" && q.data ? ` (${q.data.open})` : ""}</button>
        ))}</nav>
        {counts && (
          <div className="row adm-filters">
            <Select label="Type" value={type} onChange={v => set({ type: v })} options={[["", "All types"], ...Object.keys(TYPE).map((k): [string, string] => [k, `${TYPE[k]} (${counts.byType[k] ?? 0})`])]} />
            <Select label="Reason" value={reason} onChange={v => set({ reason: v })} options={[["", "All reasons"], ...Object.keys(REASON).map((k): [string, string] => [k, `${REASON[k]} (${counts.byReason[k] ?? 0})`])]} />
          </div>
        )}
      </div>
      <Async q={q}>{d => {
        const open = d.items.filter(r => r.status === "open");
        return (
          <>
            {open.length > 0 && (
              <div className="bulk-bar">
                <label className="check adm-check"><Input type="checkbox" aria-label="Select all on this page" checked={picked.size > 0 && picked.size === open.length} onChange={e => setPicked(new Set(e.target.checked ? open.map(r => r.id) : []))} /> Select all</label>
                {picked.size > 0 && <Button kind="btn ghost small" type="button" onClick={() => ask({
                  title: `Dismiss ${plural(picked.size, "report")}`, action: "Dismiss all", note: "Resolution note",
                  body: <p>Close the selected reports without changing anything. Other open reports on the same items are closed too.</p>,
                  run: note => api<ReportsClosed>("/admin/reports/bulk", { body: { ids: [...picked], note } }).then(done),
                })}>Dismiss {picked.size} selected</Button>}
              </div>
            )}
            {d.items.length === 0 && <Empty>{status === "open" ? "Nothing waiting. Reports from listeners show up here." : "No reports match."}</Empty>}
            <ul className="reports adm-reports">{d.items.map(r => (
              <li key={r.id} className={picked.has(r.id) ? "picked" : ""}>
                <div className="report-head row">
                  {r.status === "open" && <Input type="checkbox" aria-label={`Select report ${r.id}`} checked={picked.has(r.id)} onChange={e => { const n = new Set(picked); e.target.checked ? n.add(r.id) : n.delete(r.id); setPicked(n); }} />}
                  <span className="badge">{REASON[r.reason] || r.reason}</span>
                  <span className="adm-type">{TYPE[r.type]}</span>
                  <b>{r.where}</b>{!r.exists && <span className="muted">· no longer exists</span>}{r.removed && <span className="muted">· removed from the conversation</span>}
                  {r.others > 0 && r.status === "open" && <span className="adm-pill">+{plural(r.others, "more report")}</span>}
                </div>
                <blockquote className={r.type === "dm" ? "adm-dm-snap" : undefined}>{r.text || <span className="muted">(empty)</span>}</blockquote>
                <p className="small">
                  {r.type === "user" ? "Account " : r.type === "dm" ? "Sent by " : "Written by "}{r.author ? <Link to={adminUrl(r.author)}>{r.author}</Link> : "a deleted user"}
                  {r.authorBanned ? <span className="muted"> (banned)</span> : r.authorSuspended ? <span className="muted"> (suspended)</span> : null}
                  {r.authorMuted && <span className="muted"> (messaging off)</span>}
                  {r.authorStaff && <span className="muted"> (staff)</span>}
                  {" · "}reported by {r.reporter ? <Link to={adminUrl(r.reporter)}>{r.reporter}</Link> : "a deleted user"} <span title={dateTime(r.createdAt)}>{ago(r.createdAt)}</span>
                  {r.link && <> · <Link to={r.type === "dm" ? `${r.link}?report=${r.id}` : r.link}>{r.type === "dm" ? "Open transcript" : "View in context"} <Ico.Right /></Link></>}
                </p>
                {r.detail && <p className="small"><b>Reporter's note:</b> {r.detail}</p>}
                {r.status === "open" ? (
                  <div className="row">
                    <Button kind="btn ghost small" type="button" onClick={() => decide(r, "dismiss")}>Dismiss</Button>
                    {r.exists && r.type !== "user" && !r.removed && <Button kind="btn ghost small" type="button" onClick={() => decide(r, "remove")}>{r.type === "dm" ? "Remove message" : "Remove content"}</Button>}
                    {r.exists && r.type === "dm" && r.author && !r.authorStaff && !r.authorMuted && !r.authorBanned && <Button kind="btn ghost small" type="button" onClick={() => decide(r, "mute")}>Remove and turn off messaging</Button>}
                    {r.exists && r.author && !r.authorStaff && !r.authorSuspended && !r.authorBanned && <Button kind="btn danger small" type="button" onClick={() => decide(r, "suspend")}>{r.type === "user" ? "Suspend account" : "Remove and suspend author"}</Button>}
                  </div>
                ) : <p className="muted small">Resolved {ago(r.resolvedAt ?? 0)} by {r.resolver || "a deleted moderator"}: {r.outcome}{r.note && <span className="adm-note">“{r.note}”</span>}</p>}
              </li>
            ))}</ul>
            <Pager total={d.total} limit={d.limit} />
          </>
        );
      }}</Async>
    </>
  );
}
