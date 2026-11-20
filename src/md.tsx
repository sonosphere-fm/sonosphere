// Markdown for wikis, journal posts and bios: one small parser shared by the reader (<Markdown>) and the editor
// (<MdEditor>), so what's highlighted while typing is exactly what gets formatted once it's saved.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Code, LinkSimple, ListBullets, ListNumbers, Quotes, TextB, TextHTwo, TextItalic, TextStrikethrough, type Icon as PhIcon } from "@phosphor-icons/react";

// ---------- parsing ----------
type Inline =
  | { t: "text"; s: string }
  | { t: "code"; s: string }
  | { t: "b" | "i" | "u" | "s"; mark: string; kids: Inline[] }
  | { t: "link"; kids: Inline[]; url: string }
  | { t: "auto"; url: string };

//           1 code       2 bold                  3 underline            4 strike         5 italic *                         6 italic _                          7,8 link                                   9 bare url
const INLINE = /(`[^`\n]+`)|\*\*([^\n]+?)\*\*(?!\*)|__([^\n]+?)__(?!_)|~~([^\n]+?)~~|\*(?=\S)([^*\n]+?)(?<=\S)\*|(?<![\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w_])|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"*_~])/g;

function inline(s: string): Inline[] {
  const out: Inline[] = [], re = new RegExp(INLINE.source, "g");
  let last = 0, m: RegExpExecArray | null;
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

type Line = { kind: "h"; level: number; mark: string; text: string } | { kind: "quote" | "ul" | "ol"; mark: string; text: string } | { kind: "p"; text: string } | { kind: "blank" };
function line(s: string): Line {
  let m: RegExpExecArray | null;
  if (!s.trim()) return { kind: "blank" };
  if ((m = /^(#{1,3}\s+)(.*)$/.exec(s))) return { kind: "h", level: m[1].trim().length, mark: m[1], text: m[2] };
  if ((m = /^(>\s?)(.*)$/.exec(s))) return { kind: "quote", mark: m[1], text: m[2] };
  if ((m = /^(\s*[-*•]\s+)(.*)$/.exec(s))) return { kind: "ul", mark: m[1], text: m[2] };
  if ((m = /^(\s*\d{1,3}[.)]\s+)(.*)$/.exec(s))) return { kind: "ol", mark: m[1], text: m[2] };
  return { kind: "p", text: s };
}

// ---------- reading ----------
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
const breaks = (rows: string[], key: string) => rows.flatMap((r, i) => i ? [<br key={`${key}b${i}`} />, ...nodes(inline(r), `${key}-${i}-`)] : nodes(inline(r), `${key}-${i}-`));

/** Formatted text. `className` defaults to the app's reading column. */
export function Markdown({ text, className = "prose" }: { text: string; className?: string }) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map(line), out: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i], k = "l" + i;
    if (l.kind === "blank") { i++; continue; }
    if (l.kind === "h") { const H = (["h2", "h3", "h4"] as const)[l.level - 1]; out.push(<H key={k}>{nodes(inline(l.text), k)}</H>); i++; continue; }
    const run: string[] = [], kind = l.kind;
    for (let c = lines[i]; i < lines.length && c.kind === kind && "text" in c; c = lines[++i]) run.push(c.text);
    if (kind === "p") out.push(<p key={k}>{breaks(run, k)}</p>);
    else if (kind === "quote") out.push(<blockquote key={k}>{breaks(run, k)}</blockquote>);
    else { const L = kind === "ul" ? "ul" : "ol"; out.push(<L key={k}>{run.map((r, j) => <li key={j}>{nodes(inline(r), `${k}-${j}-`)}</li>)}</L>); }
  }
  return <div className={`${className} md`}>{out}</div>;
}

/** The same text with the markup taken out, for one-line previews and excerpts. */
export function plainMd(text: string): string {
  const flat = (l: Inline[]): string => l.map(n => n.t === "text" || n.t === "code" ? n.s : n.t === "auto" ? n.url : flat(n.kids)).join("");
  return String(text || "").split("\n").map(s => { const l = line(s); return l.kind === "blank" ? "" : flat(inline(l.text)); }).join("\n");
}

// ---------- editing ----------
const esc = (s: string) => s.replace(/[&<>]/g, c => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
const mark = (s: string) => `<span class="md-mark">${esc(s)}</span>`;
function paint(list: Inline[]): string {
  return list.map(n => {
    switch (n.t) {
      case "text": return esc(n.s);
      case "code": return `${mark("`")}<code>${esc(n.s)}</code>${mark("`")}`;
      case "link": return `${mark("[")}<span class="md-link">${paint(n.kids)}</span>${mark(`](${n.url})`)}`;
      case "auto": return `<span class="md-link">${esc(n.url)}</span>`;
      default: { const tag = n.t === "b" ? "strong" : n.t === "i" ? "em" : n.t; return `${mark(n.mark)}<${tag}>${paint(n.kids)}</${tag}>${mark(n.mark)}`; }
    }
  }).join("");
}
/** The source text, untouched, with spans around what the markup means. Its textContent is always the source. */
function highlight(text: string): string {
  return text.split("\n").map(s => {
    const l = line(s);
    if (l.kind === "blank") return esc(s);
    if (l.kind === "p") return paint(inline(s));
    return `<span class="md-${l.kind}${l.kind === "h" ? " md-h" + l.level : ""}">${mark(l.mark)}${paint(inline(l.text))}</span>`;
  }).join("\n") + "<br>";
}

type Sel = [number, number];
/** One undo/redo step: the text and caret, and when and how it was made (a burst of typing is merged into one). */
type Snap = { text: string; sel: Sel; at: number; typed: boolean };
function getSel(el: HTMLElement): Sel | null {
  const s = window.getSelection();
  if (!s || !s.rangeCount || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) return null;
  const at = (node: Node, off: number) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(node, off); return r.toString().length; };
  const a = at(s.anchorNode!, s.anchorOffset), b = at(s.focusNode!, s.focusOffset);
  return [Math.min(a, b), Math.max(a, b)];
}
function setSel(el: HTMLElement, [a, b]: Sel) {
  const find = (off: number): [Node, number] => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null, last: Node | null = null, left = off;
    while ((n = w.nextNode())) { const len = n.nodeValue!.length; if (left <= len) return [n, left]; left -= len; last = n; }
    return last ? [last, last.nodeValue!.length] : [el, 0];
  };
  const r = document.createRange(), [an, ao] = find(a), [bn, bo] = find(b);
  r.setStart(an, ao); r.setEnd(bn, bo);
  const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
}

type Edit = (text: string, sel: Sel) => { text: string; sel: Sel };
/** Wraps the selection in a marker, or unwraps it if it already is. */
const wrap = (m: string, placeholder: string, close = m): Edit => (t, [a, b]) => {
  if (t.slice(a - m.length, a) === m && t.slice(b, b + close.length) === close) return { text: t.slice(0, a - m.length) + t.slice(a, b) + t.slice(b + close.length), sel: [a - m.length, b - m.length] };
  const inner = t.slice(a, b) || placeholder;
  return { text: t.slice(0, a) + m + inner + close + t.slice(b), sel: [a + m.length, a + m.length + inner.length] };
};
/** Puts a prefix on every selected line, or takes it off if they all have it. */
const prefix = (make: (i: number) => string, test: RegExp): Edit => (t, [a, b]) => {
  const from = t.lastIndexOf("\n", a - 1) + 1, end = t.indexOf("\n", b), to = end < 0 ? t.length : end;
  const rows = t.slice(from, to).split("\n"), on = rows.every(r => test.test(r));
  const next = rows.map((r, i) => on ? r.replace(test, "") : make(i) + r.replace(/^(#{1,3}\s+|>\s?|\s*[-*•]\s+|\s*\d{1,3}[.)]\s+)/, "")).join("\n");
  return { text: t.slice(0, from) + next + t.slice(to), sel: rows.length > 1 ? [from, from + next.length] : [Math.max(from, a + next.length - (to - from)), Math.max(from, b + next.length - (to - from))] };
};
const TOOLS: { label: string; keys?: string; Icon: PhIcon; edit: Edit }[] = [
  { label: "Bold", keys: "b", Icon: TextB, edit: wrap("**", "bold text") },
  { label: "Italic", keys: "i", Icon: TextItalic, edit: wrap("*", "italic text") },
  { label: "Strikethrough", Icon: TextStrikethrough, edit: wrap("~~", "struck text") },
  { label: "Code", keys: "e", Icon: Code, edit: wrap("`", "code") },
  { label: "Link", keys: "k", Icon: LinkSimple, edit: (t, [a, b]) => { const inner = t.slice(a, b) || "link text", url = "https://"; return { text: `${t.slice(0, a)}[${inner}](${url})${t.slice(b)}`, sel: [a + inner.length + 3 + url.length, a + inner.length + 3 + url.length] }; } },
  { label: "Heading", Icon: TextHTwo, edit: prefix(() => "## ", /^#{1,3}\s+/) },
  { label: "Quote", Icon: Quotes, edit: prefix(() => "> ", /^>\s?/) },
  { label: "Bulleted list", Icon: ListBullets, edit: prefix(() => "- ", /^\s*[-*•]\s+/) },
  { label: "Numbered list", Icon: ListNumbers, edit: prefix(i => `${i + 1}. `, /^\s*\d{1,3}[.)]\s+/) },
];

