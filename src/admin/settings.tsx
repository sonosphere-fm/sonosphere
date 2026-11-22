import { useState, type FormEvent } from "react";
import { Button, Input, Select, Textarea } from "../kit";
import { api, useApi, useTitle } from "../lib";
import { Async, Section } from "../ui/base";
import { useConfirm } from "./common";
import type { AdminSettings } from "../../shared/admin-content";
import { ManageLabelDefinitions } from "./user-labels";

export function SiteSettings() {
  const q = useApi<AdminSettings>("/admin/settings");
  useTitle("Site settings");
  const saved = (s: AdminSettings) => {
    q.setData(s);
    window.dispatchEvent(new Event("spin:site"));
  };
  return <div className="flex flex-col gap-8 max-w-[640px] [&>.section]:mb-0"><Async q={q}>{d => <SettingsForm key={JSON.stringify(d)} initial={d} saved={saved} />}</Async><ManageLabelDefinitions /></div>;
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
  const dirty = f.registrationsOpen !== initial.registrationsOpen
    || f.announcement !== initial.announcement
    || f.announcementTone !== initial.announcementTone
    || Number(f.maxShoutLength) !== initial.maxShoutLength;
  const closing = !f.registrationsOpen && initial.registrationsOpen;
  const save = (note: string) =>
    api<AdminSettings>("/admin/settings", { body: { ...f, maxShoutLength: Number(f.maxShoutLength), note } }).then(s => {
      saved(s);
      setMsg("Settings saved.");
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    ask({
      title: "Save site settings",
      action: "Save",
      danger: closing,
      body: closing
        ? <p>New people won't be able to sign up until registrations are opened again. Admins named in the server configuration still can.</p>
        : <p>Changes apply to everyone straight away.</p>,
      run: save,
    });
  };
  const announcement = f.announcement.trim();
  return (
    <>
      {modal}
      <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full max-w-[640px] [&_.section]:mb-[18px] [&>.section:last-of-type]:mb-0 [&>.section>p:last-child]:mb-0 [&_input[type=number]]:max-w-[140px]" onSubmit={submit}>
        <Section title="Registrations">
          <label className="check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0!">
            <Input type="checkbox" checked={f.registrationsOpen} onChange={e => setF({ ...f, registrationsOpen: e.target.checked })} />{" "}
            <span>
              <b>Open for new sign-ups</b>
              <br />
              <span className="text-muted text-[13px]">When closed, the sign-up form refuses new accounts. Existing members can still log in.</span>
            </span>
          </label>
        </Section>
        <Section title="Announcement banner">
          <label>
            Message
            <Textarea
              rows={2}
              value={f.announcement}
              onChange={e => setF({ ...f, announcement: e.target.value })}
              maxLength={500}
              placeholder="Leave empty for no banner"
            />
          </label>
          <label>
            Style
            <Select
              label="Style"
              value={f.announcementTone}
              onChange={v => setF({ ...f, announcementTone: v })}
              options={[["info", "Information"], ["warning", "Warning"]]}
            />
          </label>
          <p className="text-muted text-[13px]">Shown at the top of every page. People can dismiss it; changing the text shows it to them again.</p>
          {announcement && (
            <div className={`site-banner ${f.announcementTone} preview`}>
              <div className="site-banner-in"><span>{announcement}</span></div>
            </div>
          )}
        </Section>
        <Section title="Wall posts">
          <label>
            Longest wall post, in characters
            <Input
              type="number"
              min={50}
              max={1000}
              value={f.maxShoutLength}
              onChange={e => setF({ ...f, maxShoutLength: e.target.value })}
              aria-label="Longest wall post"
            />
          </label>
          <p className="text-muted text-[13px]">Between 50 and 1000. Applies to wall posts and journal comments.</p>
        </Section>
        {msg && <p className="font-semibold m-0 text-ok" role="status">{msg}</p>}
        <Button kind="btn" disabled={!dirty}>Save settings</Button>
      </form>
    </>
  );
}
