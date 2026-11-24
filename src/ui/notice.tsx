import { Link } from "react-router-dom";
import { userUrl } from "../lib";
import type { Notification } from "../../shared/notifications";
import { UserLabels } from "./user-labels";
import { Username } from "./username";
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

export function NoticeText({ n, me }: { n: Notification; me: string }) {
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
