import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ago, api, useApi, useAuth, userUrl, useTitle } from "../lib";
import type { Notification, Notifications, NotificationsRead } from "../../shared/notifications";
import { Async, Avatar, Empty } from "../ui/base";
import { UserLabels } from "../ui/user-labels";

// `data` is free-form JSON, so anything that isn't a string reads as empty.
const text = (v: unknown) => (typeof v === "string" ? v : "");

function Quote({ body }: { body: string }) {
  if (!body) return null;
  return <>: <span className="text-muted">“{body}”</span></>;
}

function Message({ n, me }: { n: Notification; me: string }) {
  const actor = (
    <><Link className="font-semibold inline" to={n.actor.username ? userUrl(n.actor.username) : "#"}>
      {n.type === "follow" ? n.actor.username : n.actor.username || "Someone"}
    </Link>{n.actor.username && <UserLabels name={n.actor.username} />}</>
  );
  if (n.type === "comment") {
    return (
      <span>
        {actor} commented on <Link to={`${userUrl(me)}/journal/${String(n.data.journalId)}`}>{text(n.data.title)}</Link>
        <Quote body={text(n.data.body)} />
      </span>
    );
  }
  if (n.type === "follow") return <span>{actor} started following you.</span>;
  return (
    <span>
      {actor} wrote on <Link to={`${userUrl(me)}/wall`}>your wall</Link>
      <Quote body={text(n.data.body)} />
    </span>
  );
}

export function Inbox() {
  const q = useApi<Notifications>("/notifications");
  const { me, refresh } = useAuth();
  useTitle("Inbox");

  useEffect(() => {
    if (q.data?.items.some(n => !n.read)) {
      api<NotificationsRead>("/notifications/read", { body: {} }).then(refresh);
    }
  }, [q.data]);

  return (
    <div className="w-full mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 max-w-[560px] [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
      <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Inbox</h1>
      <Async q={q}>
        {d => d.items.length ? (
          <ul className="list-none m-0 p-0 [&_li]:flex [&_li]:gap-3 [&_li]:items-center [&_li]:py-2.5 [&_li]:border-b [&_li]:border-line [&_.item-text>*]:block [&_.item-text>*]:overflow-hidden [&_.item-text>*]:text-ellipsis [&_li.unread]:bg-accent-faint [&_li.unread]:border-l-[3px] [&_li.unread]:border-l-accent [&_li.unread]:pl-2.5">
            {d.items.map(n => (
              <li key={n.id} className={n.read ? "" : "unread"}>
                {n.actor.username
                  ? <Avatar user={{ username: n.actor.username, image: n.actor.image }} />
                  : <span className="avatar block flex-none overflow-hidden rounded-full bg-panel" />}
                <div className="item-text flex-1 min-w-0"><Message n={n} me={me!.username} /></div>
                <span className="text-muted text-[13px] whitespace-nowrap">{ago(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing yet. Follows and posts on your wall will show up here.</Empty>
        )}
      </Async>
    </div>
  );
}
