import { useEffect } from "react";
import { ago, api, useApi, useAuth, useTitle } from "../lib";
import type { Notifications, NotificationsRead } from "../../shared/notifications";
import { Async, Avatar, Empty } from "../ui/base";
import { NoticeText } from "../ui/notice";
import { t } from "../i18n";

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
                    <NoticeText n={n} me={me!.username} />
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
