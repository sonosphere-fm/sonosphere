import { Button } from "../kit";
import { api, dateTime, useApi } from "../lib";
import { t } from "../i18n";
import { Async, Section, useAction } from "./base";
import type { ActiveSessions } from "../../shared/sessions";
import type { Ok } from "../../shared/auth";

function device(agent: string): string {
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "";
  const os = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad/.test(agent)
      ? "iOS"
      : /Windows/.test(agent)
        ? "Windows"
        : /Macintosh/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ") || t("sessions.unknownDevice");
}

export function SessionSettings() {
  const q = useApi<ActiveSessions>("/me/sessions");
  const act = useAction();
  const revoke = (body: { id: string } | { others: true }) =>
    act.run(async () => {
      await api<Ok>("/me/sessions/revoke", { body });
      q.reload();
    });
  return (
    <Section title={t("sessions.sessions")}>
      <Async q={q}>
        {({ items }) => (
          <>
            <ul className="feed">
              {items.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3">
                  <div className="grow min-w-0">
                    <strong>{device(s.userAgent)}</strong>
                    {s.current && <span> · {t("sessions.thisDevice")}</span>}
                    <p className="muted small">
                      {s.ip}
                      {s.ip && " · "}
                      {t("sessions.lastActive", { date: dateTime(s.lastSeenAt) })}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      type="button"
                      kind="btn ghost small"
                      disabled={act.busy}
                      onClick={() => revoke({ id: s.id })}
                    >
                      {t("sessions.signOut")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {items.some((s) => !s.current) && (
              <Button type="button" kind="btn ghost" loading={act.busy} onClick={() => revoke({ others: true })}>
                {t("sessions.signOutOthers")}
              </Button>
            )}
          </>
        )}
      </Async>
      {act.note}
    </Section>
  );
}
