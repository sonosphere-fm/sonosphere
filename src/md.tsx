import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { Code, LinkSimple, ListBullets, ListNumbers, Quotes, TextB, TextHTwo, TextItalic, TextStrikethrough, type Icon as PhIcon } from "@phosphor-icons/react";

type Inline =
  | { t: "text"; s: string }
  | { t: "code"; s: string }
  | { t: "b" | "i" | "u" | "s"; mark: string; kids: Inline[] }
  | { t: "link"; kids: Inline[]; url: string }
  | { t: "auto"; url: string };

// Groups: 1 code, 2 bold, 3 underline, 4 strike, 5 italic *, 6 italic _, 7+8 link text and url, 9 bare url.
const INLINE = /(`[^`\n]+`)|\*\*([^\n]+?)\*\*(?!\*)|__([^\n]+?)__(?!_)|~~([^\n]+?)~~|\*(?=\S)([^*\n]+?)(?<=\S)\*|(?<![\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"*_~])/g;

function inline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: "text", s: s.slice(last, m.index) });
    if (m[1]) out.push({ t: "code", s: m[1].slice(1, -1) });
    else if (m[2] !== undefined) out.push({ t: "b", mark: "**", kids: inline(m[2]) });
    else if (m[3] !== undefined) out.push({ t: "u", mark: "__", kids: inline(m[3]) });
    else if (m[4] !== undefined) out.push({ t: "s", mark: "~~", kids: inline(m[4]) });
    else if (m[5] !== undefined) out.push({ t: "i", mark: "*", kids: inline(m[5]) });
    else if (m[6] !== undefined) out.push({ t: "i", mark: "_", kids: inline(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "link", kids: inline(m[7]), url: m[8] });
    else out.push({ t: "auto", url: m[9] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", s: s.slice(last) });
  return out;
}

type Line =
  | { kind: "h"; level: number; mark: string; text: string }
  | { kind: "quote" | "ul" | "ol"; mark: string; text: string }
  | { kind: "p"; text: string }
  | { kind: "blank" };

function line(s: string): Line {
  let m: RegExpExecArray | null;
  if (!s.trim()) return { kind: "blank" };
  if ((m = /^(#{1,3}\s+)(.*)$/.exec(s))) return { kind: "h", level: m[1].trim().length, mark: m[1], text: m[2] };
  if ((m = /^(>\s?)(.*)$/.exec(s))) return { kind: "quote", mark: m[1], text: m[2] };
  if ((m = /^(\s*[-*•]\s+)(.*)$/.exec(s))) return { kind: "ul", mark: m[1], text: m[2] };
  if ((m = /^(\s*\d{1,3}[.)]\s+)(.*)$/.exec(s))) return { kind: "ol", mark: m[1], text: m[2] };
  return { kind: "p", text: s };
}

function nodes(list: Inline[], key = ""): ReactNode[] {
  return list.map((n, i) => {
    const k = key + i;
    switch (n.t) {
      case "text": return n.s;
      case "code": return <code key={k}>{n.s}</code>;
      case "b": return <strong key={k}>{nodes(n.kids, k)}</strong>;
      case "i": return <em key={k}>{nodes(n.kids, k)}</em>;
      case "u": return <u key={k}>{nodes(n.kids, k)}</u>;
      case "s": return <s key={k}>{nodes(n.kids, k)}</s>;
      case "link": return <a key={k} href={n.url} target="_blank" rel="nofollow noopener noreferrer">{nodes(n.kids, k)}</a>;
      case "auto": return <a key={k} href={n.url} target="_blank" rel="nofollow noopener noreferrer">{n.url.replace(/^https?:\/\//, "")}</a>;
    }
  });
}

const breaks = (rows: string[], key: string) => rows.flatMap((r, i) => {
  const row = nodes(inline(r), `${key}-${i}-`);
  return i ? [<br key={`${key}b${i}`} />, ...row] : row;
});

export function Markdown({ text, className = "prose" }: { text: string; className?: string }) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map(line);
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    const k = "l" + i;
    if (l.kind === "blank") {
      i++;
      continue;
    }
    if (l.kind === "h") {
      const H = (["h2", "h3", "h4"] as const)[l.level - 1];
      out.push(<H key={k}>{nodes(inline(l.text), k)}</H>);
      i++;
      continue;
    }
    const kind = l.kind;
    const run: string[] = [];
    while (i < lines.length) {
      const c = lines[i];
      if (c.kind !== kind || !("text" in c)) break;
      run.push(c.text);
      i++;
    }
    if (kind === "p") {
      out.push(<p key={k}>{breaks(run, k)}</p>);
    } else if (kind === "quote") {
      out.push(<blockquote key={k}>{breaks(run, k)}</blockquote>);
    } else {
      const L = kind === "ul" ? "ul" : "ol";
      out.push(<L key={k}>{run.map((r, j) => <li key={j}>{nodes(inline(r), `${k}-${j}-`)}</li>)}</L>);
    }
  }
  return <div className={`${className} md`}>{out}</div>;
}

/** The text with the markup taken out, for one-line previews and excerpts. */
export function plainMd(text: string): string {
  const flat = (list: Inline[]): string => list.map(n => {
    if (n.t === "text" || n.t === "code") return n.s;
    if (n.t === "auto") return n.url;
    return flat(n.kids);
  }).join("");
  return String(text || "").split("\n").map(s => {
    const l = line(s);
    return l.kind === "blank" ? "" : flat(inline(l.text));
  }).join("\n");
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const esc = (s: string) => s.replace(/[&<>]/g, c => ESCAPES[c]);
const mark = (s: string) => `<span class="md-mark">${esc(s)}</span>`;

function paint(list: Inline[]): string {
  return list.map(n => {
    switch (n.t) {
      case "text": return esc(n.s);
      case "code": return `${mark("`")}<code>${esc(n.s)}</code>${mark("`")}`;
      case "link": return `${mark("[")}<span class="md-link">${paint(n.kids)}</span>${mark(`](${n.url})`)}`;
      case "auto": return `<span class="md-link">${esc(n.url)}</span>`;
      default: {
        const tag = n.t === "b" ? "strong" : n.t === "i" ? "em" : n.t;
        return `${mark(n.mark)}<${tag}>${paint(n.kids)}</${tag}>${mark(n.mark)}`;
      }
    }
  }).join("");
}

/** The source text, untouched, with spans around what the markup means. Its textContent is always the source. */
function highlight(text: string): string {
  const rows = text.split("\n").map(s => {
    const l = line(s);
    if (l.kind === "blank") return esc(s);
    if (l.kind === "p") return paint(inline(s));
    const cls = l.kind === "h" ? `md-h md-h${l.level}` : `md-${l.kind}`;
    return `<span class="${cls}">${mark(l.mark)}${paint(inline(l.text))}</span>`;
  });
  return rows.join("\n") + "<br>";
}

type Sel = [number, number];
/** One undo/redo step. A burst of typing is merged into one. */
type Snap = { text: string; sel: Sel; at: number; typed: boolean };

function getSel(el: HTMLElement): Sel | null {
  const s = window.getSelection();
  if (!s || !s.rangeCount || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) return null;
  const at = (node: Node, off: number) => {
    const r = document.createRange();
    r.setStart(el, 0);
    r.setEnd(node, off);
    return r.toString().length;
  };
  const a = at(s.anchorNode!, s.anchorOffset);
  const b = at(s.focusNode!, s.focusOffset);
  return [Math.min(a, b), Math.max(a, b)];
}

function setSel(el: HTMLElement, [a, b]: Sel) {
  const find = (off: number): [Node, number] => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    let last: Node | null = null;
    let left = off;
    while ((n = w.nextNode())) {
      const len = n.nodeValue!.length;
      if (left <= len) return [n, left];
      left -= len;
      last = n;
    }
    return last ? [last, last.nodeValue!.length] : [el, 0];
  };
  const r = document.createRange();
  r.setStart(...find(a));
  r.setEnd(...find(b));
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

type Edit = (text: string, sel: Sel) => { text: string; sel: Sel };

/** Wraps the selection in a marker, or unwraps it if it already is. */
const wrap = (m: string, placeholder: string, close = m): Edit => (t, [a, b]) => {
  if (t.slice(a - m.length, a) === m && t.slice(b, b + close.length) === close) {
    return { text: t.slice(0, a - m.length) + t.slice(a, b) + t.slice(b + close.length), sel: [a - m.length, b - m.length] };
  }
  const inner = t.slice(a, b) || placeholder;
  return { text: t.slice(0, a) + m + inner + close + t.slice(b), sel: [a + m.length, a + m.length + inner.length] };
};

const ANY_PREFIX = /^(#{1,3}\s+|>\s?|\s*[-*•]\s+|\s*\d{1,3}[.)]\s+)/;

/** Puts a prefix on every selected line, or takes it off if they all have it. */
const prefix = (make: (i: number) => string, test: RegExp): Edit => (t, [a, b]) => {
  const from = t.lastIndexOf("\n", a - 1) + 1;
  const end = t.indexOf("\n", b);
  const to = end < 0 ? t.length : end;
  const rows = t.slice(from, to).split("\n");
  const on = rows.every(r => test.test(r));
  const next = rows.map((r, i) => on ? r.replace(test, "") : make(i) + r.replace(ANY_PREFIX, "")).join("\n");
  if (rows.length > 1) return { text: t.slice(0, from) + next + t.slice(to), sel: [from, from + next.length] };
  const shift = next.length - (to - from);
  return { text: t.slice(0, from) + next + t.slice(to), sel: [Math.max(from, a + shift), Math.max(from, b + shift)] };
};

const insertLink: Edit = (t, [a, b]) => {
  const inner = t.slice(a, b) || "link text";
  const url = "https://";
  const caret = a + inner.length + 3 + url.length;
  return { text: `${t.slice(0, a)}[${inner}](${url})${t.slice(b)}`, sel: [caret, caret] };
};

const TOOLS: { label: string; keys?: string; Icon: PhIcon; edit: Edit }[] = [
  { label: "Bold", keys: "b", Icon: TextB, edit: wrap("**", "bold text") },
  { label: "Italic", keys: "i", Icon: TextItalic, edit: wrap("*", "italic text") },
  { label: "Strikethrough", Icon: TextStrikethrough, edit: wrap("~~", "struck text") },
  { label: "Code", keys: "e", Icon: Code, edit: wrap("`", "code") },
  { label: "Link", keys: "k", Icon: LinkSimple, edit: insertLink },
  { label: "Heading", Icon: TextHTwo, edit: prefix(() => "## ", /^#{1,3}\s+/) },
  { label: "Quote", Icon: Quotes, edit: prefix(() => "> ", /^>\s?/) },
  { label: "Bulleted list", Icon: ListBullets, edit: prefix(() => "- ", /^\s*[-*•]\s+/) },
  { label: "Numbered list", Icon: ListNumbers, edit: prefix(i => `${i + 1}. `, /^\s*\d{1,3}[.)]\s+/) },
];

