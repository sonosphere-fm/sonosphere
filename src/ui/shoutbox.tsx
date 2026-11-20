import { Ico } from "../icons";
import { useState, type FormEvent } from "react";
import { Button, Modal, Select, Textarea } from "../kit";
import { Link } from "react-router-dom";
import { ago, api, dateTime, qs, useApi, useAuth, userUrl } from "../lib";
import { Empty, Async, useAction, Avatar } from "./base";
import type { ItemType } from "../../shared/catalog";
import type { ReportOk } from "../../shared/reports";
import type { ShoutDeleted, ShoutList, ShoutPosted } from "../../shared/shouts";

// ---------- shoutbox ----------
const REASONS: [string, string][] = [["spam", "Spam or advertising"], ["abuse", "Harassment or abuse"], ["inappropriate", "Offensive or inappropriate"], ["impersonation", "Impersonation"], ["other", "Something else"]];

/** "Report" link that opens a short form. What gets reported: a wall post, a wiki version, a journal post or a profile. */
export function ReportButton({ type, id, label = "Report", open: forced, onClose }: { type: "shout" | "wiki" | "journal" | "user" | "dm"; id: number; label?: string; open?: boolean; onClose?: () => void }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("spam"), [detail, setDetail] = useState(""), [sent, setSent] = useState(false);
  const act = useAction();
  if (!me) return null;
  const shown = forced ?? open, close = () => { setOpen(false); setSent(false); setDetail(""); onClose?.(); };
  return (
    <>
      {forced === undefined && <Button kind="link small" type="button" onClick={() => setOpen(true)}>{label}</Button>}
      {shown && (
        <Modal title="Report to moderators" onClose={close}>
          {sent ? <div className="form"><p>Thanks. A moderator will take a look.</p><Button kind="btn" type="button" onClick={close}>Done</Button></div> : (
            <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<ReportOk>("/reports", { body: { type, id, reason, detail } }); setSent(true); }); }}>
              {type === "dm" && <p className="muted small">Moderators will see the reported message and a few around it. The other person isn't notified.</p>}
              <label>What's wrong with it?<Select label="Reason" value={reason} onChange={setReason} options={REASONS} /></label>
              <label>Anything a moderator should know?<Textarea rows={3} placeholder="Optional" value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} /></label>
              {act.note}
              <Button kind="btn" loading={act.busy}>Send report</Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
export function Shoutbox({ type, id, limit = 20, word = "post" }: { type: ItemType; id: number; limit?: number; word?: "post" | "comment" }) {
  const { me } = useAuth();
  const [page, setPage] = useState(1), [text, setText] = useState("");
  const q = useApi<ShoutList>(`/shouts${qs({ type, id, page, limit })}`);
  const act = useAction();
  const post = (e: FormEvent) => { e.preventDefault(); act.run(async () => { await api<ShoutPosted>("/shouts", { body: { type, id, body: text } }); setText(""); setPage(1); q.reload(); }); };
  return (
    <div className="shoutbox">
      {q.data?.enabled === false ? <p className="muted">This wall is turned off.</p> : me ? (
        <form onSubmit={post} className="shout-form">
          <Avatar user={me} />
          <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={word === "post" ? "Write on the wall…" : "Leave a comment…"} aria-label={`Your ${word}`} maxLength={1000} />
          <Button kind="btn" loading={act.busy} disabled={!text.trim()}>{word === "post" ? "Post" : "Comment"}</Button>
        </form>
      ) : <p className="muted"><Link to="/login">Log in</Link> to {word === "post" ? "write on the wall" : "leave a comment"}.</p>}
      {act.note}
      <Async q={q}>{d => (
        <>
          {d.items.length === 0 && <Empty>{word === "post" ? "Nothing on the wall yet." : "No comments yet."} Be the first.</Empty>}
          <ul className="shouts">
            {d.items.map(s => (
              <li key={s.id}>
                <Avatar user={s.author} />
                <div className="grow">
                  <div><Link className="strong" to={userUrl(s.author.username)}>{s.author.username}</Link> <span className="muted small" title={dateTime(s.createdAt)}>{ago(s.createdAt)}</span></div>
                  <p>{s.body}</p>
                </div>
                <span className="shout-actions">
                  {me && me.username !== s.author.username && <ReportButton type="shout" id={s.id} />}
                  {me && (me.username === s.author.username || d.canModerate) && <Button kind="link small" onClick={() => api<ShoutDeleted>(`/shouts/${s.id}`, { method: "DELETE" }).then(q.reload)}>Delete</Button>}
                </span>
              </li>
            ))}
          </ul>
          {d.total > limit && <div className="row"><Button kind="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}><Ico.Left /> Newer</Button><Button kind="btn ghost small" disabled={page * limit >= d.total} onClick={() => setPage(page + 1)}>Older <Ico.Right /></Button></div>}
        </>
      )}</Async>
    </div>
  );
}
