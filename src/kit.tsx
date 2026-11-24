import {
  isValidElement,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button as AButton } from "@astryxdesign/core/Button";
import { TextInput, type TextInputType } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Selector, SelectorOption, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Ico } from "./icons";
import { t } from "./i18n";

const SERVER_PATHS = /^(https?:|\/api\/|\/discord$)/;

/** Lets Astryx links navigate through the router instead of reloading. */
export const RouteLink = ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  if (SERVER_PATHS.test(href || "")) return <a href={href} {...rest} />;
  return <RouterLink to={href || ""} {...rest} />;
};

const textOf = (n: ReactNode): string => {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
};

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  kind?: string;
  href?: string;
  download?: boolean;
  loading?: boolean;
};

/**
 * kind: "btn" (primary), "btn ghost", "btn danger", plus "small". Anything else is a bare control whose
 * look comes from its own class (love, play-btn, chip...).
 */
export function Button({ kind = "", children, disabled, loading, type, title, href, download, ...rest }: ButtonProps) {
  const k = kind.split(/\s+/).filter(Boolean);
  const solid = k.includes("btn");
  let variant: "ghost" | "secondary" | "destructive" | "primary" = "primary";
  if (!solid) variant = "ghost";
  else if (k.includes("ghost")) variant = "secondary";
  else if (k.includes("danger")) variant = "destructive";
  const extra = k.filter((c) => !["btn", "ghost", "danger", "small"].includes(c));
  const className = [solid ? "" : "bare", ...extra].filter(Boolean).join(" ") || undefined;
  const label = rest["aria-label"] || textOf(children).replace(/\s+/g, " ").trim() || title || t("common.button");
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

export function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  name,
  autoComplete,
  className,
  checked,
  ref,
  ...rest
}: InputProps) {
  const label = rest["aria-label"] || placeholder || name || t("common.field");
  if (type === "checkbox") {
    return (
      <CheckboxInput
        label={label}
        isLabelHidden
        value={!!checked}
        onChange={(_, e) => onChange?.(e)}
        isDisabled={disabled}
      />
    );
  }
  // dates, numbers and file pickers keep the browser's own control
  if (!isText(type)) {
    return (
      <input
        {...rest}
        ref={ref}
        className={"native-input " + (className || "")}
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
      containerClassName={"field " + (className || "")}
    />
  );
}

type SearchFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
  clearable?: boolean;
};

/** Put it inside a <form>. */
export function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
  label = t("common.search"),
  clearable,
}: SearchFieldProps) {
  return (
    <div className="search-field">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
      />
      {clearable && value && (
        <Button kind="search-clear" type="button" aria-label={t("common.clearSearch")} onClick={() => onChange("")}>
          <Ico.XCircle />
        </Button>
      )}
      <Button kind="search-go" aria-label={t("common.search")}>
        <Ico.Search />
      </Button>
    </div>
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  rows,
  maxLength,
  name,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <TextArea
      label={rest["aria-label"] || placeholder || name || t("common.text")}
      isLabelHidden
      value={String(value ?? "")}
      onChange={(_, e) => onChange?.(e)}
      placeholder={placeholder}
      isDisabled={disabled}
      hasAutoFocus={autoFocus}
      rows={rows}
      htmlMaxLength={maxLength}
      htmlName={name}
      containerClassName={"field " + (className || "")}
    />
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
  render?: (value: string, label: string) => ReactNode;
}) {
  const labels = new Map(options);
  const items = options.map(([v, l]) => ({ value: v, label: l }));
  const custom = render
    ? (option: SelectorOptionData) => (
        <SelectorOption layout="inline" label={render(option.value, labels.get(option.value)!)} />
      )
    : undefined;
  return (
    <Selector
      label={label}
      isLabelHidden
      isDisabled={disabled}
      size="sm"
      value={value}
      onChange={onChange}
      options={items}
      renderOption={custom}
      renderValue={custom}
    />
  );
}

export function Modal({
  title,
  onClose,
  children,
  width = 460,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={width}
      purpose="form"
    >
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
      <form
        className="form confirm"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        {a.body && <p className="muted">{a.body}</p>}
        {err && (
          <p className="form-error" role="alert">
            {err}
          </p>
        )}
        <div className="row">
          <Button kind={a.danger ? "btn danger" : "btn"} loading={busy} autoFocus>
            {a.action}
          </Button>
          <Button kind="btn ghost" type="button" onClick={close}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Pages({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <Pagination
        label={t("common.pagination")}
        page={page}
        totalPages={pages}
        onChange={onChange}
        variant="pages"
        siblingCount={1}
      />
    </div>
  );
}
