import { Ico } from "../icons";
import { useState, type FormEvent } from "react";
import { Button, Modal, Select, Textarea } from "../kit";
import { Link } from "react-router-dom";
import { t, tx } from "../i18n";
import { ago, api, dateTime, qs, useApi, useAuth, userUrl } from "../lib";
import { Empty, Async, useAction, Avatar } from "./base";
import { UserLabels } from "./user-labels";
import type { ReportOk } from "../../shared/reports";
import type { Shout, ShoutDeleted, ShoutList, ShoutPosted, ShoutTarget } from "../../shared/shouts";

const reasons = (): [string, string][] => [
  ["spam", t("messages.reasonSpam")],
  ["abuse", t("messages.reasonAbuse")],
  ["inappropriate", t("messages.reasonInappropriate")],
  ["impersonation", t("messages.reasonImpersonation")],
  ["other", t("messages.reasonOther")],
];

export function ReportButton({
  type,
  id,
  label = t("messages.report"),
  open: forced,
  onClose,
}: {
  type: "shout" | "wiki" | "journal" | "event" | "playlist" | "obsession" | "user" | "dm" | "group";
  id: number;
  label?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const act = useAction();
  if (!me) return null;
  const shown = forced ?? open;
  const close = () => {
    setOpen(false);
    setSent(false);
    setDetail("");
    onClose?.();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<ReportOk>("/reports", { body: { type, id, reason, detail } });
      setSent(true);
    });
  };
  return (
    <>
      {forced === undefined && (
        <Button kind="link small" type="button" onClick={() => setOpen(true)}>
          {label}
        </Button>
      )}
      {shown && (
        <Modal title={t("messages.reportTitle")} onClose={close}>
          {sent ? (
            <div className="form">
              <p>{t("messages.reportThanks")}</p>
              <Button kind="btn" type="button" onClick={close}>
                {t("messages.done")}
              </Button>
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
              {(type === "dm" || type === "group") && (
                <p className="muted small">
                  {type === "dm" ? t("messages.reportContextDm") : t("messages.reportContextGroup")}
                </p>
              )}
              <label>
                {t("messages.reason")}
                <Select label={t("messages.reason")} value={reason} onChange={setReason} options={reasons()} />
              </label>
              <label>
                {t("messages.additionalDetails")}
                <Textarea
                  rows={3}
                  placeholder={t("messages.optional")}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  maxLength={1000}
                />
              </label>
              {act.note}
              <Button kind="btn" loading={act.busy}>
                {t("messages.submitReport")}
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
export function Shoutbox({
  type,
  id,
  limit = 20,
  word = "post",
}: {
  type: ShoutTarget;
  id: number;
  limit?: number;
  word?: "post" | "comment";
}) {
  const { me } = useAuth();
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const q = useApi<ShoutList>(`/shouts${qs({ type, id, page, limit })}`);
  const act = useAction();
  const wall = word === "post";
  const post = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<ShoutPosted>("/shouts", { body: { type, id, body: text } });
      setText("");
      setPage(1);
      q.reload();
    });
  };
  let compose;
  if (q.data?.enabled === false) {
    compose = <p className="muted">{t("messages.wallOff")}</p>;
  } else if (me) {
    compose = (
      <form onSubmit={post} className="flex gap-2.5 items-start mb-2 [&_textarea]:flex-1">
        <Avatar user={me} />
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={wall ? t("messages.writeOnWall") : t("messages.leaveComment")}
          aria-label={wall ? t("messages.yourPost") : t("messages.yourComment")}
          maxLength={1000}
        />
        <Button kind="btn" loading={act.busy} disabled={!text.trim()}>
          {wall ? t("messages.post") : t("messages.comment")}
        </Button>
      </form>
    );
  } else {
    compose = (
      <p className="muted">
        {tx(wall ? "messages.loginToWrite" : "messages.loginToComment", {
          login: <Link to="/login">{t("messages.logIn")}</Link>,
        })}
      </p>
    );
  }
  return (
    <div className="shoutbox">
      {compose}
      {act.note}
      <Async q={q}>
        {(d) => (
          <>
            {d.items.length === 0 && <Empty>{wall ? t("messages.noPostsYet") : t("messages.noCommentsYet")}</Empty>}
            <ul className="shouts">
              {d.items.map((s) => (
                <ShoutThread
                  key={s.id}
                  shout={s}
                  type={type}
                  targetId={id}
                  enabled={d.enabled}
                  canModerate={d.canModerate}
                  reload={q.reload}
                />
              ))}
            </ul>
            {d.total > limit && (
              <div className="row">
                <Button kind="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <Ico.Left /> {t("messages.newer")}
                </Button>
                <Button kind="btn ghost small" disabled={page * limit >= d.total} onClick={() => setPage(page + 1)}>
                  {t("messages.older")} <Ico.Right />
                </Button>
              </div>
            )}
          </>
        )}
      </Async>
    </div>
  );
}
import { Username } from "./username";

function ShoutThread({
  shout: s,
  type,
  targetId,
  enabled,
  canModerate,
  reload,
  depth = 0,
}: {
  shout: Shout;
  type: ShoutTarget;
  targetId: number;
  enabled: boolean;
  canModerate: boolean;
  reload: () => void;
  depth?: number;
}) {
  const { me } = useAuth();
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const act = useAction();
  const replies = useApi<ShoutList>(
    expanded ? `/shouts${qs({ type, id: targetId, parentId: s.id, page, limit: 10 })}` : null
  );
  const refresh = () => {
    reload();
    replies.reload();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (act.busy || !text.trim()) return;
    act.run(async () => {
      await api<ShoutPosted>("/shouts", { body: { type, id: targetId, parentId: s.id, body: text } });
      setText("");
      setReplying(false);
      setExpanded(true);
      setPage(1);
      refresh();
    });
  };
  return (
    <li className="shout-thread" style={{ display: "block" }}>
      <div className="flex gap-3 items-start min-w-0">
        {!s.deleted && <Avatar user={s.author} />}
        <div className="grow min-w-0">
          {!s.deleted && (
            <div>
              <Link className="strong" to={userUrl(s.author.username)}>
                <Username user={s.author} />
              </Link>{" "}
              <UserLabels name={s.author.username} />{" "}
              <span className="muted small" title={dateTime(s.createdAt)}>
                {ago(s.createdAt)}
              </span>
            </div>
          )}
          <p>{s.deleted ? <span className="muted">{t("messages.postDeleted")}</span> : s.body}</p>
          <div className="flex flex-wrap gap-3">
            {me && enabled && (
              <Button type="button" kind="link small" onClick={() => setReplying(!replying)}>
                {t("messages.reply")}
              </Button>
            )}
            {!s.deleted && me && me.username !== s.author.username && <ReportButton type="shout" id={s.id} />}
            {!s.deleted && me && (me.username === s.author.username || canModerate) && (
              <Button
                type="button"
                kind="link small"
                disabled={act.busy}
                onClick={() =>
                  act.run(async () => {
                    await api<ShoutDeleted>(`/shouts/${s.id}`, { method: "DELETE" });
                    reload();
                  })
                }
              >
                {t("messages.delete")}
              </Button>
            )}
            {(s.replyCount > 0 || expanded) && (
              <Button type="button" kind="link small" onClick={() => setExpanded(!expanded)}>
                {expanded ? t("messages.hideReplies") : t("messages.showReplies", { count: s.replyCount })}
              </Button>
            )}
          </div>
          {replying && (
            <form className="form mt-3" onSubmit={submit}>
              <Textarea
                autoFocus
                rows={2}
                aria-label={t("messages.yourReply")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
              />
              <div className="flex gap-3">
                <Button type="submit" loading={act.busy} disabled={!text.trim()}>
                  {t("messages.postReply")}
                </Button>
                <Button type="button" kind="link small" onClick={() => setReplying(false)}>
                  {t("messages.cancel")}
                </Button>
              </div>
            </form>
          )}
          {act.note}
        </div>
      </div>
      {expanded && (
        <div className={depth < 3 ? "ms-3 ps-3 border-s border-site-line mt-3" : "mt-3"}>
          <Async q={replies}>
            {(d) => (
              <>
                <ul className="shouts">
                  {d.items.map((reply) => (
                    <ShoutThread
                      key={reply.id}
                      shout={reply}
                      type={type}
                      targetId={targetId}
                      enabled={d.enabled}
                      canModerate={d.canModerate}
                      reload={refresh}
                      depth={depth + 1}
                    />
                  ))}
                </ul>
                {d.total > 10 && (
                  <div className="row">
                    <Button type="button" kind="link small" disabled={page === 1} onClick={() => setPage(page - 1)}>
                      {t("messages.previousReplies")}
                    </Button>
                    <Button
                      type="button"
                      kind="link small"
                      disabled={page * 10 >= d.total}
                      onClick={() => setPage(page + 1)}
                    >
                      {t("messages.moreReplies")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Async>
        </div>
      )}
    </li>
  );
}