/** Highlighted element selector to the toolbar button it lights up. */
const ON: [string, string][] = [
  ["strong", "Bold"],
  ["em", "Italic"],
  ["s, del", "Strikethrough"],
  ["code", "Code"],
  [".md-link", "Link"],
  [".md-h", "Heading"],
  [".md-quote", "Quote"],
  [".md-ul", "Bulleted list"],
  [".md-ol", "Numbered list"],
];

const MOD_LABEL = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

// Enter inside a list carries the bullet on; Enter on an empty bullet ends the list.
const newlineEdit: Edit = (t, [a, b]) => {
  const from = t.lastIndexOf("\n", a - 1) + 1;
  const row = t.slice(from, a);
  const m = /^(\s*)(?:([-*•])|(\d{1,3})([.)]))(\s+)(.*)$/.exec(row) || /^()(>)()()(\s?)(.*)$/.exec(row);
  if (m && a === b) {
    if (!m[6]) return { text: t.slice(0, from) + t.slice(a), sel: [from, from] };
    const bullet = m[3] ? Number(m[3]) + 1 + m[4] : m[2];
    const next = `${m[1]}${bullet}${m[5] || " "}`;
    return { text: `${t.slice(0, a)}\n${next}${t.slice(b)}`, sel: [a + 1 + next.length, a + 1 + next.length] };
  }
  return { text: `${t.slice(0, a)}\n${t.slice(b)}`, sel: [a + 1, a + 1] };
};

