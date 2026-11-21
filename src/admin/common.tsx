import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Modal, Textarea } from "../kit";
import { useAuth } from "../lib";
import { errorText } from "../ui/base";
import type { Role } from "../../shared/site";

export type { Role };
export const REASON: Record<string, string> = {
  spam: "Spam",
  abuse: "Harassment",
  inappropriate: "Inappropriate",
  impersonation: "Impersonation",
  other: "Other",
};
export const TYPE: Record<string, string> = {
  shout: "Wall post",
  wiki: "Wiki edit",
  journal: "Journal post",
  user: "Profile",
  dm: "Direct message",
  group: "Group message",
};
export const ROLE: Record<Role, string> = { user: "User", moderator: "Moderator", admin: "Admin" };
export const adminUrl = (name: string) => `/admin/users/${encodeURIComponent(name)}`;

/** Sets several search params in one update. Any change but paging goes back to page 1. */
export function useQuery() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string>) => setSp(prev => {
    const n = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    if (!("page" in patch)) n.delete("page");
    return n;
  }, { preventScrollReset: true });
  return [sp, set] as const;
}
export function useRole(): Role {
  const { me } = useAuth();
  if (!me?.admin) return "user";
  return me.role === "moderator" ? "moderator" : "admin";
}

type Ask = {
  title: string;
  body?: ReactNode;
  action: string;
  danger?: boolean;
  typed?: string;
  note?: false | string;
  run: (note: string) => Promise<unknown>;
};
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const modal = ask ? <Confirm ask={ask} close={() => setAsk(null)} /> : null;
  return [modal, setAsk] as const;
}
function Confirm({ ask, close }: { ask: Ask; close: () => void }) {
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const act = useAction2();
  const blocked = !!ask.typed && typed !== ask.typed;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    act.run(async () => {
      await ask.run(note.trim());
      close();
    });
  };
  return (
    <Modal title={ask.title} onClose={close}>
      <form className="form adm-confirm" onSubmit={submit}>
        {ask.body && <div className="adm-confirm-body">{ask.body}</div>}
        {ask.typed && (
          <label>
            Type <code>{ask.typed}</code> to confirm
            <Input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Confirmation" autoComplete="off" autoFocus />
          </label>
        )}
        {ask.note !== false && (
          <label>
            {ask.note || "Note for the audit log"} <span className="muted small">Optional</span>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} aria-label="Note" />
          </label>
        )}
        {act.note}
        <div className="row">
          <Button kind={ask.danger ? "btn danger" : "btn"} loading={act.busy} disabled={blocked}>{ask.action}</Button>
          <Button kind="btn ghost" type="button" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Like useAction from ui/base, but with no success message, so a dialog can close itself cleanly. */
export function useAction2() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const note = error ? <p className="form-error" role="alert">{error}</p> : null;
  return { busy, run, note };
}

export function useFlash() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    try {
      const t = await fn();
      setMsg(t ? { ok: true, text: t } : null);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };
  const note = msg
    ? <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>
    : null;
  return { run, set: setMsg, note };
}
export const FLAG: Record<string, string> = {
  "copy-paste": "Copy-paste",
  volume: "Volume",
  "new-conversations": "New conversations",
};
export function StatusBadges({ u }: { u: { role: Role; banned: boolean; suspended: boolean; unconfirmed?: boolean } }) {
  return (
    <>
      {u.role !== "user" && <span className={`adm-badge role-${u.role}`}>{ROLE[u.role]}</span>}
      {u.banned && <span className="adm-badge bad">Banned</span>}
      {u.suspended && !u.banned && <span className="adm-badge warn">Suspended</span>}
      {u.unconfirmed && !u.banned && <span className="adm-badge">Unconfirmed</span>}
    </>
  );
}
