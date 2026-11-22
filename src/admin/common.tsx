import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Modal, Textarea } from "../kit";
import { useAuth } from "../lib";
import { errorText } from "../ui/base";
import type { Role } from "../../shared/site";
import { cn } from "../ui/tw";

const BADGE_TONE: Record<string, string> = {
  "role-admin": "bg-accent text-on-accent",
  "role-moderator": "bg-[light-dark(#1f4396,#3d50e0)] text-white",
  bad: "bg-ink text-bg",
  warn: "bg-[light-dark(#fff2d9,#2a2718)] text-[light-dark(#7a4b00,#ffd98a)]",
  ok: "bg-[light-dark(#e3f1e6,#16302e)] text-[light-dark(#1d5b2c,#8fd6a3)]",
};
/** Small uppercase status label; tone is a key of BADGE_TONE (role-admin, bad, warn...) or nothing for grey. */
export const admBadge = (tone = "") => cn(
  "adm-badge inline-block align-middle ml-1.5 [td_&]:first:ml-0 text-[11px] font-bold uppercase tracking-[.05em] px-[7px] py-px rounded-[3px] bg-fill text-ink",
  BADGE_TONE[tone],
);

const ACT_TONE: Record<string, string> = {
  user: "bg-[light-dark(#fde8e6,#3a1e34)] text-[light-dark(#9c1c12,#ffab9c)]",
  report: "bg-[light-dark(#e8eefc,#232c78)] text-[light-dark(#1f4396,#dfe3ff)]",
  wiki: "bg-[light-dark(#fff2d9,#2a2718)] text-[light-dark(#7a4b00,#ffd98a)]",
  shout: "bg-[light-dark(#fff2d9,#2a2718)] text-[light-dark(#7a4b00,#ffd98a)]",
  journal: "bg-[light-dark(#fff2d9,#2a2718)] text-[light-dark(#7a4b00,#ffd98a)]",
  catalogue: "bg-[light-dark(#e4f4ea,#16302e)] text-[light-dark(#1b5e33,#8fdcaa)]",
  tag: "bg-[light-dark(#e4f4ea,#16302e)] text-[light-dark(#1b5e33,#8fdcaa)]",
  settings: "bg-ink text-bg",
};
/** Audit-log action label, coloured by the kind of thing acted on; on a <button> it filters the log. */
export const admAct = (group: string) => cn(
  "adm-act inline-block text-[11px] font-bold uppercase tracking-[.05em] px-[7px] py-0.5 rounded-[3px] bg-fill text-ink border-0 whitespace-nowrap [button&]:cursor-pointer [button&]:hover:brightness-95",
  ACT_TONE[group],
);

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
      <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full pt-1 [&_code]:bg-panel [&_code]:px-1.5 [&_code]:py-px [&_code]:border [&_code]:border-line [&_.adm-confirm-body_p]:m-0 [&_.adm-confirm-body_p]:mb-1.5" onSubmit={submit}>
        {ask.body && <div className="adm-confirm-body">{ask.body}</div>}
        {ask.typed && (
          <label>
            Type <code>{ask.typed}</code> to confirm
            <Input value={typed} onChange={e => setTyped(e.target.value)} aria-label="Confirmation" autoComplete="off" autoFocus />
          </label>
        )}
        {ask.note !== false && (
          <label>
            {ask.note || "Note for the audit log"} <span className="text-muted text-[13px]">Optional</span>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} aria-label="Note" />
          </label>
        )}
        {act.note}
        <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
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
  const note = error ? <p className="form-error font-semibold m-0 text-bad" role="alert">{error}</p> : null;
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
    ? <p className={msg.ok ? "font-semibold m-0 text-ok" : "font-semibold m-0 text-bad"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>
    : null;
  return { run, set: setMsg, note };
}
export const FLAG: Record<string, string> = {
  "copy-paste": "Copy-paste",
  volume: "Volume",
  "new-conversations": "New conversations",
};
export function StatusBadges({ u }: { u: { role: Role; banned: boolean; suspended: boolean; unconfirmed?: boolean; probation?: boolean } }) {
  return (
    <>
      {u.role !== "user" && <span className={admBadge(`role-${u.role}`)}>{ROLE[u.role]}</span>}
      {u.banned && <span className={admBadge("bad")}>Banned</span>}
      {u.suspended && !u.banned && <span className={admBadge("warn")}>Suspended</span>}
      {u.unconfirmed && !u.banned && <span className={admBadge()}>Unconfirmed</span>}
      {u.probation && !u.banned && <span className={admBadge()}>Probation</span>}
    </>
  );
}
