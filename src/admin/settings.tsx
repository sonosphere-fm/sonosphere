import { useState, type FormEvent } from "react";
import { Button, Input, Select, Textarea } from "../kit";
import { api, useApi, useTitle } from "../lib";
import { Async, Section } from "../ui/base";
import { cx, useConfirm } from "./common";
import { t } from "./i18n";
import type { AdminSettings } from "../../shared/admin-content";
import { ManageLabelDefinitions } from "./user-labels";

const PAGE = "flex flex-col gap-8 max-w-[640px] [&>.section]:mb-0";
const FORM = cx(
  "form [&_.section]:mb-[18px] [&>.section:last-of-type]:mb-0 [&>.section>p:last-child]:mb-0",
  "[&_input[type=number]]:max-w-[140px] [&_.field-block]:mb-4 [&_.field-block+p]:-mt-2"
);

export function SiteSettings() {
  const q = useApi<AdminSettings>("/admin/settings");
  useTitle(t("admin.navSettings"));
  const saved = (s: AdminSettings) => {
    q.setData(s);
    window.dispatchEvent(new Event("spin:site"));
  };
  return (
    <div className={PAGE}>
      <Async q={q}>{(d) => <SettingsForm key={JSON.stringify(d)} initial={d} saved={saved} />}</Async>
      <ManageLabelDefinitions />
    </div>
  );
}
type Fields = { registrationsOpen: boolean; announcement: string; announcementTone: string; maxShoutLength: string };
function SettingsForm({ initial, saved }: { initial: AdminSettings; saved: (s: AdminSettings) => void }) {
  const [f, setF] = useState<Fields>({
    registrationsOpen: initial.registrationsOpen,
    announcement: initial.announcement,
    announcementTone: initial.announcementTone,
    maxShoutLength: String(initial.maxShoutLength),
  });
  const [modal, ask] = useConfirm();
  const [msg, setMsg] = useState("");
  const dirty =
    f.registrationsOpen !== initial.registrationsOpen ||
    f.announcement !== initial.announcement ||
    f.announcementTone !== initial.announcementTone ||
    Number(f.maxShoutLength) !== initial.maxShoutLength;
  const closing = !f.registrationsOpen && initial.registrationsOpen;
  const save = (note: string) =>
    api<AdminSettings>("/admin/settings", { body: { ...f, maxShoutLength: Number(f.maxShoutLength), note } }).then(
      (s) => {
        saved(s);
        setMsg(t("admin.settingsSaved"));
      }
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    ask({
      title: t("admin.saveSiteSettings"),
      action: t("admin.save"),
      danger: closing,
      body: closing ? <p>{t("admin.closingRegistrations")}</p> : <p>{t("admin.changesApplyNow")}</p>,
      run: save,
    });
  };
  const announcement = f.announcement.trim();
  return (
    <>
      {modal}
      <form className={FORM} onSubmit={submit}>
        <Section title={t("admin.registrations")}>
          <label className="check">
            <Input
              type="checkbox"
              checked={f.registrationsOpen}
              onChange={(e) => setF({ ...f, registrationsOpen: e.target.checked })}
            />{" "}
            <span>
              <b>{t("admin.openForSignups")}</b>
              <br />
              <span className="muted small">{t("admin.openForSignupsHint")}</span>
            </span>
          </label>
        </Section>
        <Section title={t("admin.announcementBanner")}>
          <label className="field-block">
            <span className="field-label">{t("admin.message")}</span>
            <Textarea
              rows={2}
              value={f.announcement}
              onChange={(e) => setF({ ...f, announcement: e.target.value })}
              maxLength={500}
              placeholder={t("admin.noBannerPlaceholder")}
            />
          </label>
          <label className="field-block">
            <span className="field-label">{t("admin.style")}</span>
            <Select
              label={t("admin.style")}
              value={f.announcementTone}
              onChange={(v) => setF({ ...f, announcementTone: v })}
              options={[
                ["info", t("admin.toneInfo")],
                ["warning", t("admin.toneWarning")],
              ]}
            />
          </label>
          <p className="muted small">{t("admin.bannerHint")}</p>
          {announcement && (
            <div className={`site-banner ${f.announcementTone} preview`}>
              <div className="site-banner-in">
                <span>{announcement}</span>
              </div>
            </div>
          )}
        </Section>
        <Section title={t("admin.wallPosts")}>
          <label className="field-block">
            <span className="field-label">{t("admin.longestWallPostChars")}</span>
            <Input
              type="number"
              min={50}
              max={1000}
              value={f.maxShoutLength}
              onChange={(e) => setF({ ...f, maxShoutLength: e.target.value })}
              aria-label={t("admin.longestWallPost")}
            />
          </label>
          <p className="muted small">{t("admin.wallPostLengthHint")}</p>
        </Section>
        {msg && (
          <p className="form-ok" role="status">
            {msg}
          </p>
        )}
        <Button kind="btn" disabled={!dirty}>
          {t("admin.saveSettings")}
        </Button>
      </form>
    </>
  );
}
