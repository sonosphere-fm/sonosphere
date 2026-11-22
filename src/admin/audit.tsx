import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Arrow, arrowed } from "../icons";
import { Link } from "react-router-dom";
import { Button, Input, Select } from "../kit";
import { ago, dateTime, plural, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { REASON, ROLE, adminUrl, admAct, useQuery, FLAG } from "./common";
import type { AuditRow } from "../../shared/admin";
import type { AuditList as AuditPage } from "../../shared/admin-content";

const ACTION: Record<string, string> = {
  "user.suspend": "Suspended",
  "user.unsuspend": "Lifted suspension",
  "user.ban": "Banned",
  "user.unban": "Unbanned",
  "user.role": "Changed role",
  "user.sessions": "Signed out everywhere",
  "user.verify": "Confirmed email",
  "user.probation": "Put on probation",
  "user.release": "Ended probation",
  "user.delete": "Deleted account",
  "note.add": "Added note",
  "note.delete": "Deleted note",
  "report.dismiss": "Dismissed report",
  "report.remove": "Removed reported content",
  "report.suspend": "Removed and suspended",
  "report.mute": "Removed and muted",
  "shout.delete": "Deleted wall post",
  "journal.delete": "Deleted journal post",
  "wiki.delete": "Deleted wiki revision",
  "wiki.revert": "Reverted wiki",
  "wiki.lock": "Locked wiki",
  "wiki.unlock": "Unlocked wiki",
  "catalogue.merge": "Merged",
  "catalogue.rename": "Renamed",
  "catalogue.orphans": "Deleted orphans",
  "tag.delete": "Deleted tag",
  "settings.update": "Changed settings",
  "dm.read": "Read conversation",
  "dm.delete": "Deleted message",
  "dm.mute": "Turned off messaging",
  "dm.unmute": "Restored messaging",
  "dm.resolve": "Resolved spam flag",
};
const actionLabel = (a: string) => ACTION[a] ?? a;
const actionGroup = (a: string) => a.split(".")[0];
const count = (v: unknown) => (typeof v === "number" ? v : 0);
function change(v: unknown) {
  if (typeof v === "object" && v !== null && "from" in v && "to" in v) return v;
  return { from: undefined, to: undefined };
}
const ROLE_NAME: Record<string, string> = ROLE;
const roleName = (r: unknown) => ROLE_NAME[String(r)] ?? String(r);
function settingsChanges(d: Record<string, unknown>) {
  return Object.entries(d).map(([k, v], i) => {
    const c = change(v);
    return <Fragment key={k}>{i > 0 && "; "}{k}: {JSON.stringify(c.from)}<Arrow />{JSON.stringify(c.to)}</Fragment>;
  });
}
function reportDetails(d: Record<string, unknown>) {
  const reason = d.reason ? ` (${REASON[String(d.reason)] ?? d.reason})` : "";
  const closed = count(d.closed) > 1 ? `, closed ${d.closed}` : "";
  return `report #${d.report}${reason}${closed}`;
}
function details(a: AuditRow): ReactNode {
  const d = a.data || {};
  if (a.action === "user.role") return <>{roleName(d.from)}<Arrow />{roleName(d.to)}</>;
  if (a.action === "settings.update") return settingsChanges(d);
  if (a.action.startsWith("report.")) return reportDetails(d);
  if (a.action === "wiki.revert") return `back to version ${d.toVersion}`;
  if (a.action === "catalogue.merge" && d.merged !== undefined) return `${d.merged} merged, ${d.moved} moved`;
  if (a.action === "user.sessions") return plural(count(d.revoked), "session");
  if (a.action === "user.delete") return `${plural(count(d.scrobbles), "scrobble")}, ${plural(count(d.shouts), "shout")}`;
  if (a.action === "tag.delete") return plural(count(d.uses), "use");
  if (a.action === "dm.resolve") return `${FLAG[String(d.kind)] ?? d.kind}${d.detail ? `: ${d.detail}` : ""}`;
  if (a.action === "dm.delete") return d.closedReports ? `closed ${plural(count(d.closedReports), "report")}` : "";
  if (d.text) {
    const text = String(d.text);
    return `“${text.slice(0, 120)}${text.length > 120 ? "…" : ""}”`;
  }
  return "";
}
function auditUserLink(a: AuditRow) {
  return a.targetType === "user" && (a.subject || a.label) ? adminUrl(a.subject || a.label) : null;
}
export function AuditList({ items, empty }: { items: AuditRow[]; empty: string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="list-none m-0 p-0 [&_li]:flex [&_li]:gap-3 [&_li]:items-baseline [&_li]:py-2.5 [&_li]:border-b [&_li]:border-line [&_li]:text-sm [&_li]:flex-wrap [&_li>.item-text]:min-w-0 [&_li>.item-text]:flex-[1_1_240px] [&_li>.item-text]:wrap-anywhere">
      {items.map(a => {
        const extra = details(a);
        const userLink = auditUserLink(a);
        let target: ReactNode = <b>{arrowed(a.label || a.targetType)}</b>;
        if (userLink) target = <Link className="font-semibold" to={userLink}>{arrowed(a.label || a.subject)}</Link>;
        else if (a.targetType === "dm_thread") target = <Link className="font-semibold" to={`/admin/messages/${a.targetId}`}>{arrowed(a.label)}</Link>;
        return (
          <li key={a.id}>
            <span className={admAct(actionGroup(a.action))}>{actionLabel(a.action)}</span>
            <span className="item-text flex-1 min-w-0">
              {target}
              {a.subject && a.targetType !== "user" && <> · <Link to={adminUrl(a.subject)}>{a.subject}</Link></>}
              {extra && <span className="text-muted"> · {extra}</span>}
              {a.note && <span className="block text-ink-2 italic mt-0.5">“{a.note}”</span>}
            </span>
            <span className="text-muted text-[13px] whitespace-nowrap" title={dateTime(a.createdAt)}>{a.actor} · {ago(a.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}

type Option = [string, string];

export function Audit() {
  const [sp, set] = useQuery();
  const actor = sp.get("actor") || "";
  const action = sp.get("action") || "";
  const who = sp.get("user") || "";
  const term = sp.get("q") || "";
  const page = sp.get("page") || "";
  const [user, setUser] = useState(who);
  const [text, setText] = useState(term);
  const q = useApi<AuditPage>(`/admin/audit${qs({ actor, action, user: who, q: term, page })}`);
  useTitle("Audit log");
  const filter = (e: FormEvent) => {
    e.preventDefault();
    set({ user: user.trim(), q: text.trim() });
  };
  const clear = () => {
    setUser("");
    setText("");
    set({ actor: "", action: "", user: "", q: "" });
  };
  return (
    <Async q={q}>{d => {
      const groups = [...new Set<string>(d.actions.map(actionGroup))];
      const actorOptions: Option[] = [["", "Any staff member"], ...d.actors.map((a): Option => [a, a])];
      const actionOptions: Option[] = [["", "Any action"]];
      for (const g of groups) {
        actionOptions.push([g, `All ${g} actions`]);
        for (const a of d.actions.filter(a => a.startsWith(g + "."))) actionOptions.push([a, `  ${actionLabel(a)}`]);
      }
      return (
        <>
          <form className="flex flex-wrap items-center gap-2.5 mb-3.5 [&_.astryx-text-input]:min-w-[170px] [&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px] max-[861px]:[&>*]:flex-[1_1_160px]" onSubmit={filter}>
            <Select label="Staff member" value={actor} onChange={v => set({ actor: v })} options={actorOptions} />
            <Select label="Action" value={action} onChange={v => set({ action: v })} options={actionOptions} />
            <Input value={user} onChange={e => setUser(e.target.value)} placeholder="About user" aria-label="About user" />
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="Search target or note" aria-label="Search" />
            <Button kind="btn small">Filter</Button>
            {(actor || action || who || term) && <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={clear}>Clear</Button>}
          </form>
          <p className="text-muted text-[13px]">{plural(d.total, "entry").replace("entrys", "entries")}</p>
          {d.items.length === 0 ? <Empty>No entries match.</Empty> : (
            <div className="overflow-x-auto mb-3.5">
              <table className="adm-table [&_th_button_.ico]:ml-1 [&_th_button_.ico]:size-[.85em] adm-log w-full border-collapse text-sm [&_td]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em] [&_th]:text-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-line [&_th]:whitespace-nowrap [&_th_button]:bg-transparent [&_th_button]:border-0 [&_th_button]:p-0 [&_th_button]:[font:inherit] [&_th_button]:text-inherit [&_th_button]:uppercase [&_th_button]:tracking-[.05em] [&_th_button]:cursor-pointer [&_th_button:hover]:text-ink [&_th_button.on]:text-ink [&_.num]:text-right [&_.num]:tabular-nums [&_.right]:text-right [&_.tick]:w-7 [&_.grow-cell]:w-full [&_tr.picked_td]:bg-[light-dark(#fff7f6,#1f2659)] [&.compact_td]:p-1.5 [&.compact_td]:align-top [&.adm-log_td]:align-top adm-log">
                <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
                <tbody>
                  {d.items.map(a => {
                    const extra = details(a);
                    const userLink = auditUserLink(a);
                    let target: ReactNode = <span className="text-muted">{a.targetType}</span>;
                    if (userLink) target = <Link to={userLink}>{arrowed(a.label || a.subject)}</Link>;
                    else if (a.targetType === "dm_thread") target = <Link to={`/admin/messages/${a.targetId}`}>{arrowed(a.label)}</Link>;
                    else if (a.label) target = arrowed(a.label);
                    return (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap text-[13px]" title={dateTime(a.createdAt)}>{dateTime(a.createdAt)}</td>
                        <td>
                          <button type="button" className="bg-transparent border-0 p-0 [font:inherit] text-link text-left cursor-pointer hover:underline" onClick={() => set({ actor: a.actor })}>{a.actor}</button>
                        </td>
                        <td>
                          <button type="button" className={admAct(actionGroup(a.action))} onClick={() => set({ action: a.action })}>
                            {actionLabel(a.action)}
                          </button>
                        </td>
                        <td>
                          {target}
                          {a.subject && a.targetType !== "user" && (
                            <span className="text-muted text-[13px]"> · <Link to={adminUrl(a.subject)}>{a.subject}</Link></span>
                          )}
                        </td>
                        <td className="text-[13px]">
                          {extra && <span className="text-muted">{extra}</span>}
                          {a.note && <span className="block text-ink-2 italic mt-0.5">“{a.note}”</span>}
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
    }}</Async>
  );
}
