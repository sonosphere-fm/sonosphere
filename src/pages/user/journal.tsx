import { Ico } from "../../icons";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../kit";
import { Markdown, MdEditor, plainMd } from "../../md";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ago, api, date, dateTime, invalidateAll, plural, qs, useApi, userUrl } from "../../lib";
import { Async, Avatar, Empty, Pager, Section, useAction } from "../../ui/base";
import { UserLabels } from "../../ui/user-labels";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import type { JournalDeleted, JournalList, JournalPost as JournalPostData, JournalSaved } from "../../../shared/journals";

export function Journal({ name, mine }: { name: string; mine: boolean }) {
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const base = `${userUrl(name)}/journal`;
  const q = useApi<JournalList>(`/user/journal${qs({ name, page })}`);
  const empty = mine
    ? "You haven't written anything yet. A journal is for longer thoughts: gig write-ups, lists, what you've had on repeat."
    : `${name} hasn't written any journal posts yet.`;
  return (
    <div className="max-w-[640px]">
      {mine && (
        <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
          <h2>Your journal</h2>
          <Button kind="btn" href={`${base}/new`}><Ico.Plus /> Write a post</Button>
        </div>
      )}
      <Async q={q}>
        {d => d.items.length ? (
          <>
            <ul className="list-none m-0 p-0 [&_li]:py-[18px] [&_li]:border-b [&_li]:border-line [&_li:first-child]:pt-0 [&_h3]:m-0 [&_h3]:mb-0.5 [&_h3]:text-[22px] [&_p]:m-0 [&_p]:mb-2">
              {d.items.map(j => (
                <li key={j.id}>
                  <h3><Link to={`${base}/${j.id}`}>{j.title}</Link></h3>
                  <p className="text-muted text-[13px]">{date(j.createdAt)} · {plural(j.comments, "comment")}</p>
                  <p className="prose max-w-[68ch] leading-[1.6] whitespace-pre-line [&_a]:text-link [&_a:hover]:underline">{plainMd(j.excerpt)}</p>
                  <Link to={`${base}/${j.id}`}>Read post <Ico.Right /></Link>
                </li>
              ))}
            </ul>
            <Pager total={d.total} limit={d.limit} />
          </>
        ) : (
          <Empty>{empty}</Empty>
        )}
      </Async>
    </div>
  );
}

export function JournalPost({ name, id, mine }: { name: string; id: number; mine: boolean }) {
  const q = useApi<JournalPostData>(`/journal/${id}`);
  const nav = useNavigate();
  const base = `${userUrl(name)}/journal`;
  const [confirm, setConfirm] = useState(false);
  const act = useAction();

  const remove = () => act.run(async () => {
    await api<JournalDeleted>(`/journal/${id}`, { method: "DELETE" });
    invalidateAll();
    nav(base);
  });

  let deleteControls;
  if (confirm) {
    deleteControls = (
      <>
        <Button kind="btn danger small" type="button" loading={act.busy} onClick={remove}>Delete this post</Button>
        <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => setConfirm(false)}>Keep it</Button>
      </>
    );
  } else {
    deleteControls = <Button kind="btn ghost small" type="button" onClick={() => setConfirm(true)}>Delete</Button>;
  }

  return (
    <Async q={q}>{j => (
      <article className="max-w-[640px] [&_.prose]:text-[17px] [&_.prose]:leading-[1.6] [&_.prose]:my-[18px] [&_.prose]:mb-[22px] [&_.row]:mb-7">
        <p><Link to={base}><Ico.Left /> {name}'s journal</Link></p>
        <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">{j.title}</h1>
        <p className="text-muted text-[13px] flex items-center gap-1.5 flex-wrap">
          <Avatar user={j.author} size={28} /> <Link to={userUrl(j.author.username)}>{j.author.username}</Link> <UserLabels name={j.author.username} /> ·{" "}
          <span title={dateTime(j.createdAt)}>{date(j.createdAt)}</span>
          {j.updatedAt > j.createdAt + 60 && <> · edited {ago(j.updatedAt)}</>}
        </p>
        <Markdown text={j.body} />
        <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
          {mine ? (
            <>
              <Button kind="btn ghost small" href={`${base}/${id}/edit`}>Edit</Button>
              {deleteControls}
            </>
          ) : (
            <ReportButton type="journal" id={id} label="Report this post" />
          )}
        </div>
        {act.note}
        <Section title={`Comments (${j.comments})`}><Shoutbox type="journal" id={id} word="comment" /></Section>
      </article>
    )}</Async>
  );
}

export function JournalEditor({ name, id }: { name: string; id?: number }) {
  const q = useApi<JournalPostData>(id ? `/journal/${id}` : null);
  const nav = useNavigate();
  const base = `${userUrl(name)}/journal`;
  const [f, setF] = useState<{ title: string; body: string } | null>(id ? null : { title: "", body: "" });
  const act = useAction();

  useEffect(() => {
    if (id && q.data && !f) setF({ title: q.data.title, body: q.data.body });
  }, [q.data]);

  if (id && q.error) return <Empty>That post doesn't exist.</Empty>;
  if (!f) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<JournalSaved>(id ? `/journal/${id}` : "/journal", { method: id ? "PATCH" : "POST", body: f });
      invalidateAll();
      nav(`${base}/${r.id}`);
    });
  };

  return (
    <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full max-w-[640px] journal-form" onSubmit={save}>
      <h2>{id ? "Edit post" : "New journal post"}</h2>
      <label>Title<Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={120} required autoFocus={!id} /></label>
      <div className="flex flex-col gap-1 w-full">
        <span className="font-semibold text-sm">Post</span>
        <MdEditor label="Post" rows={16} value={f.body} onChange={body => setF(f => ({ ...f!, body }))} maxLength={20000} />
      </div>
      {act.note}
      <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
        <Button kind="btn" loading={act.busy}>{id ? "Save changes" : "Publish"}</Button>
        <Button kind="btn ghost" href={id ? `${base}/${id}` : base}>Cancel</Button>
      </div>
    </form>
  );
}
