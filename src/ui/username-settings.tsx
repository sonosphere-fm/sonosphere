import { useEffect, useState, type FormEvent } from "react";
import type { UsernameStatus } from "../../shared/account";
import type { MeResponse } from "../../shared/auth";
import { Button, Input } from "../kit";
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
      return undo ? "Username restored. You can change it again in 7 days." : "Username changed.";
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    change();
  };
  return (
    <Section title="Username">
      <p className="muted small">
        You can change your username once every 7 days. Your previous name redirects to your profile for 14 days, then
        becomes available to others.
      </p>
      {q.error && (
        <div role="alert">
          <p>{q.error.message}</p>
          <Button type="button" kind="btn ghost small" onClick={q.reload}>
            Try again
          </Button>
        </div>
      )}
      <Async q={q}>
        {(status) => (
          <form className="form" onSubmit={submit}>
            <label>
              Username
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
            <p className="muted small">2–15 characters: letters, numbers, - and _, starting with a letter.</p>
            {status.changeAfter > at && (
              <p className="muted small">You can change your username again on {dateTime(status.changeAfter)}.</p>
            )}
            {action.note}
            <Button type="submit" kind="btn" loading={action.busy} disabled={status.changeAfter > at}>
              Change username
            </Button>
            {status.undo && status.undo.expiresAt > at && (
              <div className="border-t border-site-line pt-4 mt-2">
                <p className="muted small">
                  Restore <Username name={status.undo.username} font={me?.usernameFont} /> until{" "}
                  {dateTime(status.undo.expiresAt)}. Undo starts a new 7-day cooldown.
                </p>
                <Button type="button" kind="btn ghost" loading={action.busy} onClick={() => change(true)}>
                  Undo username change
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
