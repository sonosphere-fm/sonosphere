import { t } from "../i18n";
import { useEffect, useId, useState } from "react";
import { Button } from "../kit";

export function FeedLinks({ name, hidden, locked }: { name: string; hidden: boolean; locked: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const kinds = [
    "journal",
    ...(!hidden ? ["recent"] : []),
    ...(!locked ? ["artists", "albums", "tracks"] : []),
  ] as const;
  const labels = {
    journal: "features.journal",
    recent: "features.recent",
    artists: "features.artists",
    albums: "features.albums",
    tracks: "features.tracks",
  } as const;
  useEffect(() => {
    const links = kinds.map((kind) => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.type = "application/rss+xml";
      link.title = `${name}: ${t(labels[kind as keyof typeof labels])}`;
      link.href = `/api/feeds/${encodeURIComponent(name)}/${kind}`;
      document.head.append(link);
      return link;
    });
    return () => {
      for (const link of links) link.remove();
    };
  }, [name, hidden, locked]);
  return (
    <div>
      <Button
        type="button"
        kind="btn ghost small"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        {t("features.feeds")}
      </Button>
      <nav id={id} hidden={!expanded} aria-label={t("features.feeds")}>
        <div className="row flex-wrap small">
          {kinds.map((kind) => (
            <a key={kind} href={`/api/feeds/${encodeURIComponent(name)}/${kind}`} type="application/rss+xml">
              {t(labels[kind as keyof typeof labels])}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
