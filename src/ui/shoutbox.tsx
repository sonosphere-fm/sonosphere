import { Ico } from "../icons";
import { useState, type FormEvent } from "react";
import { Button, Modal, Select, Textarea } from "../kit";
import { Link } from "react-router-dom";
import { ago, api, dateTime, qs, useApi, useAuth, userUrl } from "../lib";
import { Empty, Async, useAction, Avatar } from "./base";
import { cn, row, form, formError, formOk, linkBtn } from "./tw";
import { UserLabels } from "./user-labels";
import type { ItemType } from "../../shared/catalog";
import type { ReportOk } from "../../shared/reports";
import type { ShoutDeleted, ShoutList, ShoutPosted } from "../../shared/shouts";

const REASONS: [string, string][] = [
  ["spam", "Spam or advertising"],
  ["abuse", "Harassment or abuse"],
  ["inappropriate", "Offensive or inappropriate"],
  ["impersonation", "Impersonation"],
  ["other", "Something else"],
];

export function ReportButton({ type, id, label = "Report", open: forced, onClose }: {
  type: "shout" | "wiki" | "journal" | "user" | "dm" | "group";
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
      {forced === undefined && <Button kind="small" className={linkBtn} type="button" onClick={() => setOpen(true)}>{label}</Button>}
      {shown && (
        <Modal title="Report to moderators" onClose={close}>
          {sent ? (
            <div className={form}>
              <p>Thanks. A moderator will take a look.</p>
              <Button kind="btn" type="button" onClick={close}>Done</Button>
            </div>
          ) : (
            <form className={form} onSubmit={submit}>
              {(type === "dm" || type === "group") && (
                <p className="text-muted text-[13px]">Moderators will see the reported message and a few around it. {type === "dm" ? "The other person isn't notified." : "No one in the group is notified."}</p>
              )}
              <label>Reason<Select label="Reason" value={reason} onChange={setReason} options={REASONS} /></label>
              <label>
                Additional details
                <Textarea rows={3} placeholder="Optional" value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} />
              </label>
              {act.note}
              <Button kind="btn" loading={act.busy}>Submit report</Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
export function Shoutbox({ type, id, limit = 20, word = "post" }: {
  type: ItemType;
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
  const remove = (shoutId: number) => api<ShoutDeleted>(`/shouts/${shoutId}`, { method: "DELETE" }).then(q.reload);
  let compose;
  if (q.data?.enabled === false) {
    compose = <p className="text-muted">This wall is turned off.</p>;
  } else if (me) {
    compose = (
      <form onSubmit={post} className="flex gap-2.5 items-start mb-2">
        <Avatar user={me} />
        <Textarea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={wall ? "Write on the wall…" : "Leave a comment…"}
          aria-label={`Your ${word}`}
          maxLength={1000}
        />
        <Button kind="btn" loading={act.busy} disabled={!text.trim()}>{wall ? "Post" : "Comment"}</Button>
      </form>
    );
  } else {
    compose = <p className="text-muted"><Link to="/login">Log in</Link> to {wall ? "write on the wall" : "leave a comment"}.</p>;
  }
  return (
    <div className="shoutbox">
      {compose}
      {act.note}
      <Async q={q}>{d => (
        <>
          {d.items.length === 0 && <Empty>{wall ? "No posts yet." : "No comments yet."} Be the first.</Empty>}
          <ul className="list-none m-0 p-0">
            {d.items.map(s => (
              <li key={s.id} className="flex gap-3 items-start py-2.5 border-b border-line">
                <Avatar user={s.author} />
                <div className="flex-1 min-w-0">
                  <div>
                    <Link className="font-semibold" to={userUrl(s.author.username)}>{s.author.username}</Link> <UserLabels name={s.author.username} />{" "}
                    <span className="text-muted text-[13px]" title={dateTime(s.createdAt)}>{ago(s.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 mb-0 whitespace-pre-line wrap-anywhere">{s.body}</p>
                </div>
                <span className="inline-flex gap-2.5 whitespace-nowrap">
                  {me && me.username !== s.author.username && <ReportButton type="shout" id={s.id} />}
                  {me && (me.username === s.author.username || d.canModerate) && (
                    <Button kind="small" className={linkBtn} onClick={() => remove(s.id)}>Delete</Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {d.total > limit && (
            <div className={row}>
              <Button kind="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}><Ico.Left /> Newer</Button>
              <Button kind="btn ghost small" disabled={page * limit >= d.total} onClick={() => setPage(page + 1)}>Older <Ico.Right /></Button>
            </div>
          )}
        </>
      )}</Async>
    </div>
  );
}
