// Sonosphere's controls. Every button, field, menu, dialog and pager in the app goes through here and is rendered by an
// Astryx component under the Needle theme (src/themes/needle). The props mirror the DOM so pages stay plain JSX.
import { isValidElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button as AButton } from "@astryxdesign/core/Button";
import { TextInput, type TextInputType } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Ico } from "./icons";

/** Lets Astryx links (buttons with href, menu rows, tabs) navigate through the router instead of reloading. */
export const RouteLink = ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => /^(https?:|\/api\/)/.test(href || "") ? <a href={href} {...rest} /> : <RouterLink to={href || ""} {...rest} />;

const textOf = (n: ReactNode): string =>
  typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : isValidElement<{ children?: ReactNode }>(n) ? textOf(n.props.children) : "";

/**
 * kind: "btn" (primary) · "btn ghost" · "btn danger" · "+ small" · "link" · anything else is a bare control whose
 * look comes from its own class (love, play-btn, icon-btn, chip…).
 */
export function Button({ kind = "", children, disabled, loading, type, title, href, download, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { kind?: string; href?: string; download?: boolean; loading?: boolean }) {
  const k = kind.split(/\s+/).filter(Boolean), solid = k.includes("btn");
  const variant = !solid ? "ghost" : k.includes("ghost") ? "secondary" : k.includes("danger") ? "destructive" : "primary";
  const extra = k.filter(c => !["btn", "ghost", "danger", "small"].includes(c));
  const label = rest["aria-label"] || textOf(children).replace(/\s+/g, " ").trim() || title || "Button";
  const link = href ? { href, ...(download ? { download: true } : {}) } : { type: type ?? "submit" };
  // Astryx's props leave out `title`, but it passes every extra prop on to the <button>, so it goes in with the rest
  const dom = { ...rest, title };
  return (
    <AButton {...dom} {...link} label={label} variant={variant} size={solid && !k.includes("small") ? "md" : "sm"} isDisabled={disabled} isLoading={loading}
      className={[solid ? "" : "bare", ...extra].filter(Boolean).join(" ") || undefined}>
      {children}
    </AButton>
  );
}

const TEXT = new Set(["text", "password", "email", "search", "tel", "url"]);
const isText = (t: string): t is TextInputType => TEXT.has(t);
export function Input({ type = "text", value, onChange, placeholder, disabled, autoFocus, name, autoComplete, className, checked, ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const label = rest["aria-label"] || placeholder || name || "Field";
  if (type === "checkbox") return <CheckboxInput label={label} isLabelHidden value={!!checked} onChange={(_, e) => onChange?.(e)} isDisabled={disabled} />;
  // dates, numbers and file pickers keep the browser's own control, drawn with the same border and focus ring
  if (!isText(type)) return <input {...rest} ref={ref} className={"native-input " + (className || "")} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} name={name} />;
  return (
    <TextInput type={type} label={label} isLabelHidden value={String(value ?? "")} onChange={(_, e) => onChange?.(e)} placeholder={placeholder} isDisabled={disabled}
      hasAutoFocus={autoFocus} htmlName={name} autoComplete={autoComplete} containerClassName={"field " + (className || "")} />
  );
}
/** A text field with its search button built into the right edge. Put it inside a <form>. */
export function SearchField({ value, onChange, placeholder, autoFocus, label = "Search", clearable }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; label?: string; clearable?: boolean }) {
  return (
    <div className="search-field">
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoFocus={autoFocus} />
      {clearable && value && <Button kind="search-clear" type="button" aria-label="Clear search" onClick={() => onChange("")}><Ico.XCircle /></Button>}
      <Button kind="search-go" aria-label="Search"><Ico.Search /></Button>
    </div>
  );
}
export function Textarea({ value, onChange, placeholder, disabled, autoFocus, rows, maxLength, name, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <TextArea label={rest["aria-label"] || placeholder || name || "Text"} isLabelHidden value={String(value ?? "")} onChange={(_, e) => onChange?.(e)} placeholder={placeholder}
      isDisabled={disabled} hasAutoFocus={autoFocus} rows={rows} htmlMaxLength={maxLength} htmlName={name} containerClassName={"field " + (className || "")} />
  );
}
export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <Selector label={label} isLabelHidden size="sm" value={value} onChange={onChange} options={options.map(([v, l]) => ({ value: v, label: l }))} />;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog isOpen onOpenChange={open => { if (!open) onClose(); }} width={460} purpose="form">
      <DialogHeader title={title} onOpenChange={() => onClose()} />
      {children}
    </Dialog>
  );
}
export function Pages({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return <div className="pager"><Pagination label="Pagination" page={page} totalPages={pages} onChange={onChange} variant="pages" siblingCount={1} /></div>;
}
