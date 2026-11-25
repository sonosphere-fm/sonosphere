import { t } from "../i18n";
import { useEffect } from "react";

export function FeedLinks({ name, hidden, locked }: { name: string; hidden: boolean; locked: boolean }) {
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
    <nav className="row flex-wrap small" aria-label={t("features.feeds")}>
      <strong>{t("features.feeds")}</strong>
      {kinds.map((kind) => (
        <a key={kind} href={`/api/feeds/${encodeURIComponent(name)}/${kind}`} type="application/rss+xml">
          {t(labels[kind as keyof typeof labels])}
        </a>
      ))}
    </nav>
  );
}
