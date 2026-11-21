import { Fragment, useState, type ReactNode } from "react";
import { Arrow, arrowed } from "../icons";
import { Link } from "react-router-dom";
import { Button, Input, Select } from "../kit";
import { ago, dateTime, plural, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { REASON, ROLE, adminUrl, useQuery, FLAG } from "./common";
import type { AuditRow } from "../../shared/admin";
import type { AuditList as AuditPage } from "../../shared/admin-content";

// ---------- audit entries (dashboard, user history, audit log) ----------
const ACTION: Record<string, string> = {
  "user.suspend": "Suspended", "user.unsuspend": "Lifted suspension", "user.ban": "Banned", "user.unban": "Unbanned", "user.role": "Changed role", "user.sessions": "Signed out everywhere",
  "user.delete": "Deleted account", "note.add": "Added note", "note.delete": "Deleted note", "report.dismiss": "Dismissed report", "report.remove": "Removed reported content",
  "report.suspend": "Removed and suspended", "shout.delete": "Deleted wall post", "journal.delete": "Deleted journal post", "wiki.delete": "Deleted wiki revision", "wiki.revert": "Reverted wiki",
  "wiki.lock": "Locked wiki", "wiki.unlock": "Unlocked wiki", "catalogue.merge": "Merged", "catalogue.rename": "Renamed", "catalogue.orphans": "Deleted orphans", "tag.delete": "Deleted tag",
  "settings.update": "Changed settings", "report.mute": "Removed and muted", "dm.read": "Read conversation", "dm.delete": "Deleted message",
  "dm.mute": "Turned off messaging", "dm.unmute": "Restored messaging", "dm.resolve": "Resolved spam flag",
};
const actionLabel = (a: string) => ACTION[a] ?? a;
/** A number from an audit entry's data, or 0 when it is missing. */
const count = (v: unknown) => (typeof v === "number" ? v : 0);
/** A settings change as the audit log stores it: { from, to }. */
const change = (v: unknown) => (typeof v === "object" && v !== null && "from" in v && "to" in v ? v : { from: undefined, to: undefined });
const ROLE_NAME: Record<string, string> = ROLE;
function details(a: AuditRow): ReactNode {
  const d = a.data || {};
  if (a.action === "user.role") return <>{ROLE_NAME[String(d.from)] ?? String(d.from)}<Arrow />{ROLE_NAME[String(d.to)] ?? String(d.to)}</>;
  if (a.action === "settings.update") return Object.entries(d).map(([k, v], i) => { const c = change(v); return <Fragment key={k}>{i > 0 && "; "}{k}: {JSON.stringify(c.from)}<Arrow />{JSON.stringify(c.to)}</Fragment>; });
  if (a.action.startsWith("report.")) return `report #${d.report}${d.reason ? ` (${REASON[String(d.reason)] ?? d.reason})` : ""}${count(d.closed) > 1 ? `, closed ${d.closed}` : ""}`;
  if (a.action === "wiki.revert") return `back to version ${d.toVersion}`;
  if (a.action === "catalogue.merge" && d.merged !== undefined) return `${d.merged} merged, ${d.moved} moved`;
  if (a.action === "user.sessions") return plural(count(d.revoked), "session");
  if (a.action === "user.delete") return `${plural(count(d.scrobbles), "scrobble")}, ${plural(count(d.shouts), "shout")}`;
  if (a.action === "tag.delete") return plural(count(d.uses), "use");
  if (a.action === "dm.resolve") return `${FLAG[String(d.kind)] ?? d.kind}${d.detail ? `: ${d.detail}` : ""}`;
  if (a.action === "dm.delete") return d.closedReports ? `closed ${plural(count(d.closedReports), "report")}` : "";
  if (d.text) return `“${String(d.text).slice(0, 120)}${String(d.text).length > 120 ? "…" : ""}”`;
  return "";
}
export function AuditList({ items, empty }: { items: AuditRow[]; empty: string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="adm-audit">{items.map(a => {
      const extra = details(a);
      return (
        <li key={a.id}>
          <span className={`adm-act act-${a.action.split(".")[0]}`}>{actionLabel(a.action)}</span>
          <span className="grow">
            {a.targetType === "user" && (a.subject || a.label) ? <Link className="strong" to={adminUrl(a.subject || a.label)}>{arrowed(a.label || a.subject)}</Link>
              : a.targetType === "dm_thread" ? <Link className="strong" to={`/admin/messages/${a.targetId}`}>{arrowed(a.label)}</Link> : <b>{arrowed(a.label || a.targetType)}</b>}
            {a.subject && a.targetType !== "user" && <> · <Link to={adminUrl(a.subject)}>{a.subject}</Link></>}
            {extra && <span className="muted"> · {extra}</span>}
            {a.note && <span className="adm-note">“{a.note}”</span>}
          </span>
          <span className="muted small nowrap" title={dateTime(a.createdAt)}>{a.actor} · {ago(a.createdAt)}</span>
        </li>
      );
    })}</ul>
  );
}

// ---------- audit log ----------
export function Audit() {
  const [sp, set] = useQuery(), actor = sp.get("actor") || "", action = sp.get("action") || "", who = sp.get("user") || "", term = sp.get("q") || "", page = sp.get("page") || "";
  const [user, setUser] = useState(who), [text, setText] = useState(term);
  const q = useApi<AuditPage>(`/admin/audit${qs({ actor, action, user: who, q: term, page })}`);
  useTitle("Audit log");
  return (
    <Async q={q}>{d => {
      const groups = [...new Set<string>(d.actions.map(a => a.split(".")[0]))];
      return (
        <>
          <form className="adm-filterbar" onSubmit={e => { e.preventDefault(); set({ user: user.trim(), q: text.trim() }); }}>
            <Select label="Staff member" value={actor} onChange={v => set({ actor: v })} options={[["", "Any staff member"], ...d.actors.map((a): [string, string] => [a, a])]} />
            <Select label="Action" value={action} onChange={v => set({ action: v })} options={[["", "Any action"], ...groups.flatMap((g): [string, string][] => [[g, `All ${g} actions`], ...d.actions.filter(a => a.startsWith(g + ".")).map((a): [string, string] => [a, `  ${actionLabel(a)}`])])]} />
            <Input value={user} onChange={e => setUser(e.target.value)} placeholder="About user" aria-label="About user" />
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="Search target or note" aria-label="Search" />
            <Button kind="btn small">Filter</Button>
            {(actor || action || who || term) && <Button kind="link small" type="button" onClick={() => { setUser(""); setText(""); set({ actor: "", action: "", user: "", q: "" }); }}>Clear</Button>}
          </form>
          <p className="muted small">{plural(d.total, "entry").replace("entrys", "entries")}</p>
          {d.items.length === 0 ? <Empty>No entries match.</Empty> : (
            <div className="adm-scroll"><table className="adm-table adm-log">
              <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
              <tbody>{d.items.map(a => {
                const extra = details(a);
                return (
                  <tr key={a.id}>
                    <td className="nowrap small" title={dateTime(a.createdAt)}>{dateTime(a.createdAt)}</td>
                    <td><button type="button" className="adm-linkish" onClick={() => set({ actor: a.actor })}>{a.actor}</button></td>
                    <td><button type="button" className={`adm-act act-${a.action.split(".")[0]}`} onClick={() => set({ action: a.action })}>{actionLabel(a.action)}</button></td>
                    <td>{a.targetType === "user" && (a.subject || a.label) ? <Link to={adminUrl(a.subject || a.label)}>{arrowed(a.label || a.subject)}</Link>
                      : a.targetType === "dm_thread" ? <Link to={`/admin/messages/${a.targetId}`}>{arrowed(a.label)}</Link> : a.label ? arrowed(a.label) : <span className="muted">{a.targetType}</span>}
                      {a.subject && a.targetType !== "user" && <span className="muted small"> · <Link to={adminUrl(a.subject)}>{a.subject}</Link></span>}</td>
                    <td className="small">{extra && <span className="muted">{extra}</span>}{a.note && <span className="adm-note">“{a.note}”</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      );
    }}</Async>
  );
}
