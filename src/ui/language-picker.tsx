import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import type { ComponentType } from "react";
import US from "country-flag-icons/react/3x2/US";
import ES from "country-flag-icons/react/3x2/ES";
import DE from "country-flag-icons/react/3x2/DE";
import RO from "country-flag-icons/react/3x2/RO";
import LV from "country-flag-icons/react/3x2/LV";
import { Globe } from "@phosphor-icons/react";
import { api, useAuth } from "../lib";
import { Select } from "../kit";
import { chosenLocale, locale, switchLocale, t } from "../i18n";
import { isLocale, LOCALE_NAMES, LOCALES, type Locale } from "../../shared/i18n/core";
import { useAction } from "./base";
import type { ProfileSaved } from "../../shared/account";

const AUTO = "auto";
const FLAGS: Record<Locale, ComponentType<{ className?: string }>> = { en: US, es: ES, de: DE, ro: RO, lv: LV };

function LanguageIcon({ value }: { value: string }) {
  if (!isLocale(value)) return <Globe size={18} weight="bold" className="language-icon" aria-hidden />;
  const Flag = FLAGS[value];
  return <Flag className="flag language-icon" />;
}

const trigger =
  "inline-flex items-center gap-1.5 h-8 px-1 bg-transparent text-[#f6f2e9] border-none rounded-none " +
  "hover:text-site-sun disabled:cursor-progress disabled:opacity-60";

function useLanguage() {
  const { me } = useAuth();
  const act = useAction();
  const value = (me ? me.locale : chosenLocale()) || AUTO;
  const options: [string, string][] = [
    [AUTO, t("common.languageAutomatic")],
    ...LOCALES.map((l): [string, string] => [l, LOCALE_NAMES[l]]),
  ];
  const change = (v: string) =>
    act.run(async () => {
      const next = isLocale(v) ? v : "";
      if (me) await api<ProfileSaved>("/me", { method: "PATCH", body: { locale: next } });
      switchLocale(next);
    });
  return { act, value, options, change };
}

export function LanguagePicker() {
  const { act, value, options, change } = useLanguage();
  return (
    <span className="language-picker">
      <Select
        label={t("common.language")}
        value={value}
        onChange={change}
        options={options}
        disabled={act.busy}
        render={(v, label) => (
          <span className="inline-flex items-center gap-2">
            <LanguageIcon value={v} />
            {label}
          </span>
        )}
      />
      {act.note}
    </span>
  );
}

export function LanguageMenu() {
  const { act, value, options, change } = useLanguage();
  return (
    <span className="footer-theme inline-flex items-center gap-2.5">
      <DropdownMenu
        placement="above"
        alignment="start"
        menuWidth={180}
        renderTrigger={(props) => (
          <button type="button" className={trigger} disabled={act.busy} aria-label={t("common.language")} {...props}>
            <LanguageIcon value={locale()} />
            {LOCALE_NAMES[locale()]}
          </button>
        )}
      >
        {options.map(([v, label]) => (
          <DropdownMenuItem
            key={v}
            label={label}
            icon={<LanguageIcon value={v} />}
            className={v === value ? "language-current" : undefined}
            onClick={() => change(v)}
          />
        ))}
      </DropdownMenu>
      {act.note}
    </span>
  );
}
