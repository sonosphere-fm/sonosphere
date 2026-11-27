import { useState, type MouseEvent } from "react";
import { Button } from "../kit";
import { copyText } from "../lib";
import { t } from "../i18n";

export const selectContents = (e: MouseEvent<HTMLElement>) => {
  const r = document.createRange();
  r.selectNodeContents(e.currentTarget);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(r);
};

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyText(value).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="copy-field">
      <span className="copy-label">{label}</span>
      <span className="copy-value">
        <span onClick={selectContents}>{value}</span>
        <Button kind="btn ghost small" type="button" onClick={copy}>
          {copied ? t("settings.copied") : t("settings.copy")}
        </Button>
      </span>
    </div>
  );
}
