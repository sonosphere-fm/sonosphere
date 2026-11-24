import { Ico } from "../icons";
import { useState, type FormEvent } from "react";
import { t, tx } from "../i18n";
import { Button } from "../kit";
import { Markdown, MdEditor, plainMd } from "../md";
import { Link } from "react-router-dom";
import { api, date, qs, useApi, useAuth, userUrl } from "../lib";
import { Empty, Async, useAction } from "./base";
import { ReportButton } from "./shoutbox";
import type { ItemType } from "../../shared/catalog";
import type { WikiHistory, WikiSaved, WikiVersion } from "../../shared/wiki";

export function WikiSummary({
  wiki,
  to,
  flush,
}: {
  wiki: Pick<WikiVersion, "content"> | null;
  to: string;
  flush?: boolean;
}) {
  if (!wiki)
    return (
      <p className="muted">
        {t("music.noWikiYet")}{" "}
        <Link to={to}>
          {t("music.startIt")} <Ico.Right />
        </Link>
      </p>
    );
  const plain = plainMd(wiki.content)
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  const short = plain.length > 420;
  const text = short ? plain.slice(0, 420).replace(/\s+\S*$/, "") + "… " : plain + " ";
  return (
    <p className={`max-w-[72ch] leading-[1.6] ${flush ? "m-0" : "mb-[26px]"}`}>
      {text}
      <Link to={to}>
        {short ? t("music.readMore") : t("music.viewWiki")} <Ico.Right />
      </Link>
    </p>
  );
}
export function WikiPage({ type, id, title }: { type: ItemType; id: number; title: string }) {
  const { me } = useAuth();
  const q = useApi<WikiHistory>(`/wiki${qs({ type, id })}`);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  const act = useAction();
  return (
    <Async q={q}>
      {({ versions }) => {
        const current = versions.find((v) => v.version === shown) ?? versions[0];
        const save = (e: FormEvent) => {
          e.preventDefault();
          act.run(async () => {
            await api<WikiSaved>("/wiki", { body: { type, id, content: text } });
            setEditing(false);
            setShown(null);
            q.reload();
          });
        };
        const edit = () => {
          setText(current?.content || "");
          setEditing(true);
        };
        return (
          <div className="cols">
            <div className="main">
              {editing ? (
                <form onSubmit={save} className="form">
                  <div className="field-block">
                    <span className="field-label">{t("music.wikiFor", { title })}</span>
                    <MdEditor
                      label={t("music.wikiFor", { title })}
                      rows={14}
                      value={text}
                      onChange={setText}
                      maxLength={20000}
                      autoFocus
                    />
                  </div>
                  {act.note}
                  <div className="row">
                    <Button kind="btn" loading={act.busy}>
                      {t("music.saveVersion", { version: versions.length ? versions[0].version + 1 : 1 })}
                    </Button>
                    <Button type="button" kind="btn ghost" onClick={() => setEditing(false)}>
                      {t("music.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {current ? <Markdown text={current.content} /> : <Empty>{t("music.noWikiFor", { title })}</Empty>}
                  {current && (
                    <p className="muted small">
                      {tx("music.wikiVersionLine", {
                        version: current.version,
                        author: current.author ? (
                          <Link to={userUrl(current.author)}>
                            <Username name={current.author} />
                          </Link>
                        ) : (
                          t("music.aDeletedUser")
                        ),
                        date: date(current.createdAt),
                      })}
                      {current.author !== me?.username && (
                        <>
                          {" "}
                          · <ReportButton type="wiki" id={current.id} label={t("music.reportVersion")} />
                        </>
                      )}
                    </p>
                  )}
                  {me ? (
                    <div className="mt-5">
                      <Button kind="btn" onClick={edit}>
                        {current ? t("music.editWiki") : t("music.writeWiki")}
                      </Button>
                    </div>
                  ) : (
                    <p>{tx("music.logInToEditWiki", { login: <Link to="/login">{t("music.logIn")}</Link> })}</p>
                  )}
                </>
              )}
            </div>
            <aside className="side">
              <h3>{t("music.history")}</h3>
              {versions.length ? (
                <ul className="plain">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <Button kind={"link" + (v === current ? " on" : "")} onClick={() => setShown(v.version)}>
                        {t("music.version", { version: v.version })}
                      </Button>{" "}
                      <span className="muted small">
                        {v.author ? <Username name={v.author} /> : t("music.deleted")} · {date(v.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t("music.noVersions")}</p>
              )}
            </aside>
          </div>
        );
      }}
    </Async>
  );
}
import { Username } from "./username";
