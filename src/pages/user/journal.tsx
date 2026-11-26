import { Ico } from "../../icons";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../../kit";
import { Markdown, MdEditor, plainMd } from "../../md";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ago, api, date, dateTime, invalidateAll, qs, useApi, userUrl } from "../../lib";
import { t } from "../../i18n";
import { Async, Avatar, Empty, Pager, Section, useAction } from "../../ui/base";
import { UserLabels } from "../../ui/user-labels";
import { Username } from "../../ui/username";
import { ReportButton, Shoutbox } from "../../ui/shoutbox";
import type {
  JournalDeleted,
  JournalList,
  JournalPost as JournalPostData,
  JournalSaved,
} from "../../../shared/journals";

export function Journal({ name, mine }: { name: string; mine: boolean }) {
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const base = `${userUrl(name)}/journal`;
  const q = useApi<JournalList>(`/user/journal${qs({ name, page })}`);
  const empty = mine ? t("user.journalEmptyMine") : t("user.journalEmpty", { name });
  return (
    <div className="narrow-col">
      {mine && (
        <div className="toolbar">
          <h2>{t("user.yourJournal")}</h2>
          <Button kind="btn" href={`${base}/new`}>
            <Ico.Plus /> {t("user.writePost")}
          </Button>
        </div>
      )}
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <>
              <ul className="journal-list">
                {d.items.map((j) => (
                  <li key={j.id}>
                    <h3>
                      <Link to={`${base}/${j.id}`}>{j.title}</Link>
                    </h3>
                    <p className="muted small">
                      {date(j.createdAt)} · {t("user.commentCount", { count: j.comments })}
                    </p>
                    <p className="prose">{plainMd(j.excerpt)}</p>
                    <Link to={`${base}/${j.id}`}>
                      {t("user.readPost")} <Ico.Right />
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager total={d.total} limit={d.limit} />
            </>
          ) : (
            <Empty>{empty}</Empty>
          )
        }
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

  const remove = () =>
    act.run(async () => {
      await api<JournalDeleted>(`/journal/${id}`, { method: "DELETE" });
      invalidateAll();
      nav(base);
    });

  let deleteControls;
  if (confirm) {
    deleteControls = (
      <>
        <Button kind="btn danger small" type="button" loading={act.busy} onClick={remove}>
          {t("user.deleteThisPost")}
        </Button>
        <Button kind="link small" type="button" onClick={() => setConfirm(false)}>
          {t("user.keepIt")}
        </Button>
      </>
    );
  } else {
    deleteControls = (
      <Button kind="btn ghost small" type="button" onClick={() => setConfirm(true)}>
        {t("user.delete")}
      </Button>
    );
  }

  return (
    <Async q={q}>
      {(j) => (
        <article className="narrow-col journal-post">
          <p>
            <Link to={base}>
              <Ico.Left /> {t("user.nameJournal", { name })}
            </Link>
          </p>
          <h1 className="page-title">{j.title}</h1>
          <p className="muted small journal-by">
            <Avatar user={j.author} size={28} />{" "}
            <Link to={userUrl(j.author.username)}>
              <Username user={j.author} />
            </Link>{" "}
            <UserLabels name={j.author.username} /> · <span title={dateTime(j.createdAt)}>{date(j.createdAt)}</span>
            {j.updatedAt > j.createdAt + 60 && <> · {t("user.editedAgo", { ago: ago(j.updatedAt) })}</>}
          </p>
          <Markdown text={j.body} />
          <div className="row">
            {mine ? (
              <>
                <Button kind="btn ghost small" href={`${base}/${id}/edit`}>
                  {t("user.edit")}
                </Button>
                {deleteControls}
              </>
            ) : (
              <ReportButton type="journal" id={id} label={t("user.reportThisPost")} />
            )}
          </div>
          {act.note}
          <Section title={t("user.commentsTitle", { count: j.comments })}>
            <Shoutbox type="journal" id={id} word="comment" />
          </Section>
        </article>
      )}
    </Async>
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

  if (id && q.error) return <Empty>{t("user.postMissing")}</Empty>;
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
    <form className="form narrow-col journal-form" onSubmit={save}>
      <h2>{id ? t("user.editPost") : t("user.newJournalPost")}</h2>
      <label>
        {t("user.title")}
        <Input
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          maxLength={120}
          required
          autoFocus={!id}
        />
      </label>
      <div className="field-block">
        <span className="field-label">{t("user.post")}</span>
        <MdEditor
          label={t("user.post")}
          rows={16}
          value={f.body}
          onChange={(body) => setF((f) => ({ ...f!, body }))}
          maxLength={20000}
        />
      </div>
      {act.note}
      <div className="row">
        <Button kind="btn" loading={act.busy}>
          {id ? t("user.saveChanges") : t("user.publish")}
        </Button>
        <Button kind="btn ghost" href={id ? `${base}/${id}` : base}>
          {t("user.cancel")}
        </Button>
      </div>
    </form>
  );
}
