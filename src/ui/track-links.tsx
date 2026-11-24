import { useEffect, useState } from "react";
import type { TrackLinks as Links } from "../../shared/catalog";
import { t } from "../i18n";
import { Button, Modal } from "../kit";
import { api, qs } from "../lib";

const services = [
  ["spotify", "Spotify"],
  ["appleMusic", "Apple Music"],
  ["tidal", "TIDAL"],
  ["youtube", "YouTube"],
] as const;

export function TrackLinks({ artist, title, onClose }: { artist: string; title: string; onClose: () => void }) {
  const [result, setResult] = useState<Links | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setResult(null);
    api<Links>(`/track/links${qs({ artist, track: title })}`).then(
      (links) => {
        if (active) setResult(links);
      },
      (error: Error) => {
        if (active) setError(error.message);
      }
    );
    return () => {
      active = false;
    };
  }, [artist, title, attempt]);

  const term = `${artist} ${title}`;
  return (
    <Modal title={t("music.openInService")} onClose={onClose}>
      {error ? (
        <div role="alert" className="mb-3">
          <p>{error}</p>
          <Button kind="btn ghost small" type="button" onClick={() => setAttempt((n) => n + 1)}>
            {t("music.tryAgain")}
          </Button>
        </div>
      ) : !result ? (
        <p role="status">{t("music.findingLinks")}</p>
      ) : (
        <>
          {services.some(([key]) => result[key]) ? (
            <ul className="plain mb-3">
              {services.map(([key, name]) => {
                const url = result[key];
                return url ? (
                  <li key={key}>
                    <a className="text-site-link hover:underline" href={url} target="_blank" rel="noopener noreferrer">
                      {name}
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p>{t("music.noLinks")}</p>
          )}
        </>
      )}
      <div className="row">
        <a
          className="text-site-link hover:underline"
          href={`https://link.binimum.org/${qs({ q: term })}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("music.searchBiniLink")}
        </a>
        {!result?.youtube && (
          <a
            className="text-site-link hover:underline"
            href={`https://www.youtube.com/results${qs({ search_query: term })}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("music.searchYouTube")}
          </a>
        )}
      </div>
    </Modal>
  );
}
