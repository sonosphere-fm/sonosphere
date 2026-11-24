import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminUsernameStatus } from "../../shared/account";
import { Button, Input } from "../kit";
import { api, dateTime, invalidateAll, useApi, useAuth } from "../lib";
import { Async, Section, useAction } from "../ui/base";
import { useConfirm } from "./common";
import { t } from "./i18n";

export function ManageUsernames({ name, onChange }: { name: string; onChange: () => void }) {
  const path = `/admin/users/${encodeURIComponent(name)}/username`;
  const q = useApi<AdminUsernameStatus>(path);
  const [username, setUsername] = useState(name);
  const action = useAction();
  const [modal, ask] = useConfirm();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const reload = async () => {
    invalidateAll();
    q.reload();
    onChange();
    await refresh();
  };
  const change = (event: FormEvent) => {
    event.preventDefault();
    ask({
      title: t("admin.changeUsername"),
      action: t("admin.changeUsername"),
      body: <p>{t("admin.renameBody", { name, username })}</p>,
      run: (note) =>
        action.run(async () => {
          const result = await api<{ username: string }>(path, { body: { username, note } });
          await reload();
          nav(`/admin/users/${encodeURIComponent(result.username)}`, { replace: true });
        }),
    });
  };
  const manage = (kind: "release" | "cooldown") =>
    ask({
      title: kind === "release" ? t("admin.releaseReservedTitle") : t("admin.removeCooldownTitle"),
      action: kind === "release" ? t("admin.releaseUsernames") : t("admin.removeCooldown"),
      danger: kind === "release",
      body: <p>{kind === "release" ? t("admin.releaseBody") : t("admin.removeCooldownBody", { name })}</p>,
      run: async (note) => {
        await api(path + "/" + kind, { body: { note } });
        await reload();
      },
    });
  return (
    <Section title={t("admin.usernames")}>
      {modal}
      {q.error && (
        <p role="alert">
          {q.error.message}{" "}
          <Button kind="link small" onClick={q.reload}>
            {t("admin.tryAgain")}
          </Button>
        </p>
      )}
      <Async q={q}>
        {(status) => (
          <>
            <form className="form" onSubmit={change}>
              <label>
                {t("admin.username")}
                <Input required maxLength={15} value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              {action.note}
              <Button kind="btn ghost small" loading={action.busy}>
                {t("admin.changeUsername")}
              </Button>
            </form>
            <p className="muted small">
              {status.changeAfter > Date.now() / 1000
                ? t("admin.cooldownEnds", { date: dateTime(status.changeAfter) })
                : t("admin.noCooldown")}
            </p>
            <Button
              type="button"
              kind="btn ghost small"
              disabled={status.changeAfter <= Date.now() / 1000}
              onClick={() => manage("cooldown")}
            >
              {t("admin.removeCooldown")}
            </Button>
            <h4 className="mt-5 mb-2">{t("admin.reservedUsernames")}</h4>
            {status.held.length ? (
              <ul className="plain">
                {status.held.map((held, index) => (
                  <li key={index}>
                    {held.username}{" "}
                    <span className="muted small">{t("admin.until", { date: dateTime(held.expiresAt) })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t("admin.noneDot")}</p>
            )}
            <Button
              type="button"
              kind="btn ghost small"
              disabled={!status.held.length}
              onClick={() => manage("release")}
            >
              {t("admin.releaseAllReserved")}
            </Button>
          </>
        )}
      </Async>
    </Section>
  );
}
