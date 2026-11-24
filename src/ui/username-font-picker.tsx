import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { USERNAME_FONTS, type UsernameFont } from "../../shared/username-fonts";
import { Ico } from "../icons";
import { t } from "../i18n";
import { Username } from "./username";

export function UsernameFontPicker({
  value,
  onChange,
  disabled,
}: {
  value: UsernameFont;
  onChange: (value: UsernameFont) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = USERNAME_FONTS.find((font) => font.id === value) ?? USERNAME_FONTS[0];
  const label = (font: (typeof USERNAME_FONTS)[number]) =>
    font.id === "default" ? t("settings.siteDefault") : font.label;
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    root.current?.querySelector<HTMLButtonElement>(`[data-font="${value}"]`)?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>("[data-font]")];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const columns = getComputedStyle(buttons[0].parentElement!).gridTemplateColumns.split(" ").length;
    const delta =
      event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : event.key === "ArrowRight" ? 1 : -1;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : Math.max(0, Math.min(buttons.length - 1, current + delta));
    buttons[index]?.focus();
  };
  return (
    <div
      className="username-font-picker"
      ref={root}
      onKeyDown={keyboard}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="username-font-trigger"
        aria-label={t("settings.usernameFontCurrent", { font: label(selected) })}
        aria-expanded={open && !disabled}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Username name={label(selected)} font={value} />
        <Ico.ChevDown />
      </button>
      {open && !disabled && (
        <div className="username-font-popover" role="dialog" aria-label={t("settings.chooseUsernameFont")}>
          <div className="username-font-grid">
            {USERNAME_FONTS.map((font) => (
              <button
                type="button"
                key={font.id}
                data-font={font.id}
                aria-pressed={value === font.id}
                onClick={() => {
                  onChange(font.id);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <Username name={label(font)} font={font.id} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
