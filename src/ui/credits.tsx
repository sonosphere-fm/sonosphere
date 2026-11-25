import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../kit";
import { artistUrl, qs, useApi } from "../lib";
import { t } from "../i18n";
import { Async, Section } from "./base";
import type { Credits as CreditsData } from "../../shared/credits";

export function Credits({
  kind,
  artist,
  title = "",
}: {
  kind: "artist" | "album" | "track";
  artist: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Section title={t("credits.credits")}>
      <Button
        type="button"
        kind="btn ghost small"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {t("credits.show")}
      </Button>
      <div id={id} hidden={!open}>
        {open && <CreditList key={`${kind}:${artist}:${title}`} path={`/credits${qs({ kind, artist, title })}`} />}
      </div>
    </Section>
  );
}

function CreditList({ path }: { path: string }) {
  const q = useApi<CreditsData>(path);
  return (
    <>
      {q.loading && <p role="status">{t("common.loading")}</p>}
      <Async q={q}>
        {(data) => (
          <>
            {data.items.length ? (
              <ul className="feed">
                {data.items.map((credit, i) => (
                  <li key={`${credit.mbid}:${credit.role}:${i}`}>
                    <Link className="strong" to={artistUrl(credit.name)}>
                      {credit.name}
                    </Link>
                    <span className="muted">{[credit.role, ...credit.attributes].filter(Boolean).join(" · ")}</span>
                    {(credit.begin || credit.end) && (
                      <span className="muted small">{[credit.begin, credit.end].filter(Boolean).join(" / ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("credits.empty")}</p>
            )}
            {data.source && (
              <p className="small">
                <a href={data.source} target="_blank" rel="noreferrer">
                  {t("credits.source")}
                </a>
              </p>
            )}
          </>
        )}
      </Async>
    </>
  );
}
