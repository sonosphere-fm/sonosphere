import { useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Modal, Textarea } from "../kit";
import { useAuth } from "../lib";
import { errorText } from "../ui/base";
import type { Role } from "../../shared/site";
import { t, tx } from "./i18n";

export type { Role };
export type AdminKey = Parameters<typeof t>[0];

const label = (keys: Record<string, AdminKey>) => (value: unknown) => {
  const key = keys[String(value)];
  return key ? t(key) : String(value);
};
const REASON_KEY: Record<string, AdminKey> = {
  spam: "admin.reasonSpam",
  abuse: "admin.reasonAbuse",
  inappropriate: "admin.reasonInappropriate",
  impersonation: "admin.reasonImpersonation",
  other: "admin.reasonOther",
};
export const REASONS = Object.keys(REASON_KEY);
export const reasonLabel = label(REASON_KEY);
const TYPE_KEY: Record<string, AdminKey> = {
  shout: "admin.typeShout",
  wiki: "admin.typeWiki",
  journal: "admin.typeJournal",
  user: "admin.typeUser",
  dm: "admin.typeDm",
  group: "admin.typeGroup",
};
export const TYPES = Object.keys(TYPE_KEY);
export const typeLabel = label(TYPE_KEY);
export const roleLabel = label({ user: "admin.roleUser", moderator: "admin.roleModerator", admin: "admin.roleAdmin" });
export const outcomeLabel = label({
  dismissed: "admin.outcomeDismissed",
  "content removed": "admin.outcomeContentRemoved",
  "author suspended": "admin.outcomeAuthorSuspended",
  "author muted": "admin.outcomeAuthorMuted",
  "account deleted": "admin.outcomeAccountDeleted",
});
export const adminUrl = (name: string) => `/admin/users/${encodeURIComponent(name)}`;

/** Sets several search params in one update. Any change but paging goes back to page 1. */
export function useQuery() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string>) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        if (!("page" in patch)) n.delete("page");
        return n;
      },
      { preventScrollReset: true }
    );
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
const CODE = "bg-site-panel py-px px-[5px] border border-site-line";
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
      <form className="form pt-1" onSubmit={submit}>
        {ask.body && <div className="[&_p]:m-[0_0_6px]">{ask.body}</div>}
        {ask.typed && (
          <label>
            {tx("admin.typeToConfirm", { text: <code className={CODE}>{ask.typed}</code> })}
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={t("admin.confirmation")}
              autoComplete="off"
              autoFocus
            />
          </label>
        )}
        {ask.note !== false && (
          <label>
            {ask.note || t("admin.auditNote")} <span className="muted small">{t("admin.optional")}</span>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              aria-label={t("admin.note")}
            />
          </label>
        )}
        {act.note}
        <div className="row">
          <Button kind={ask.danger ? "btn danger" : "btn"} loading={act.busy} disabled={blocked}>
            {ask.action}
          </Button>
          <Button kind="btn ghost" type="button" onClick={close}>
            {t("admin.cancel")}
          </Button>
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
  const note = error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
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
  const note = msg ? (
    <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  ) : null;
  return { run, set: setMsg, note };
}
export const flagLabel = label({
  "copy-paste": "admin.flagCopyPaste",
  volume: "admin.flagVolume",
  "new-conversations": "admin.flagNewConversations",
});

export const cx = (...parts: string[]) => parts.join(" ");

export const COUNT = cx(
  "bg-site-accent text-site-on-accent text-[11px] font-bold leading-none",
  "py-[3px] px-1.5 rounded-[9px]"
);
export const NOTE = "block text-site-ink-2 italic mt-0.5";
export const RED = "text-site-accent-dark";
export const TYPE_LABEL = "text-[12px] font-semibold uppercase tracking-[.05em] text-site-muted";
export const TOOLBAR = cx(
  "toolbar items-center",
  "[&_.astryx-selector]:min-h-10 [&_.astryx-selector]:text-[15px] [&_.astryx-selector]:font-normal"
);
export const TILES = "stats boxed [&_.stat-value]:text-[22px]";
export const FACTS = cx(
  "grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[14px] gap-y-1.5 m-0 text-[14px]",
  "[&_dt]:text-site-muted [&_dt]:font-semibold [&_dd]:m-0"
);
export const WHO = "flex items-center gap-[10px]";
export const USER_HEAD = "flex items-center gap-4 mb-[18px] flex-wrap";
export const USER_HEAD_TITLE = "m-0 text-[26px]";
export const USER_HEAD_SUB = "m-[2px_0_0]";
export const PEOPLE = "list-none m-0 p-0";
export const PERSON = cx("flex items-center gap-[10px] py-[7px]", "border-b border-b-site-line last:[border-bottom:0]");
export const QUOTE = cx(
  "m-[0_0_10px] py-2 px-3 border-l-[3px] border-l-site-line bg-site-panel",
  "whitespace-pre-wrap wrap-anywhere max-h-[200px] overflow-auto"
);
export const PICKED_BG = "bg-[light-dark(#fff7f6,#1f2659)]";
export const CHECK = "check items-center text-[14px] m-0";
const BARE_BUTTON = "[background:none] [border:0] p-0 [font:inherit] cursor-pointer";
export const LINKISH = `${BARE_BUTTON} text-site-link text-left hover:underline`;

