// Pieces every screen of the staff portal shares: labels, the role and query hooks, the confirm step and flash messages.
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Modal, Textarea } from "../kit";
import { useAuth } from "../lib";
import type { Role } from "../../shared/site";

export type { Role };
export const REASON: Record<string, string> = { spam: "Spam", abuse: "Harassment", inappropriate: "Inappropriate", impersonation: "Impersonation", other: "Other" };
export const TYPE: Record<string, string> = { shout: "Wall post", wiki: "Wiki edit", journal: "Journal post", user: "Profile", dm: "Direct message" };
export const ROLE: Record<Role, string> = { user: "User", moderator: "Moderator", admin: "Admin" };
export const adminUrl = (name: string) => `/admin/users/${encodeURIComponent(name)}`;
/** The message of a failed request (or anything else that was thrown). */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One setSearchParams for several keys at once (two setters in a row would overwrite each other). Any change but paging goes back to page 1. */
export function useQuery() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string>) => setSp(prev => {
    const n = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!("page" in patch)) n.delete("page");
    return n;
  }, { preventScrollReset: true });
  return [sp, set] as const; // a const assertion (not a cast): keeps the pair a tuple
}
export function useRole(): Role {
  const { me } = useAuth();
  return !me?.admin ? "user" : me.role === "moderator" ? "moderator" : "admin";
}

// ---------- confirm step ----------
type Ask = { title: string; body?: ReactNode; action: string; danger?: boolean; typed?: string; note?: false | string; run: (note: string) => Promise<unknown> };
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  return [ask ? <Confirm ask={ask} close={() => setAsk(null)} /> : null, setAsk] as const; // a const assertion (not a cast): keeps the pair a tuple
}
function Confirm({ ask, close }: { ask: Ask; close: () => void }) {
  const [note, setNote] = useState(""), [typed, setTyped] = useState(""), act = useAction2();
  const blocked = !!ask.typed && typed !== ask.typed;
  return (
    <Modal title={ask.title} onClose={close}>
      <form className="form adm-confirm" onSubmit={e => { e.preventDefault(); if (!blocked) act.run(async () => { await ask.run(note.trim()); close(); }); }}>
        {ask.body && <div className="adm-confirm-body">{ask.body}</div>}
        {ask.typed && <label>Type <code>{ask.typed}</code> to confirm<Input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Confirmation" autoComplete="off" autoFocus /></label>}
        {ask.note !== false && <label>{ask.note || "Note for the audit log"} <span className="muted small">Optional</span><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} aria-label="Note" /></label>}
        {act.note}
        <div className="row">
          <Button kind={ask.danger ? "btn danger" : "btn"} loading={act.busy} disabled={blocked}>{ask.action}</Button>
          <Button kind="btn ghost" type="button" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Same as useAction from ui.tsx, kept local so the confirm dialog can close itself without a stale message. */
export function useAction2() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); setError(""); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return { busy, run, note: error ? <p className="form-error" role="alert">{error}</p> : null };
}

/** A flash line under a section after an action that has no dialog of its own. */
export function useFlash() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    try { const t = await fn(); setMsg(t ? { ok: true, text: t } : null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  return { run, set: setMsg, note: msg ? <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null };
}
export const FLAG: Record<string, string> = { "copy-paste": "Copy-paste", volume: "Volume", "new-conversations": "New conversations" };
export function StatusBadges({ u }: { u: { role: Role; banned: boolean; suspended: boolean } }) {
  return (
    <>
      {u.role !== "user" && <span className={`adm-badge role-${u.role}`}>{ROLE[u.role]}</span>}
      {u.banned && <span className="adm-badge bad">Banned</span>}
      {u.suspended && !u.banned && <span className="adm-badge warn">Suspended</span>}
    </>
  );
}
