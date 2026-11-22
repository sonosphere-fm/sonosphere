import { useEffect, useState } from "react";
import type { TrackLinks as Links } from "../../shared/catalog";
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
    <Modal title="Open in a music service" onClose={onClose}>
      {error ? (
        <div role="alert" className="mb-3">
          <p>{error}</p>
          <Button kind="btn ghost small" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !result ? (
        <p role="status">Finding song links…</p>
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
            <p>No matching song links found.</p>
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
          Search BiniLink
        </a>
        {!result?.youtube && (
          <a
            className="text-site-link hover:underline"
            href={`https://www.youtube.com/results${qs({ search_query: term })}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Search YouTube
          </a>
        )}
      </div>
    </Modal>
  );
}
