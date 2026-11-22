import { isValidElement, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button as AButton } from "@astryxdesign/core/Button";
import { TextInput, type TextInputType } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Ico } from "./icons";
import { cn, form, nativeInput, row } from "./ui/tw";

/** Lets Astryx links navigate through the router instead of reloading. */
export const RouteLink = ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  if (/^(https?:|\/api\/)/.test(href || "")) return <a href={href} {...rest} />;
  return <RouterLink to={href || ""} {...rest} />;
};

const textOf = (n: ReactNode): string => {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: string;
  href?: string;
  download?: boolean;
  loading?: boolean;
};

/**
 * kind: "btn" (primary), "btn ghost", "btn danger", plus "small". Without "btn" it is a bare control
 * that takes its whole look from className. Utilities in className win over the Astryx look.
 * Any other word in kind is added as a class: the hooks styles.css keys off (`play-btn`, `on`) and the
 * `active` that marks a current tab.
 */
export function Button({ kind = "", className: extra, children, disabled, loading, type, title, href, download, ...rest }: ButtonProps) {
  const k = kind.split(/\s+/).filter(Boolean);
  const solid = k.includes("btn");
  let variant: "ghost" | "secondary" | "destructive" | "primary" = "primary";
  if (!solid) variant = "ghost";
  else if (k.includes("ghost")) variant = "secondary";
  else if (k.includes("danger")) variant = "destructive";
  // `bare` tells the Astryx overrides in styles.css to leave this button's look alone
  const hooks = k.filter(c => !["btn", "ghost", "danger", "small"].includes(c));
  const className = cn(!solid && "bare", ...hooks, extra) || undefined;
  const label = rest["aria-label"] || textOf(children).replace(/\s+/g, " ").trim() || title || "Button";
  const link = href ? { href, ...(download ? { download: true } : {}) } : { type: type ?? "submit" };
  // Astryx's props leave out `title`, but it passes extra props on to the <button>
  const dom = { ...rest, title };
  return (
    <AButton
      {...dom}
      {...link}
      label={label}
      variant={variant}
      size={solid && !k.includes("small") ? "md" : "sm"}
      isDisabled={disabled}
      isLoading={loading}
      className={className}
    >
      {children}
    </AButton>
  );
}

const TEXT = new Set(["text", "password", "email", "search", "tel", "url"]);
const isText = (t: string): t is TextInputType => TEXT.has(t);

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

export function Input({ type = "text", value, onChange, placeholder, disabled, autoFocus, name, autoComplete, className, checked, ref, ...rest }: InputProps) {
  const label = rest["aria-label"] || placeholder || name || "Field";
  if (type === "checkbox") {
    return <CheckboxInput label={label} isLabelHidden value={!!checked} onChange={(_, e) => onChange?.(e)} isDisabled={disabled} />;
  }
  // dates, numbers and file pickers keep the browser's own control
  if (!isText(type)) {
    return (
      <input
        {...rest}
        ref={ref}
        className={cn(nativeInput, type === "file" && "border-dashed bg-panel", className)}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
      />
    );
  }
  return (
    <TextInput
      type={type}
      label={label}
      isLabelHidden
      value={String(value ?? "")}
      onChange={(_, e) => onChange?.(e)}
      placeholder={placeholder}
      isDisabled={disabled}
      hasAutoFocus={autoFocus}
      htmlName={name}
      autoComplete={autoComplete}
      containerClassName={cn(field, className)}
    />
  );
}

/** Astryx field container: grows in a flex row. `field` stays as a hook for layouts that place fields. */
const field = "field flex-1 min-w-0";

type SearchFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
  clearable?: boolean;
  /** Sizes the box; the go button takes `search-go` should it need adjusting. */
  className?: string;
};

