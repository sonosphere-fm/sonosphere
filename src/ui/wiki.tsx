import { Ico } from "../icons";
import { useState, type FormEvent } from "react";
import { Button } from "../kit";
import { Markdown, MdEditor, plainMd } from "../md";
import { Link } from "react-router-dom";
import { api, date, qs, useApi, useAuth, userUrl } from "../lib";
import { Empty, Async, useAction } from "./base";
import { cn, cols, side, plain, form, fieldBlock, fieldLabel, more, linkBtn, linkBtnOn } from "./tw";
import { ReportButton } from "./shoutbox";
import type { ItemType } from "../../shared/catalog";
import type { WikiHistory, WikiSaved, WikiVersion } from "../../shared/wiki";

export function WikiSummary({ wiki, to }: { wiki: Pick<WikiVersion, "content"> | null; to: string }) {
  if (!wiki) return <p className="text-muted">There's no wiki for this yet. <Link to={to}>Start it <Ico.Right /></Link></p>;
  const plain = plainMd(wiki.content).replace(/\n{2,}/g, "\n\n").trim();
  const short = plain.length > 420;
  const text = short ? plain.slice(0, 420).replace(/\s+\S*$/, "") + "… " : plain + " ";
  return (
    <p className="wiki-summary max-w-[72ch] leading-[1.6] mb-[26px]">
      {text}
      <Link to={to}>{short ? "Read more" : "View wiki"} <Ico.Right /></Link>
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
    <Async q={q}>{({ versions }) => {
      const current = versions.find(v => v.version === shown) ?? versions[0];
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
        <div className={cols}>
          <div>
            {editing ? (
              <form onSubmit={save} className={form}>
                <div className={fieldBlock}>
                  <span className={fieldLabel}>Wiki for {title}</span>
                  <MdEditor label={`Wiki for ${title}`} rows={14} value={text} onChange={setText} maxLength={20000} autoFocus />
                </div>
                {act.note}
                <div className="row">
                  <Button kind="btn" loading={act.busy}>Save version {versions.length ? versions[0].version + 1 : 1}</Button>
                  <Button type="button" kind="btn ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <>
                {current ? <Markdown text={current.content} /> : <Empty>Nobody has written a wiki for {title} yet.</Empty>}
                {current && (
                  <p className="text-muted text-[13px]">
                    Version {current.version} · edited by{" "}
                    {current.author ? <Link to={userUrl(current.author)}>{current.author}</Link> : "a deleted user"}{" "}
                    on {date(current.createdAt)}
                    {current.author !== me?.username && <> · <ReportButton type="wiki" id={current.id} label="Report this version" /></>}
                  </p>
                )}
                {me ? (
                  <div className="mt-5">
                    <Button kind="btn" onClick={edit}>{current ? "Edit wiki" : "Write the wiki"}</Button>
                  </div>
                ) : (
                  <p><Link to="/login">Log in</Link> to edit this wiki.</p>
                )}
              </>
            )}
          </div>
          <aside className={side}>
            <h3>History</h3>
            {versions.length ? (
              <ul className={plain}>
                {versions.map(v => (
                  <li key={v.id}>
                    <Button className={cn(linkBtn, v === current && linkBtnOn)} onClick={() => setShown(v.version)}>Version {v.version}</Button>{" "}
                    <span className="text-muted text-[13px]">{v.author || "deleted"} · {date(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No versions yet.</p>
            )}
          </aside>
        </div>
      );
    }}</Async>
  );
}
