import { Ico } from "../icons";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../kit";
import { Link } from "react-router-dom";
import { api, num, qs, tagUrl, useAuth } from "../lib";
import { errorText } from "./base";
import { cn, chips, chip, formError } from "./tw";
import type { ItemType } from "../../shared/catalog";
import type { ItemTags, TagCount, TagSuggestions } from "../../shared/tags";

export function TagChips({ tags }: { tags: { name: string; count?: number }[] }) {
  return <span className={chips}>{tags.map(t => <Link key={t.name} className={chip} to={tagUrl(t.name)}>{t.name}</Link>)}</span>;
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
    <div className="tagger flex flex-wrap gap-2.5 items-center">
      {state.tags.length ? <TagChips tags={state.tags} /> : <span className="text-muted">No tags yet.</span>}
      {me && !open && (
        <Button className="inline-flex items-center gap-1 bg-transparent border-0 mpage:border mpage:border-line mpage:px-3 text-link font-semibold px-2.5 py-[3px] text-[13px] hover:bg-fill hover:text-accent-dark coarse:min-h-8" onClick={() => setOpen(true)}><Ico.Plus /> {state.myTags.length ? "Edit my tags" : "Add tags"}</Button>
      )}
      {me && open && <TagInput type={type} id={id} mine={state.myTags} onChange={setState} onDone={() => setOpen(false)} />}
    </div>
  );
}
type TagOpt = TagCount & { fresh?: boolean };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function TagInput({ type, id, mine, onChange, onDone }: {
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
    const load = () => api<TagSuggestions>(`/tags/suggest${qs({ q })}`)
      .then(d => {
        if (n === seq.current) setItems(d.items);
      })
      .catch(() => {});
    const t = setTimeout(load, q ? 120 : 0);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(0), [q]);
  const has = (n: string) => mine.some(t => same(t, n));
  const known = items.filter(t => !has(t.name)).slice(0, 8);
  const offerNew = q && !has(q) && !known.some(t => same(t.name, q));
  const opts: TagOpt[] = offerNew ? [{ name: q, count: 0, fresh: true }, ...known] : known;
  const save = (body: { tags: string[] } | { tag: string }, path = "/tags") => {
    setError("");
    return api<ItemTags>(path, { body: { type, id, ...body } })
      .then(onChange)
      .catch(e => setError(errorText(e)));
  };
  const add = (names: string[]) => {
    const fresh = names
      .map(s => s.trim())
      .filter((s, i, a) => s && !has(s) && a.findIndex(x => same(x, s)) === i);
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
      if (opts.length) setActive(a => (a + step) % opts.length);
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
    <div className="w-full max-w-[560px]">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-0 flex flex-wrap gap-1.5 items-center min-h-7 p-[2px_3px] bg-card border border-edge shadow-[inset_0_1px_2px_var(--inset)] cursor-text focus-within:border-accent focus-within:shadow-[inset_0_1px_2px_var(--inset)]" onMouseDown={focusField}>
          {mine.map(t => (
            <span key={t} className="inline-flex items-center gap-px h-[22px] pl-2 pr-px bg-accent-tint text-ink text-[13px] font-medium whitespace-nowrap max-w-full">
              {t}
              <button type="button" className="grid place-items-center w-5 h-5 p-0 border-0 bg-transparent text-ink-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] hover:text-ink focus-visible:bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] focus-visible:text-ink [&>svg]:w-3 [&>svg]:h-3" aria-label={`Remove tag ${t}`} title="Remove" onClick={() => save({ tag: t }, "/tags/remove")}><Ico.X /></button>
            </span>
          ))}
          <input
            ref={input}
            autoFocus
            value={text}
            maxLength={200}
            placeholder={mine.length ? "Add another…" : "Type a tag, then Enter"}
            aria-label="Add a tag"
            role="combobox"
            aria-expanded={openList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={openList ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={e => typed(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setShow(true)}
            onBlur={() => setShow(false)}
          />
          {openList && (
            <ul className="absolute z-20 top-[calc(100%+4px)] left-[-1px] right-[-1px] m-0 p-1 list-none bg-card shadow-[0_6px_24px_rgba(23,21,15,.18),0_0_0_1px_var(--line)] max-h-[320px] overflow-auto cursor-default [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" id={listId} role="listbox" aria-label="Tag suggestions">
              {!q && <li className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted cursor-default" role="presentation">Recent and popular</li>}
              {opts.map((o, i) => (
                <li
                  key={o.fresh ? "\0new" : o.name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={"flex justify-between items-baseline gap-3 px-2.5 py-1.25 text-sm cursor-pointer " + (i === active ? "bg-fill" : "")}
                  onMouseDown={e => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add([o.name])}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{o.fresh ? <>Add “{o.name}”</> : o.name}</span>
                  <small className="flex-none text-muted text-xs tabular-nums">{o.fresh ? "new tag" : num(o.count)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button kind="btn small ghost" onClick={onDone}>Done</Button>
      </div>
      {error && <p className={cn(formError, "text-[13px]")}>{error}</p>}
    </div>
  );
}
