import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { useState, type ReactNode } from "react";
import { Ico } from "../icons";
import { copyText } from "../lib";
import { t } from "../i18n";

export function MoreMenu({ label, link, children }: { label: string; link: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyText(link).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  const button = { label, variant: "secondary", className: "more-btn sq", children: <Ico.MoreV /> } as const;
  return (
    <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={200} button={button}>
      <DropdownMenuItem
        label={copied ? t("common.copied") : t("common.copyLink")}
        hasCloseOnSelect={false}
        onClick={copy}
      />
      {children}
    </DropdownMenu>
  );
}
