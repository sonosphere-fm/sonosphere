import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TITLES, useTitle } from "../lib";
import { Button, SearchField } from "../kit";
import { t } from "../i18n";

export function NotFound() {
  useTitle(TITLES.notFound);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  };
  return (
    <div className="wrap page not-found">
      <p className="not-found-code font-site-display" aria-hidden="true">
        404
      </p>
      <h1 className="font-site-display">{t("common.pageNotFound")}</h1>
      <p className="text-site-muted">{t("common.notFoundBody")}</p>
      <form onSubmit={search} role="search">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder={t("common.searchMusicPlaceholder")}
          label={t("common.searchMusic")}
        />
      </form>
      <div className="not-found-links">
        <Button kind="btn" href="/">
          {t("common.navHome")}
        </Button>
        <Button kind="btn ghost" href="/charts">
          {t("common.navCharts")}
        </Button>
      </div>
    </div>
  );
}