const searchBox = "search-field flex items-stretch w-full h-[46px] overflow-hidden rounded-none border border-edge bg-card shadow-[inset_0_1px_3px_var(--inset)] "
  + "focus-within:border-accent focus-within:shadow-[inset_0_1px_3px_var(--inset),0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)] "
  // the Astryx field inside fills the box with no frame of its own
  + "[&_.astryx-field]:flex [&_.astryx-field]:flex-1 [&_.astryx-field]:min-w-0 [&_.astryx-field]:h-full "
  + "[&_.astryx-field>div]:flex [&_.astryx-field>div]:flex-1 [&_.astryx-field>div]:min-w-0 [&_.astryx-field>div]:h-full "
  + "[&_.astryx-text-input]:flex [&_.astryx-text-input]:flex-1 [&_.astryx-text-input]:min-w-0 [&_.astryx-text-input]:h-full [&_.astryx-text-input]:min-h-0 "
  + "[&_.astryx-text-input]:rounded-none [&_.astryx-text-input]:bg-transparent [&_.astryx-text-input]:outline-0 [&_.astryx-text-input]:px-3.5 [&_.astryx-text-input]:py-0 [&_.astryx-text-input]:border-0 [&_.astryx-text-input]:shadow-none "
  + "[&_input]:w-full";

/** Put it inside a <form>. */
export function SearchField({ value, onChange, placeholder, autoFocus, label = "Search", clearable, className }: SearchFieldProps) {
  return (
    <div className={cn(searchBox, className)}>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoFocus={autoFocus} />
      {clearable && value && (
        <Button
          className="flex-none w-9 h-auto p-0 min-w-0 rounded-none border-0 bg-transparent text-muted hover:bg-transparent hover:text-ink"
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
        ><Ico.XCircle /></Button>
      )}
      <Button
        className="search-go inline-flex flex-none items-center justify-center w-12 h-auto p-0 rounded-none border-0 border-l border-line bg-card text-[18px] text-ink-2 hover:bg-panel hover:text-ink"
        aria-label="Search"
      ><Ico.Search /></Button>
    </div>
  );
}

export function Textarea({ value, onChange, placeholder, disabled, autoFocus, rows, maxLength, name, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <TextArea
      label={rest["aria-label"] || placeholder || name || "Text"}
      isLabelHidden
      value={String(value ?? "")}
      onChange={(_, e) => onChange?.(e)}
      placeholder={placeholder}
      isDisabled={disabled}
      hasAutoFocus={autoFocus}
      rows={rows}
      htmlMaxLength={maxLength}
      htmlName={name}
      containerClassName={cn(field, className)}
    />
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const items = options.map(([v, l]) => ({ value: v, label: l }));
  return <Selector label={label} isLabelHidden size="sm" value={value} onChange={onChange} options={items} />;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog isOpen onOpenChange={open => { if (!open) onClose(); }} width={460} purpose="form">
      <DialogHeader title={title} onOpenChange={() => onClose()} />
      {children}
    </Dialog>
  );
}

type Ask = { title: string; body?: ReactNode; action: string; danger?: boolean; run: () => Promise<unknown> | void };

/** Render `dialog` somewhere; call `ask({...})` to open it. */
export function useConfirm() {
  const [a, ask] = useState<Ask | null>(null);
  return { ask, dialog: a ? <Confirm a={a} close={() => ask(null)} /> : null };
}

function Confirm({ a, close }: { a: Ask; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await a.run();
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Modal title={a.title} onClose={close}>
      <form className={form} onSubmit={e => { e.preventDefault(); go(); }}>
        {a.body && <p className="text-muted">{a.body}</p>}
        {err && <p className="form-error font-semibold m-0 text-bad" role="alert">{err}</p>}
        <div className={row}>
          <Button kind={a.danger ? "btn danger" : "btn"} loading={busy} autoFocus>{a.action}</Button>
          <Button kind="btn ghost" type="button" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

export function Pages({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex justify-center items-center gap-1 mt-[22px] flex-wrap">
      <Pagination label="Pagination" page={page} totalPages={pages} onChange={onChange} variant="pages" siblingCount={1} />
    </div>
  );
}
