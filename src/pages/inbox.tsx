import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ago, api, useApi, useAuth, userUrl, useTitle } from "../lib";
import type { Notifications, NotificationsRead } from "../../shared/notifications";
import { Async, Avatar, Empty } from "../ui/base";

// ---------- inbox ----------
/** A notification's `data` is free-form JSON: read a text field from it, or "" when it isn't text. */
const text = (v: unknown) => (typeof v === "string" ? v : "");
export function Inbox() {
  const q = useApi<Notifications>("/notifications"), { me, refresh } = useAuth();
  useTitle("Inbox");
  useEffect(() => { if (q.data?.items.some(n => !n.read)) api<NotificationsRead>("/notifications/read", { body: {} }).then(refresh); }, [q.data]);
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Inbox</h1>
      <Async q={q}>{d => d.items.length ? (
        <ul className="feed">{d.items.map(n => (
          <li key={n.id} className={n.read ? "" : "unread"}>
            {n.actor.username ? <Avatar user={{ username: n.actor.username, image: n.actor.image }} /> : <span className="avatar" />}
            <div className="grow">
              {n.type === "comment" ? <span><Link className="strong inline" to={n.actor.username ? userUrl(n.actor.username) : "#"}>{n.actor.username || "Someone"}</Link> commented on <Link to={`${userUrl(me!.username)}/journal/${String(n.data.journalId)}`}>{text(n.data.title)}</Link>{text(n.data.body) && <>: <span className="muted">“{text(n.data.body)}”</span></>}</span>
                : n.type === "follow" ? <span><Link className="strong inline" to={n.actor.username ? userUrl(n.actor.username) : "#"}>{n.actor.username}</Link> started following you.</span>
                : <span><Link className="strong inline" to={n.actor.username ? userUrl(n.actor.username) : "#"}>{n.actor.username || "Someone"}</Link> wrote on <Link to={`${userUrl(me!.username)}/wall`}>your wall</Link>{text(n.data.body) && <>: <span className="muted">“{text(n.data.body)}”</span></>}</span>}
            </div>
            <span className="muted small nowrap">{ago(n.createdAt)}</span>
          </li>
        ))}</ul>
      ) : <Empty>Nothing yet. Follows and posts on your wall will show up here.</Empty>}</Async>
    </div>
  );
}
