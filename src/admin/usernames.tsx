import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminUsernameStatus } from "../../shared/account";
import { Button, Input } from "../kit";
import { api, dateTime, invalidateAll, useApi, useAuth } from "../lib";
import { Async, Section, useAction } from "../ui/base";
import { useConfirm } from "./common";

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
      title: "Change username",
      action: "Change username",
      body: (
        <p>
          Rename {name} to {username}. This bypasses the current cooldown and starts a new 7-day cooldown. The previous
          name is reserved for 14 days.
        </p>
      ),
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
      title: kind === "release" ? "Release reserved usernames" : "Remove username cooldown",
      action: kind === "release" ? "Release usernames" : "Remove cooldown",
      danger: kind === "release",
      body: (
        <p>
          {kind === "release"
            ? "All reserved previous usernames will become available immediately. Their redirects and Undo will stop; history stays stored."
            : `${name} will be able to change their username immediately.`}
        </p>
      ),
      run: async (note) => {
        await api(path + "/" + kind, { body: { note } });
        await reload();
      },
    });
  return (
    <Section title="Usernames">
      {modal}
      {q.error && (
        <p role="alert">
          {q.error.message}{" "}
          <Button kind="link small" onClick={q.reload}>
            Try again
          </Button>
        </p>
      )}
      <Async q={q}>
        {(status) => (
          <>
            <form className="form" onSubmit={change}>
              <label>
                Username
                <Input required maxLength={15} value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              {action.note}
              <Button kind="btn ghost small" loading={action.busy}>
                Change username
              </Button>
            </form>
            <p className="muted small">
              {status.changeAfter > Date.now() / 1000
                ? `Cooldown ends ${dateTime(status.changeAfter)}.`
                : "No active username cooldown."}
            </p>
            <Button
              type="button"
              kind="btn ghost small"
              disabled={status.changeAfter <= Date.now() / 1000}
              onClick={() => manage("cooldown")}
            >
              Remove cooldown
            </Button>
            <h4 className="mt-5 mb-2">Reserved previous usernames</h4>
            {status.held.length ? (
              <ul className="plain">
                {status.held.map((held, index) => (
                  <li key={index}>
                    {held.username} <span className="muted small">until {dateTime(held.expiresAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">None.</p>
            )}
            <Button
              type="button"
              kind="btn ghost small"
              disabled={!status.held.length}
              onClick={() => manage("release")}
            >
              Release all reserved usernames
            </Button>
          </>
        )}
      </Async>
    </Section>
  );
}
