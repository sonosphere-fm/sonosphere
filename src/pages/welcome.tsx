import { useState } from "react";
import { Button } from "../kit";
import { t } from "../i18n";
import { TITLES, useAuth, useTitle } from "../lib";

type Step = "start" | "lastfm" | "new" | "connect";

export function Welcome() {
  const { me } = useAuth();
  const [step, setStep] = useState<Step>("start");
  useTitle(TITLES.welcome);

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.welcomeTitle", { name: me?.username ?? "" })}</h1>
      <div className="onboard">
        {step === "start" && (
          <>
            <h2>{t("auth.welcomeUsedLastfm")}</h2>
            <p>{t("auth.welcomeIntro")}</p>
            <div className="row">
              <Button kind="btn" onClick={() => setStep("lastfm")}>
                {t("auth.welcomeHaveAccount")}
              </Button>
              <Button kind="btn ghost" onClick={() => setStep("new")}>
                {t("auth.welcomeNew")}
              </Button>
            </div>
          </>
        )}
        {step === "lastfm" && (
          <>
            <h2>{t("auth.welcomeBringTitle")}</h2>
            <p>{t("auth.welcomeBringBody")}</p>
            <div className="row">
              <Button kind="btn" href="/import">
                {t("auth.welcomeImport")}
              </Button>
              <Button kind="btn ghost" onClick={() => setStep("connect")}>
                {t("auth.welcomeSkip")}
              </Button>
            </div>
          </>
        )}
        {step === "new" && (
          <>
            <h2>{t("auth.welcomeWhatTitle")}</h2>
            <p>{t("auth.welcomeWhatBody")}</p>
            <p>{t("auth.welcomeWhatBody2")}</p>
            <div className="row">
              <Button kind="btn" onClick={() => setStep("connect")}>
                {t("auth.welcomeNext")}
              </Button>
            </div>
          </>
        )}
        {step === "connect" && (
          <>
            <h2>{t("auth.welcomeConnectPlayer")}</h2>
            <p>{t("auth.welcomeConnectBody")}</p>
            <div className="row">
              <Button kind="btn" href="/settings/applications">
                {t("auth.welcomeConnectPlayer")}
              </Button>
              <Button kind="btn ghost" href="/">
                {t("auth.goHome")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
