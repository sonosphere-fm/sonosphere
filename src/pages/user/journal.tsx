import { Ico } from "../../icons";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../kit";
import { Markdown, MdEditor, plainMd } from "../../md";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ago, api, date, dateTime, invalidateAll, plural, qs, useApi, userUrl } from "../../lib";
import { Async, Avatar, Empty, Pager, Section, useAction } from "../../ui/base";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import type { JournalDeleted, JournalList, JournalPost as JournalPostData, JournalSaved } from "../../../shared/journals";

// ---------- journal ----------
export function Journal({ name, mine }: { name: string; mine: boolean }) {
  const [sp] = useSearchParams(), page = Number(sp.get("page")) || 1, base = `${userUrl(name)}/journal`;
  const q = useApi<JournalList>(`/user/journal${qs({ name, page })}`);
  return (
    <div className="narrow-col">
      {mine && <div className="toolbar"><h2>Your journal</h2><Button kind="btn" href={`${base}/new`}><Ico.Plus /> Write a post</Button></div>}
      <Async q={q}>{d => d.items.length ? (
        <>
          <ul className="journal-list">{d.items.map(j => (
            <li key={j.id}>
              <h3><Link to={`${base}/${j.id}`}>{j.title}</Link></h3>
              <p className="muted small">{date(j.createdAt)} · {plural(j.comments, "comment")}</p>
              <p className="prose">{plainMd(j.excerpt)}</p>
              <Link to={`${base}/${j.id}`}>Read post <Ico.Right /></Link>
            </li>
          ))}</ul>
          <Pager total={d.total} limit={d.limit} />
        </>
      ) : <Empty>{mine ? "You haven't written anything yet. A journal is for longer thoughts: gig write-ups, lists, what you've had on repeat." : `${name} hasn't written any journal posts yet.`}</Empty>}</Async>
    </div>
  );
}
export function JournalPost({ name, id, mine }: { name: string; id: number; mine: boolean }) {
  const q = useApi<JournalPostData>(`/journal/${id}`), nav = useNavigate(), base = `${userUrl(name)}/journal`;
  const [confirm, setConfirm] = useState(false), act = useAction();
  return (
    <Async q={q}>{j => (
      <article className="narrow-col journal-post">
        <p><Link to={base}><Ico.Left /> {name}'s journal</Link></p>
        <h1 className="page-title">{j.title}</h1>
        <p className="muted small journal-by"><Avatar user={j.author} size={28} /> <Link to={userUrl(j.author.username)}>{j.author.username}</Link> · <span title={dateTime(j.createdAt)}>{date(j.createdAt)}</span>{j.updatedAt > j.createdAt + 60 && <> · edited {ago(j.updatedAt)}</>}</p>
        <Markdown text={j.body} />
        <div className="row">
          {mine ? <>
            <Button kind="btn ghost small" href={`${base}/${id}/edit`}>Edit</Button>
            {confirm ? <><Button kind="btn danger small" type="button" loading={act.busy} onClick={() => act.run(async () => { await api<JournalDeleted>(`/journal/${id}`, { method: "DELETE" }); invalidateAll(); nav(base); })}>Delete this post</Button><Button kind="link small" type="button" onClick={() => setConfirm(false)}>Keep it</Button></>
              : <Button kind="btn ghost small" type="button" onClick={() => setConfirm(true)}>Delete</Button>}
          </> : <ReportButton type="journal" id={id} label="Report this post" />}
        </div>
        {act.note}
        <Section title={`Comments (${j.comments})`}><Shoutbox type="journal" id={id} word="comment" /></Section>
      </article>
    )}</Async>
  );
}
export function JournalEditor({ name, id }: { name: string; id?: number }) {
  const q = useApi<JournalPostData>(id ? `/journal/${id}` : null), nav = useNavigate(), base = `${userUrl(name)}/journal`;
  const [f, setF] = useState<{ title: string; body: string } | null>(id ? null : { title: "", body: "" }), act = useAction();
  useEffect(() => { if (id && q.data && !f) setF({ title: q.data.title, body: q.data.body }); }, [q.data]);
  if (id && q.error) return <Empty>That post doesn't exist.</Empty>;
  if (!f) return null;
  const save = (e: FormEvent) => { e.preventDefault(); act.run(async () => { const r = await api<JournalSaved>(id ? `/journal/${id}` : "/journal", { method: id ? "PATCH" : "POST", body: f }); invalidateAll(); nav(`${base}/${r.id}`); }); };
  return (
    <form className="form narrow-col journal-form" onSubmit={save}>
      <h2>{id ? "Edit post" : "New journal post"}</h2>
      <label>Title<Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={120} required autoFocus={!id} /></label>
      <div className="field-block"><span className="field-label">Post</span><MdEditor label="Post" rows={16} value={f.body} onChange={body => setF(f => ({ ...f!, body }))} maxLength={20000} /></div>
      <p className="muted small">Plain text; blank lines separate paragraphs. Journal posts are public.</p>
      {act.note}
      <div className="row"><Button kind="btn" loading={act.busy}>{id ? "Save changes" : "Publish"}</Button><Button kind="btn ghost" href={id ? `${base}/${id}` : base}>Cancel</Button></div>
    </form>
  );
}
