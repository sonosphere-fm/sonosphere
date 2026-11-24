import { Ico } from "../icons";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n";
import { Button } from "../kit";
import { Link } from "react-router-dom";
import { api, num, qs, tagUrl, useAuth } from "../lib";
import { errorText } from "./base";
import type { ItemType } from "../../shared/catalog";
import type { ItemTags, TagCount, TagSuggestions } from "../../shared/tags";

export function TagChips({ tags }: { tags: { name: string; count?: number }[] }) {
  return (
    <span className="chips">
      {tags.map((tag) => (
        <Link key={tag.name} className="chip" to={tagUrl(tag.name)}>
          {tag.name}
        </Link>
      ))}
    </span>
  );
}
export function Tagger({ type, id, tags, myTags }: { type: ItemType; id: number; tags: TagCount[]; myTags: string[] }) {
  const { me } = useAuth();
  const [state, setState] = useState<ItemTags>({ tags, myTags });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setState({ tags, myTags });
    setOpen(false);
  }, [id, type]);
  return (
    <div className="flex flex-wrap gap-2.5 items-center col-span-full">
      {state.tags.length ? <TagChips tags={state.tags} /> : <span className="muted">{t("music.noTags")}</span>}
      {me && !open && (
        <Button kind="chip add" onClick={() => setOpen(true)}>
          <Ico.Plus /> {state.myTags.length ? t("music.editMyTags") : t("music.addTags")}
        </Button>
      )}
      {me && open && (
        <TagInput type={type} id={id} mine={state.myTags} onChange={setState} onDone={() => setOpen(false)} />
      )}
    </div>
  );
}
type TagOpt = TagCount & { fresh?: boolean };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function TagInput({
  type,
  id,
  mine,
  onChange,
  onDone,
}: {
  type: ItemType;
  id: number;
  mine: string[];
  onChange: (s: ItemTags) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<TagOpt[]>([]);
  const [active, setActive] = useState(0);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const listId = useId();
  const q = text.trim().replace(/\s+/g, " ");
  useEffect(() => {
    const n = ++seq.current;
    const load = () =>
      api<TagSuggestions>(`/tags/suggest${qs({ q })}`)
        .then((d) => {
          if (n === seq.current) setItems(d.items);
        })
        .catch(() => {});
    const timer = setTimeout(load, q ? 120 : 0);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => setActive(0), [q]);
  const has = (n: string) => mine.some((tag) => same(tag, n));
  const known = items.filter((tag) => !has(tag.name)).slice(0, 8);
  const offerNew = q && !has(q) && !known.some((tag) => same(tag.name, q));
  const opts: TagOpt[] = offerNew ? [{ name: q, count: 0, fresh: true }, ...known] : known;
  const save = (body: { tags: string[] } | { tag: string }, path = "/tags") => {
    setError("");
    return api<ItemTags>(path, { body: { type, id, ...body } })
      .then(onChange)
      .catch((e) => setError(errorText(e)));
  };
  const add = (names: string[]) => {
    const fresh = names.map((s) => s.trim()).filter((s, i, a) => s && !has(s) && a.findIndex((x) => same(x, s)) === i);
    setText("");
    input.current?.focus();
    if (fresh.length) save({ tags: fresh });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setShow(true);
      const step = e.key === "ArrowDown" ? 1 : opts.length - 1;
      if (opts.length) setActive((a) => (a + step) % opts.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = show ? opts[active] : undefined;
      if (o) add([o.name]);
      else if (q) add([q]);
    } else if (e.key === ",") {
      e.preventDefault();
      if (q) add([q]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) setText("");
      else onDone();
    }
  };
  const typed = (v: string) => {
    setShow(true);
    if (v.includes(",")) add(v.split(","));
    else setText(v);
  };
  const focusField = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    input.current?.focus();
  };
  const openList = show && opts.length > 0;
  return (
    <div className="tag-edit">
      <div className="tag-row">
        <div className="tag-field" onMouseDown={focusField}>
          {mine.map((tag) => (
            <span key={tag} className="tag-token">
              {tag}
              <button
                type="button"
                aria-label={t("music.removeTag", { tag })}
                title={t("music.remove")}
                onClick={() => save({ tag }, "/tags/remove")}
              >
                <Ico.X />
              </button>
            </span>
          ))}
          <input
            ref={input}
            autoFocus
            value={text}
            maxLength={200}
            placeholder={mine.length ? t("music.addAnotherTag") : t("music.typeATag")}
            aria-label={t("music.addATag")}
            role="combobox"
            aria-expanded={openList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={openList ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => typed(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setShow(true)}
            onBlur={() => setShow(false)}
          />
          {openList && (
            <ul className="tag-suggest" id={listId} role="listbox" aria-label={t("music.tagSuggestions")}>
              {!q && (
                <li className="tag-suggest-head" role="presentation">
                  {t("music.recentAndPopular")}
                </li>
              )}
              {opts.map((o, i) => (
                <li
                  key={o.fresh ? "\0new" : o.name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "active" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add([o.name])}
                >
                  <span>{o.fresh ? t("music.addNewTag", { name: o.name }) : o.name}</span>
                  <small>{o.fresh ? t("music.newTag") : num(o.count)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button kind="btn small ghost" onClick={onDone}>
          {t("music.done")}
        </Button>
      </div>
      {error && <p className="form-error small">{error}</p>}
    </div>
  );
}