type MdEditorProps = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
};

/** A plain-text editor that formats as you type: the markup stays visible and editable. Pastes arrive as plain text. */
export function MdEditor({ value, onChange, rows = 10, maxLength, label, placeholder, autoFocus }: MdEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = useRef<string | null>(null);
  const composing = useRef(false);
  const undo = useRef<Snap[]>([]);
  const redo = useRef<Snap[]>([]);
  const change = useRef(onChange);
  change.current = onChange;

  // the toolbar formats the caret is sitting in, as a "|"-joined list of tool labels
  const [on, setOn] = useState("");
  const scan = useCallback(() => {
    const el = ref.current;
    const s = window.getSelection();
    if (!el || !s || !s.rangeCount || !el.contains(s.anchorNode) || document.activeElement !== el) {
      setOn("");
      return;
    }
    const found = new Set<string>();
    const note = (n: Element) => {
      const hit = ON.find(([sel]) => n.matches(sel));
      if (hit) found.add(hit[1]);
    };
    for (const node of [s.anchorNode, s.focusNode]) {
      // a caret resting on the markers themselves still counts as inside what they wrap
      const m = node?.parentElement?.closest(".md-mark");
      if (m && el.contains(m)) {
        for (const sib of [m.previousElementSibling, m.nextElementSibling]) {
          if (sib && !sib.matches(".md-mark")) note(sib);
        }
      }
      for (let n: Node | null = node; n && n !== el; n = n.parentNode) {
        if (n instanceof Element) note(n);
      }
    }
    setOn([...found].sort().join("|"));
  }, []);
  useEffect(() => {
    document.addEventListener("selectionchange", scan);
    return () => document.removeEventListener("selectionchange", scan);
  }, [scan]);

  const draw = useCallback((t: string, sel: Sel | null) => {
    const el = ref.current!;
    text.current = t;
    el.innerHTML = highlight(t);
    el.dataset.empty = t ? "" : "1";
    if (sel) setSel(el, [Math.min(sel[0], t.length), Math.min(sel[1], t.length)]);
    scan();
  }, [scan]);

  const remember = (typed: boolean, sel: Sel) => {
    const top = undo.current.at(-1);
    const now = Date.now();
    if (typed && top?.typed && now - top.at < 600) {
      top.at = now;
      return;
    }
    undo.current.push({ text: text.current ?? "", sel, at: now, typed });
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
  };
  const commit = (t: string, sel: Sel, typed: boolean, before: Sel) => {
    if (maxLength && t.length > maxLength) t = t.slice(0, maxLength);
    if (t === text.current) {
      draw(t, sel);
      return;
    }
    remember(typed, before);
    draw(t, sel);
    change.current(t);
  };
  const apply = (edit: Edit) => {
    const el = ref.current!;
    el.focus();
    const sel: Sel = getSel(el) ?? [text.current!.length, text.current!.length];
    const r = edit(text.current ?? "", sel);
    commit(r.text, r.sel, false, sel);
  };
  const insert = (s: string) => apply((t, [a, b]) => ({ text: t.slice(0, a) + s + t.slice(b), sel: [a + s.length, a + s.length] }));

  useLayoutEffect(() => {
    const el = ref.current!;
    try {
      el.contentEditable = "plaintext-only";
    } catch {
      el.contentEditable = "true";
    }
    if (autoFocus) {
      el.focus();
      setSel(el, [value.length, value.length]);
    }
  }, []);
  useLayoutEffect(() => {
    if (value === text.current) return;
    draw(value, document.activeElement === ref.current ? getSel(ref.current!) : null);
  }, [value, draw]);

  const onInput = () => {
    const el = ref.current!;
    if (composing.current) return;
    const sel: Sel = getSel(el) ?? [0, 0];
    const t = el.textContent || "";
    // where the caret was before this keystroke
    const grown = Math.max(t.length - (text.current ?? "").length, 0);
    const before: Sel = [Math.max(0, sel[0] - grown), Math.max(0, sel[1] - grown)];
    commit(t, sel, true, before);
  };
  const step = (from: typeof undo, to: typeof redo) => {
    const s = from.current.pop();
    if (!s) return;
    to.current.push({ text: text.current ?? "", sel: getSel(ref.current!) ?? [0, 0], at: 0, typed: false });
    draw(s.text, s.sel);
    change.current(s.text);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (e.key === "Enter" && !mod) {
      e.preventDefault();
      apply(newlineEdit);
      return;
    }
    if (!mod || e.altKey) return;
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) step(redo, undo);
      else step(undo, redo);
      return;
    }
    if (key === "y") {
      e.preventDefault();
      step(redo, undo);
      return;
    }
    const tool = !e.shiftKey && TOOLS.find(t => t.keys === key);
    if (tool) {
      e.preventDefault();
      apply(tool.edit);
    }
  };
  const onDrop = (e: DragEvent) => {
    const s = e.dataTransfer.getData("text/plain");
    if (!s) return;
    e.preventDefault();
    insert(s.replace(/\r\n?/g, "\n"));
  };

  const active = new Set(on.split("|"));
  return (
    <div className="md-editor">
      <div className="md-tools" role="toolbar" aria-label="Formatting">
        {TOOLS.map(({ label, keys, Icon, edit }, i) => (
          <button
            key={label}
            type="button"
            className={`md-tool${i === 5 ? " gap" : ""}${active.has(label) ? " on" : ""}`}
            aria-pressed={active.has(label)}
            title={keys ? `${label} (${MOD_LABEL}${keys.toUpperCase()})` : label}
            aria-label={label}
            onMouseDown={e => e.preventDefault()}
            onClick={() => apply(edit)}
          >
            <Icon aria-hidden weight="bold" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="md-input md"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder || ""}
        spellCheck
        suppressContentEditableWarning
        style={{ minHeight: `calc(${rows} * 1.6em + 22px)` }}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; onInput(); }}
        onPaste={e => { e.preventDefault(); insert(e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n")); }}
        onDrop={onDrop}
      />
      {maxLength && value.length > maxLength * 0.9 ? (
        <div className="md-count">{value.length.toLocaleString()} / {maxLength.toLocaleString()}</div>
      ) : null}
    </div>
  );
}
