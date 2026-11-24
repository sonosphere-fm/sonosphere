import { useEffect, useState, type FormEvent } from "react";
import type { UsernameStatus } from "../../shared/account";
import type { MeResponse } from "../../shared/auth";
import { Button, Input } from "../kit";
import { t, tx } from "../i18n";
import { api, dateTime, invalidateAll, useApi, useAuth } from "../lib";
import { Async, Section, useAction } from "./base";

export function UsernameSettings() {
  const { me, setMe } = useAuth();
  const [username, setUsername] = useState(me!.username);
  const q = useApi<UsernameStatus>("/me/username");
  const action = useAction();
  const [at, setAt] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = setInterval(() => setAt(Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  }, []);
  const change = (undo = false) =>
    action.run(async () => {
      const result = await api<MeResponse>(undo ? "/me/username/undo" : "/me/username", {
        body: undo ? {} : { username },
      });
      invalidateAll();
      setMe(result.user);
      setUsername(result.user!.username);
      return undo ? t("settings.usernameRestored") : t("settings.usernameChanged");
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    change();
  };
  return (
    <Section title={t("settings.username")}>
      <p className="muted small">{t("settings.usernameIntro")}</p>
      {q.error && (
        <div role="alert">
          <p>{q.error.message}</p>
          <Button type="button" kind="btn ghost small" onClick={q.reload}>
            {t("settings.tryAgain")}
          </Button>
        </div>
      )}
      <Async q={q}>
        {(status) => (
          <form className="form" onSubmit={submit}>
            <label>
              {t("settings.username")}
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={2}
                maxLength={15}
                pattern="[a-zA-Z][a-zA-Z0-9_\-]{1,14}"
                autoComplete="username"
                disabled={action.busy}
              />
            </label>
            <p className="muted small">{t("settings.usernameRules")}</p>
            {status.changeAfter > at && (
              <p className="muted small">{t("settings.usernameChangeAfter", { date: dateTime(status.changeAfter) })}</p>
            )}
            {action.note}
            <Button type="submit" kind="btn" loading={action.busy} disabled={status.changeAfter > at}>
              {t("settings.changeUsername")}
            </Button>
            {status.undo && status.undo.expiresAt > at && (
              <div className="border-t border-site-line pt-4 mt-2">
                <p className="muted small">
                  {tx("settings.usernameRestoreUntil", {
                    name: <Username name={status.undo.username} font={me?.usernameFont} />,
                    date: dateTime(status.undo.expiresAt),
                  })}
                </p>
                <Button type="button" kind="btn ghost" loading={action.busy} onClick={() => change(true)}>
                  {t("settings.undoUsernameChange")}
                </Button>
              </div>
            )}
          </form>
        )}
      </Async>
    </Section>
  );
}
import { Username } from "./username";
