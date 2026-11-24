import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Ico } from "../icons";
import { t, tx } from "../i18n";
import { useAuth, useLive } from "../lib";
import { groupName } from "../dm";
import { Avatar } from "./base";
import { NoticeText } from "./notice";
import { Username } from "./username";
import type { DmUser } from "../../shared/dm";

type Toast = { id: string; user: { username: string; image: string | null }; to?: string; body: ReactNode };

const MAX = 3;
const SHOWN_MS = 6000;

function message(from: DmUser, body: string, where?: string) {
  const name = (
    <b>
      <Username user={from} />
    </b>
  );
  return (
    <>
      <span>{where ? tx("messages.hudInGroup", { name, group: where }) : name}</span>
      <span className="muted">{body}</span>
    </>
  );
}

export function Hud() {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = (toast: Toast) => {
    if (toast.to === pathname) return;
    setToasts((v) => [...v.filter((x) => x.id !== toast.id), toast].slice(-MAX));
  };
  const drop = (id: string) => setToasts((v) => v.filter((x) => x.id !== id));

  useLive((e) => {
    if (!me?.notifyPopups) return;
    if (e.t === "notification") {
      const n = e.notification;
      if (!n.actor.username || pathname === "/inbox") return;
      add({
        id: `n${n.id}`,
        user: { username: n.actor.username, image: n.actor.image },
        body: <NoticeText n={n} me={me.username} />,
      });
    } else if (e.t === "dm" && e.message.from !== me.id) {
      add({
        id: `d${e.message.id}`,
        user: e.thread.user,
        to: `/messages/${e.thread.id}`,
        body: message(e.thread.user, e.message.body),
      });
    } else if (e.t === "dm-group" && e.message.from !== me.id && !e.message.event) {
      const from = e.group.members.find((m) => m.id === e.message.from);
      if (!from) return;
      add({
        id: `g${e.message.id}`,
        user: from,
        to: `/messages/g/${e.group.id}`,
        body: message(from, e.message.body, groupName(e.group, me.id)),
      });
    }
  });

  if (!toasts.length) return null;
  return (
    <ol className="hud" aria-live="polite">
      {toasts.map((toast) => (
        <HudItem key={toast.id} toast={toast} onDone={() => drop(toast.id)} />
      ))}
    </ol>
  );
}

function HudItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [held, setHeld] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => done.current(), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [held]);
  // following any link in it is as good as reading it
  const onClick = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("a")) onDone();
  };
  return (
    <li
      className="hud-item"
      onClick={onClick}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <Avatar user={toast.user} size={32} plain />
      {toast.to ? (
        <Link className="hud-body" to={toast.to}>
          {toast.body}
        </Link>
      ) : (
        <div className="hud-body">{toast.body}</div>
      )}
      <button type="button" className="hud-x" aria-label={t("music.dismiss")} onClick={onDone}>
        <Ico.X />
      </button>
    </li>
  );
}
