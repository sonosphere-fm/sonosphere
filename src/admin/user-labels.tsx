import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Select } from "../kit";
import { api, invalidateAll, useApi } from "../lib";
import { Section, useAction } from "../ui/base";
import { UserLabelBadge } from "../ui/user-labels";
import { LABEL_ICONS, type LabelDirectory, type UserLabel } from "../../shared/user-labels";
import { t, tx } from "./i18n";

export function ManageLabelDefinitions() {
  const q = useApi<LabelDirectory>("/admin/user-labels");
  const act = useAction();
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState({ text: "", icon: LABEL_ICONS[0] as UserLabel["icon"], color: "#4263eb" });
  const d = q.data ?? { labels: [], users: {} };
  const run = (fn: () => Promise<unknown>) =>
    act.run(async () => {
      await fn();
      invalidateAll();
      return t("admin.tagsSaved");
    });
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(edit === null ? "/admin/user-labels" : `/admin/user-labels/${edit}`, {
        method: edit === null ? "POST" : "PATCH",
        body: draft,
      });
      setEdit(null);
      setDraft({ text: "", icon: "star", color: "#4263eb" });
    });
  };
  return (
    <Section title={t("admin.userTags")}>
      {q.error && (
        <p className="form-error" role="alert">
          {q.error.message}
        </p>
      )}
      <p className="muted small">{t("admin.tagsHintPermissions")}</p>
      <h3 className="user-label-editor-title">
        {edit === null ? t("admin.createATag") : t("admin.editTagEverywhere")}
      </h3>
      <form className="form" onSubmit={save}>
        <label>
          {t("admin.tagText")}
          <Input
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            maxLength={40}
            required
          />
        </label>
        <label>
          {t("admin.tagIconField")}
          <Select
            label={t("admin.tagIcon")}
            value={draft.icon}
            onChange={(icon) => setDraft({ ...draft, icon: icon as UserLabel["icon"] })}
            options={LABEL_ICONS.map((icon) => [icon, icon])}
          />
        </label>
        <label>
          {t("admin.tagColor")}
          <Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        </label>
        {draft.text && <UserLabelBadge label={{ id: 0, ...draft }} />}
        <div className="row">
          <Button kind="btn small" loading={act.busy}>
            {edit === null ? t("admin.createTag") : t("admin.saveTag")}
          </Button>
          {edit !== null && (
            <Button
              type="button"
              kind="link small"
              onClick={() => {
                setEdit(null);
                setDraft({ text: "", icon: "star", color: "#4263eb" });
              }}
            >
              {t("admin.cancelEdit")}
            </Button>
          )}
        </div>
      </form>
      <h3 className="user-label-editor-title">{t("admin.availableTags")}</h3>
      {!d.labels.length && <p className="muted">{t("admin.noTagsCreated")}</p>}
      <ul className="plain">
        {d.labels.map((label) => (
          <li key={label.id} className="row">
            <UserLabelBadge label={label} />
            <Button
              kind="link small"
              disabled={act.busy}
              onClick={() => {
                setEdit(label.id);
                setDraft({ text: label.text, icon: label.icon, color: label.color });
              }}
            >
              {t("admin.edit")}
            </Button>
            <Button
              kind="link small"
              disabled={act.busy}
              onClick={() => {
                if (window.confirm(t("admin.deleteTagConfirm", { name: label.text })))
                  run(() => api(`/admin/user-labels/${label.id}`, { method: "DELETE" }));
              }}
            >
              {t("admin.deleteEverywhere")}
            </Button>
          </li>
        ))}
      </ul>
      {act.note}
    </Section>
  );
}

export function ManageUserLabels({ name }: { name: string }) {
  const q = useApi<LabelDirectory>("/admin/user-labels");
  const act = useAction();
  const [pick, setPick] = useState("");
  const d = q.data ?? { labels: [], users: {} };
  const ids = d.users[name.toLowerCase()] ?? [];
  const assign = (next: number[]) =>
    act.run(async () => {
      await api(`/admin/users/${encodeURIComponent(name)}/labels`, { method: "PATCH", body: { ids: next } });
      invalidateAll();
      return t("admin.tagsSaved");
    });
  const move = (index: number, offset: number) => {
    const next = [...ids];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    assign(next);
  };
  return (
    <Section title={t("admin.userTags")}>
      <p className="muted small">{t("admin.tagsHint")}</p>
      <p className="small">
        {tx("admin.createTagsIn", { link: <Link to="/admin/settings">{t("admin.siteSettingsLink")}</Link> })}
      </p>
      {q.error && (
        <p className="form-error" role="alert">
          {q.error.message}
        </p>
      )}
      <ul className="plain">
        {ids.map((id, index) => {
          const label = d.labels.find((l) => l.id === id);
          return (
            label && (
              <li key={id} className="row">
                <UserLabelBadge label={label} />
                <Button
                  kind="btn ghost small"
                  disabled={act.busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t("admin.moveUp", { name: label.text })}
                >
                  ↑
                </Button>
                <Button
                  kind="btn ghost small"
                  disabled={act.busy || index === ids.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t("admin.moveDown", { name: label.text })}
                >
                  ↓
                </Button>
                <Button kind="link small" disabled={act.busy} onClick={() => assign(ids.filter((n) => n !== id))}>
                  {t("admin.remove")}
                </Button>
              </li>
            )
          );
        })}
      </ul>
      {!ids.length && <p className="muted">{t("admin.noTagsAssigned")}</p>}
      <div className="row">
        <Select
          label={t("admin.tagToAssign")}
          value={pick}
          onChange={setPick}
          options={[
            ["", t("admin.chooseATag")],
            ...d.labels.filter((l) => !ids.includes(l.id)).map((l) => [String(l.id), l.text] as [string, string]),
          ]}
        />
        <Button
          kind="btn small"
          disabled={!pick || act.busy || ids.length >= 20}
          onClick={() => {
            assign([...ids, Number(pick)]);
            setPick("");
          }}
        >
          {t("admin.assignTag")}
        </Button>
      </div>
      {act.note}
    </Section>
  );
}