const FIELD_MIN = cx(
  "[&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px]",
  "[&_.astryx-text-input]:min-w-[170px]"
);
export const FILTERBAR = cx(
  "flex flex-wrap items-center gap-[10px] mb-[14px] max-[860px]:*:flex-[1_1_160px]",
  FIELD_MIN
);
const SEARCH_BOX = "[&_.search-field]:h-10 [&_.search-go]:w-[42px] [&_.search-go]:text-[16px]";
export const SEARCH = `${SEARCH_BOX} min-w-[260px] flex-[0_1_340px] max-[860px]:min-w-0`;
export const WIDE_SEARCH = `${SEARCH_BOX} flex-1 min-w-0`;

const LIST_BASE = "list-none m-0 p-0 [&>li]:border-b [&>li]:border-b-site-line [&>li_p]:m-[0_0_4px]";
export const LIST = `${LIST_BASE} [&>li]:py-3`;
export const COMPACT_LIST = cx(
  LIST_BASE,
  "[&>li]:flex [&>li]:justify-between [&>li]:gap-x-[14px] [&>li]:gap-y-1.5 [&>li]:flex-wrap",
  "[&>li]:py-2 [&>li]:text-[14px]"
);

export const SCROLL = "overflow-x-auto mb-[14px]";
const TABLE_BASE = cx(
  "w-full border-collapse text-[14px]",
  "[&_th]:text-left [&_th]:text-[12px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em]",
  "[&_th]:text-site-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-b-site-line",
  "[&_th]:whitespace-nowrap [&_td]:border-b [&_td]:border-b-site-line",
  "[&_.num]:text-right [&_.num]:tabular-nums"
);
export const TABLE = `${TABLE_BASE} [&_td]:p-2 [&_td]:align-middle`;
export const LOG_TABLE = `${TABLE_BASE} [&_td]:p-2 [&_td]:align-top`;
export const COMPACT_TABLE = `${TABLE_BASE} [&_td]:p-1.5 [&_td]:align-top`;
export const PICKED_ROW = "[&_td]:bg-[light-dark(#fff7f6,#1f2659)]";
const SORT_BUTTON = cx(
  BARE_BUTTON,
  "[color:inherit] [text-transform:inherit] tracking-[inherit] [&_.ico]:ml-1 [&_.ico]:size-[.85em]"
);
export const sortButton = (on: boolean) => cx(SORT_BUTTON, on ? "text-site-ink" : "hover:text-site-ink");

const WARN_TONE = "bg-[light-dark(#fff2d9,#2a2718)] text-[light-dark(#7a4b00,#ffd98a)]";
const INK_TONE = "bg-site-ink text-site-bg";
const PLAIN_TONE = "bg-(--fill) text-site-ink";
const TAG = "text-[11px] font-bold uppercase tracking-[.05em] px-[7px] rounded-[3px]";

const BADGE_TONE: Record<string, string> = {
  admin: "bg-site-accent text-site-on-accent",
  moderator: "bg-[light-dark(#1f4396,#3d50e0)] text-white",
  bad: INK_TONE,
  warn: WARN_TONE,
};
const BADGE = `inline-block align-middle ml-1.5 [td_&:first-child]:ml-0 py-px ${TAG}`;
export function Badge({ tone = "", children }: { tone?: string; children: ReactNode }) {
  return <span className={`${BADGE} ${BADGE_TONE[tone] ?? PLAIN_TONE}`}>{children}</span>;
}

const CATALOGUE_TONE = "bg-[light-dark(#e4f4ea,#16302e)] text-[light-dark(#1b5e33,#8fdcaa)]";
const ACT_TONE: Record<string, string> = {
  user: "bg-[light-dark(#fde8e6,#3a1e34)] text-[light-dark(#9c1c12,#ffab9c)]",
  report: "bg-[light-dark(#e8eefc,#232c78)] text-[light-dark(#1f4396,#dfe3ff)]",
  wiki: WARN_TONE,
  shout: WARN_TONE,
  journal: WARN_TONE,
  catalogue: CATALOGUE_TONE,
  tag: CATALOGUE_TONE,
  settings: INK_TONE,
};
const ACT = `inline-block py-0.5 [border:0] whitespace-nowrap ${TAG}`;
export const act = (group: string) => `${ACT} ${ACT_TONE[group] ?? PLAIN_TONE}`;
export const actButton = (group: string) => `${act(group)} cursor-pointer hover:brightness-95`;

export function StatusBadges({
  u,
}: {
  u: { role: Role; banned: boolean; suspended: boolean; unconfirmed?: boolean; probation?: boolean };
}) {
  return (
    <>
      {u.role !== "user" && <Badge tone={u.role}>{roleLabel(u.role)}</Badge>}
      {u.banned && <Badge tone="bad">{t("admin.banned")}</Badge>}
      {u.suspended && !u.banned && <Badge tone="warn">{t("admin.suspended")}</Badge>}
      {u.unconfirmed && !u.banned && <Badge>{t("admin.unconfirmed")}</Badge>}
      {u.probation && !u.banned && <Badge>{t("admin.probation")}</Badge>}
    </>
  );
}
