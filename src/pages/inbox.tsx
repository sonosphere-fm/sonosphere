import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ago, api, useApi, useAuth, userUrl, useTitle } from "../lib";
import type { Notification, Notifications, NotificationsRead } from "../../shared/notifications";
import { Async, Avatar, Empty } from "../ui/base";
import { UserLabels } from "../ui/user-labels";
import { t, tx } from "../i18n";

// `data` is free-form JSON, so anything that isn't a string reads as empty.
const text = (v: unknown) => (typeof v === "string" ? v : "");

function Quote({ body }: { body: string }) {
  if (!body) return null;
  return (
    <>
      : <span className="muted">“{body}”</span>
    </>
  );
}

function Message({ n, me }: { n: Notification; me: string }) {
  const actor = (
    <>
      <Link className="strong inline" to={n.actor.username ? userUrl(n.actor.username) : "#"}>
        <Username user={n.actor} name={n.actor.username || t("messages.someone")} />
      </Link>
      {n.actor.username && <UserLabels name={n.actor.username} />}
    </>
  );
  if (n.type === "comment") {
    return (
      <span>
        {tx(n.data.reply ? "messages.notifyCommentReply" : "messages.notifyComment", {
          actor,
          title: (
            <Link to={`${userUrl(text(n.data.journalUsername) || me)}/journal/${String(n.data.journalId)}`}>
              {text(n.data.title)}
            </Link>
          ),
        })}
        <Quote body={text(n.data.body)} />
      </span>
    );
  }
  if (n.type === "follow") return <span>{tx("messages.notifyFollow", { actor })}</span>;
  return (
    <span>
      {tx(n.data.reply ? "messages.notifyWallReply" : "messages.notifyWall", {
        actor,
        wall: (
          <Link to={`${userUrl(text(n.data.wallUsername) || me)}/wall`}>
            {n.data.reply ? t("messages.aWall") : t("messages.yourWall")}
          </Link>
        ),
      })}
      <Quote body={text(n.data.body)} />
    </span>
  );
}

export function Inbox() {
  const q = useApi<Notifications>("/notifications");
  const { me, refresh } = useAuth();
  useTitle(t("messages.inbox"));

  useEffect(() => {
    if (q.data?.items.some((n) => !n.read)) {
      api<NotificationsRead>("/notifications/read", { body: {} }).then(refresh);
    }
  }, [q.data]);

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("messages.inbox")}</h1>
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <ul className="feed">
              {d.items.map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>
                  {n.actor.username ? (
                    <Avatar user={{ username: n.actor.username, image: n.actor.image }} />
                  ) : (
                    <span className="avatar" />
                  )}
                  <div className="grow">
                    <Message n={n} me={me!.username} />
                  </div>
                  <span className="muted small nowrap">{ago(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("messages.inboxEmpty")}</Empty>
          )
        }
      </Async>
    </div>
  );
}
import { Username } from "../ui/username";
