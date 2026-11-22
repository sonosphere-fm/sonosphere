import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Select } from "../kit";
import { api, invalidateAll, useApi } from "../lib";
import { Section, useAction } from "../ui/base";
import { UserLabelBadge } from "../ui/user-labels";
import { LABEL_ICONS, type LabelDirectory, type UserLabel } from "../../shared/user-labels";

export function ManageLabelDefinitions() {
  const q = useApi<LabelDirectory>("/admin/user-labels");
  const act = useAction();
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState({ text: "", icon: LABEL_ICONS[0] as UserLabel["icon"], color: "#4263eb" });
  const d = q.data ?? { labels: [], users: {} };
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); invalidateAll(); return "Tags saved."; });
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(edit === null ? "/admin/user-labels" : `/admin/user-labels/${edit}`, { method: edit === null ? "POST" : "PATCH", body: draft });
      setEdit(null); setDraft({ text: "", icon: "star", color: "#4263eb" });
    });
  };
  return <Section title="User tags">
    {q.error && <p className="form-error font-semibold m-0 text-bad" role="alert">{q.error.message}</p>}
    <p className="text-muted text-[13px]">All tags appear on the profile. The first appears beside their name elsewhere. Tags do not grant permissions.</p>
    <h3 className="mt-[22px]">{edit === null ? "Create a tag" : "Edit tag everywhere"}</h3>
    <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full" onSubmit={save}>
      <label>Text<Input value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} maxLength={40} required /></label>
      <label>Icon<Select label="Tag icon" value={draft.icon} onChange={icon => setDraft({ ...draft, icon: icon as UserLabel["icon"] })} options={LABEL_ICONS.map(icon => [icon, icon])} /></label>
      <label>Color<Input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} /></label>
      {draft.text && <UserLabelBadge label={{ id: 0, ...draft }} />}
      <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2"><Button kind="btn small" loading={act.busy}>{edit === null ? "Create tag" : "Save tag"}</Button>{edit !== null && <Button type="button" kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" onClick={() => { setEdit(null); setDraft({ text: "", icon: "star", color: "#4263eb" }); }}>Cancel edit</Button>}</div>
    </form>
    <h3 className="mt-[22px]">Available tags</h3>
    {!d.labels.length && <p className="text-muted">No tags have been created.</p>}
    <ul className="list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">{d.labels.map(label => <li key={label.id} className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2"><UserLabelBadge label={label} />
      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" disabled={act.busy} onClick={() => { setEdit(label.id); setDraft({ text: label.text, icon: label.icon, color: label.color }); }}>Edit</Button>
      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" disabled={act.busy} onClick={() => { if (window.confirm(`Delete “${label.text}” from everyone?`)) run(() => api(`/admin/user-labels/${label.id}`, { method: "DELETE" })); }}>Delete everywhere</Button>
    </li>)}</ul>
    {act.note}
  </Section>;
}

export function ManageUserLabels({ name }: { name: string }) {
  const q = useApi<LabelDirectory>("/admin/user-labels");
  const act = useAction();
  const [pick, setPick] = useState("");
  const d = q.data ?? { labels: [], users: {} };
  const ids = d.users[name.toLowerCase()] ?? [];
  const assign = (next: number[]) => act.run(async () => {
    await api(`/admin/users/${encodeURIComponent(name)}/labels`, { method: "PATCH", body: { ids: next } });
    invalidateAll();
    return "Tags saved.";
  });
  const move = (index: number, offset: number) => {
    const next = [...ids];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    assign(next);
  };
  return <Section title="User tags">
    <p className="text-muted text-[13px]">All tags appear on the profile. The first appears beside their name elsewhere.</p>
    <p className="text-[13px]">Create and edit tags in <Link to="/admin/settings">Site Settings</Link>.</p>
    {q.error && <p className="form-error font-semibold m-0 text-bad" role="alert">{q.error.message}</p>}
    <ul className="list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">{ids.map((id, index) => {
      const label = d.labels.find(l => l.id === id);
      return label && <li key={id} className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2"><UserLabelBadge label={label} />
        <Button kind="btn ghost small" disabled={act.busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${label.text} up`}>↑</Button>
        <Button kind="btn ghost small" disabled={act.busy || index === ids.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${label.text} down`}>↓</Button>
        <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" disabled={act.busy} onClick={() => assign(ids.filter(n => n !== id))}>Remove</Button>
      </li>;
    })}</ul>
    {!ids.length && <p className="text-muted">No tags assigned.</p>}
    <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
      <Select label="Tag to assign" value={pick} onChange={setPick} options={[["", "Choose a tag"], ...d.labels.filter(l => !ids.includes(l.id)).map(l => [String(l.id), l.text] as [string, string])]} />
      <Button kind="btn small" disabled={!pick || act.busy || ids.length >= 20} onClick={() => { assign([...ids, Number(pick)]); setPick(""); }}>Assign tag</Button>
    </div>
    {act.note}
  </Section>;
}
