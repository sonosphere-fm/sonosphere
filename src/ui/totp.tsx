import { useState, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { api, useApi, useAuth } from "../lib";
import { t } from "../i18n";
import { Async, Section, useAction } from "./base";
import type { Ok, Session } from "../../shared/auth";
import type { TotpRecovery, TotpSetup, TotpStatus } from "../../shared/totp";

function CodeField({
  code,
  onChange,
  focus = false,
}: {
  code: string;
  onChange: (code: string) => void;
  focus?: boolean;
}) {
  return (
    <label>
      {t("features.code")}
      <Input
        value={code}
        onChange={(e) => onChange(e.target.value.trim())}
        autoComplete="one-time-code"
        maxLength={16}
        required
        autoFocus={focus}
      />
    </label>
  );
}

export function TotpChallenge({ onLogin }: { onLogin: (result: Session & { next: string }) => void }) {
  const [code, setCode] = useState("");
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => onLogin(await api<Session & { next: string }>("/auth/totp", { body: { code } })));
  };
  return (
    <form className="form card" onSubmit={submit}>
      <h2>{t("features.twoFactor")}</h2>
      <CodeField code={code} onChange={setCode} focus />
      {act.note}
      <Button kind="btn" loading={act.busy}>
        {t("auth.logIn")}
      </Button>
    </form>
  );
}

export function TotpSettings() {
  const q = useApi<TotpStatus>("/me/totp");
  return (
    <Section title={t("features.twoFactor")}>
      <Async q={q}>{(status) => <TotpControls status={status} reload={q.reload} />}</Async>
    </Section>
  );
}

function TotpControls({ status, reload }: { status: TotpStatus; reload: () => void }) {
  const { me } = useAuth();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const act = useAction();
  const run = (action: "setup" | "enable" | "disable" | "recovery") =>
    act.run(async () => {
      if (action === "setup") {
        setSetup(await api<TotpSetup>("/me/totp/setup", { body: { password } }));
        setPassword("");
      } else if (action === "disable") {
        await api<Ok>("/me/totp/disable", { body: { code } });
        setCodes([]);
      } else {
        const result = await api<TotpRecovery>(`/me/totp/${action}`, {
          body: { code, ...(action === "enable" && { ticket: setup?.ticket }) },
        });
        setCodes(result.codes);
        setSetup(null);
      }
      setCode("");
      reload();
    });
  return (
    <>
      <p>{t(status.enabled ? "features.enabled" : "features.totpIntro")}</p>
      {codes.length > 0 && (
        <div className="form">
          <p>{t("features.recoveryHint")}</p>
          <pre className="overflow-x-auto select-all">{codes.join("\n")}</pre>
          <Button kind="btn ghost" onClick={() => setCodes([])}>
            {t("features.savedCodes")}
          </Button>
        </div>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run(status.enabled ? "recovery" : setup ? "enable" : "setup");
        }}
      >
        {!status.enabled && !setup && (
          <label>
            {me!.hasPassword ? t("settings.currentPassword") : t("auth.username")}
            <Input
              type={me!.hasPassword ? "password" : "text"}
              autoComplete={me!.hasPassword ? "current-password" : "username"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
        {setup && (
          <>
            <p>{t("features.setupHint")}</p>
            <label>
              {t("features.setupKey")}
              <Input readOnly value={setup.secret} />
            </label>
            <a className="link" href={setup.uri}>
              {t("features.openAuthenticator")}
            </a>
          </>
        )}
        {(status.enabled || setup) && <CodeField code={code} onChange={setCode} />}
        {act.note}
        <div className="row">
          <Button kind="btn" loading={act.busy}>
            {t(status.enabled ? "features.regenerate" : "features.enable")}
          </Button>
          {status.enabled && (
            <Button type="button" kind="btn danger" disabled={act.busy || !code} onClick={() => run("disable")}>
              {t("features.disable")}
            </Button>
          )}
          {setup && (
            <Button
              type="button"
              kind="btn ghost"
              disabled={act.busy}
              onClick={() => {
                setSetup(null);
                setCode("");
              }}
            >
              {t("common.cancel")}
            </Button>
          )}
        </div>
        {status.enabled && (
          <p className="muted small">{t("features.remaining", { count: status.recoveryRemaining })}</p>
        )}
      </form>
    </>
  );
}