/** Highlighted element → the toolbar button it lights up. */
const ON: [string, string][] = [["strong", "Bold"], ["em", "Italic"], ["s, del", "Strikethrough"], ["code", "Code"], [".md-link", "Link"], [".md-h", "Heading"], [".md-quote", "Quote"], [".md-ul", "Bulleted list"], [".md-ol", "Numbered list"]];

/**
 * A plain-text editor that formats as you type: the markup stays visible and editable, and the text it applies to
 * takes on its look. Anything pasted in arrives as plain text.
 */
export function MdEditor({ value, onChange, rows = 10, maxLength, label, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; label: string; placeholder?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), text = useRef<string | null>(null), composing = useRef(false);
  const undo = useRef<Snap[]>([]), redo = useRef<Snap[]>([]);
  const change = useRef(onChange); change.current = onChange;

  // which toolbar formats the caret is sitting in, as a "|"-joined list of tool labels
  const [on, setOn] = useState("");
  const scan = useCallback(() => {
    const el = ref.current, s = window.getSelection();
    if (!el || !s || !s.rangeCount || !el.contains(s.anchorNode) || document.activeElement !== el) { setOn(""); return; }
    const found = new Set<string>(), note = (n: Element) => {
      const hit = ON.find(([sel]) => n.matches(sel)); if (hit) found.add(hit[1]);
    };
    for (const node of [s.anchorNode, s.focusNode]) {
      let n: Node | null = node;
      // a caret resting on the markers themselves still counts as inside what they wrap
      const m = n?.parentElement?.closest(".md-mark");
      if (m && el.contains(m)) for (const sib of [m.previousElementSibling, m.nextElementSibling]) if (sib && !sib.matches(".md-mark")) note(sib);
      for (; n && n !== el; n = n.parentNode) if (n instanceof Element) note(n);
    }
    setOn([...found].sort().join("|"));
  }, []);
  useEffect(() => { document.addEventListener("selectionchange", scan); return () => document.removeEventListener("selectionchange", scan); }, [scan]);

  const draw = useCallback((t: string, sel: Sel | null) => {
    const el = ref.current!; text.current = t;
    el.innerHTML = highlight(t); el.dataset.empty = t ? "" : "1";
    if (sel) setSel(el, [Math.min(sel[0], t.length), Math.min(sel[1], t.length)]);
    scan();
  }, [scan]);
  const remember = (typed: boolean, sel: Sel) => {
    const top = undo.current.at(-1), t = Date.now();
    if (typed && top?.typed && t - top.at < 600) { top.at = t; return; }   // a burst of typing is one step
    undo.current.push({ text: text.current ?? "", sel, at: t, typed }); if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
  };
  /** Commits new text from any source, clipped to the limit. */
  const commit = (t: string, sel: Sel, typed: boolean, before: Sel) => {
    if (maxLength && t.length > maxLength) { t = t.slice(0, maxLength); }
    if (t === text.current) { draw(t, sel); return; }
    remember(typed, before);
    draw(t, sel); change.current(t);
  };
  const apply = (edit: Edit) => {
    const el = ref.current!; el.focus();
    const sel: Sel = getSel(el) ?? [text.current!.length, text.current!.length], r = edit(text.current ?? "", sel);
    commit(r.text, r.sel, false, sel);
  };
  const insert = (s: string) => apply((t, [a, b]) => ({ text: t.slice(0, a) + s + t.slice(b), sel: [a + s.length, a + s.length] }));

  useLayoutEffect(() => {
    const el = ref.current!;
    try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
    if (autoFocus) { el.focus(); setSel(el, [value.length, value.length]); }
  }, []);
  useLayoutEffect(() => { if (value !== text.current) draw(value, document.activeElement === ref.current ? getSel(ref.current!) : null); }, [value, draw]);

  const onInput = () => {
    const el = ref.current!;
    if (composing.current) return;
    const sel: Sel = getSel(el) ?? [0, 0], t = el.textContent || "";
    // the caret was `grown` characters earlier before this keystroke
    const grown = t.length - (text.current ?? "").length, before: Sel = [Math.max(0, sel[0] - Math.max(grown, 0)), Math.max(0, sel[1] - Math.max(grown, 0))];
    commit(t, sel, true, before);
  };
  const step = (from: typeof undo, to: typeof redo) => {
    const s = from.current.pop(); if (!s) return;
    to.current.push({ text: text.current ?? "", sel: getSel(ref.current!) ?? [0, 0], at: 0, typed: false });
    draw(s.text, s.sel); change.current(s.text);
  };
  const newline = () => apply((t, [a, b]) => {
    // Enter inside a list carries the bullet on; Enter on an empty bullet ends the list
    const from = t.lastIndexOf("\n", a - 1) + 1, row = t.slice(from, a), m = /^(\s*)(?:([-*•])|(\d{1,3})([.)]))(\s+)(.*)$/.exec(row) || /^()(>)()()(\s?)(.*)$/.exec(row);
    if (m && a === b) {
      if (!m[6]) return { text: t.slice(0, from) + t.slice(a), sel: [from, from] };
      const next = `${m[1]}${m[3] ? Number(m[3]) + 1 + m[4] : m[2]}${m[5] || " "}`;
      return { text: `${t.slice(0, a)}\n${next}${t.slice(b)}`, sel: [a + 1 + next.length, a + 1 + next.length] };
    }
    return { text: `${t.slice(0, a)}\n${t.slice(b)}`, sel: [a + 1, a + 1] };
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
    if (e.key === "Enter" && !mod) { e.preventDefault(); newline(); return; }
    if (!mod || e.altKey) return;
    if (key === "z") { e.preventDefault(); e.shiftKey ? step(redo, undo) : step(undo, redo); return; }
    if (key === "y") { e.preventDefault(); step(redo, undo); return; }
    const tool = !e.shiftKey && TOOLS.find(t => t.keys === key);
    if (tool) { e.preventDefault(); apply(tool.edit); }
  };

  const active = new Set(on.split("|"));
  return (
    <div className="md-editor">
      <div className="md-tools" role="toolbar" aria-label="Formatting">
        {TOOLS.map(({ label, keys, Icon, edit }, i) => (
          <button key={label} type="button" className={`md-tool${i === 5 ? " gap" : ""}${active.has(label) ? " on" : ""}`} aria-pressed={active.has(label)} title={keys ? `${label} (${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+"}${keys.toUpperCase()})` : label} aria-label={label}
            onMouseDown={e => e.preventDefault()} onClick={() => apply(edit)}><Icon aria-hidden weight="bold" /></button>
        ))}
      </div>
      <div ref={ref} className="md-input md" role="textbox" aria-multiline="true" aria-label={label} data-placeholder={placeholder || ""} spellCheck suppressContentEditableWarning
        style={{ minHeight: `calc(${rows} * 1.6em + 22px)` }}
        onInput={onInput} onKeyDown={onKeyDown}
        onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; onInput(); }}
        onPaste={e => { e.preventDefault(); insert(e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n")); }}
        onDrop={e => { const s = e.dataTransfer.getData("text/plain"); if (s) { e.preventDefault(); insert(s.replace(/\r\n?/g, "\n")); } }} />
      {maxLength && value.length > maxLength * 0.9 ? <div className="md-count">{value.length.toLocaleString()} / {maxLength.toLocaleString()}</div> : null}
    </div>
  );
}
