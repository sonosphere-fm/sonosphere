import { useSearchParams } from "react-router-dom";
import { t } from "../i18n";
import { TITLES, useApi, useTitle } from "../lib";
import { Async, Empty, Section } from "../ui/base";
import { EventList } from "../ui/events";
import { Dismiss, RecCard, TrackList } from "../ui/lists";
import { PlayButton, StationButton } from "../player";
import { HomeTabs, ImportPrompt, type HomeTab } from "./music/shared";
import type { Recommended as RecommendedData } from "../../shared/home";

type RecTab = Exclude<HomeTab, "home">;

const RECOMMENDED_TITLES: Record<RecTab, () => string> = {
  artists: () => t("music.recommendedArtists"),
  albums: () => t("music.recommendedAlbums"),
  tracks: () => t("music.recommendedTracks"),
  events: () => t("music.recommendedEvents"),
};

function RecommendedBody({ d, at }: { d: RecommendedData; at: HomeTab }) {
  if (at === "events") {
    return d.events.length ? <EventList items={d.events} /> : <Empty>{t("music.noUpcomingEvents")}</Empty>;
  }
  if (!d.artists.length) {
    return <ImportPrompt />;
  }
  if (at === "tracks") {
    const aside = (
      <span className="row">
        <PlayButton queue={d.tracks} label={t("music.playAll")} />
        <StationButton type="recommended" label={t("music.recommendationsRadio")} ghost />
      </span>
    );
    return (
      <Section title={t("music.tracksToTry")} aside={aside}>
        <TrackList items={d.tracks} count="listeners" actions={(r) => r.id && <Dismiss kind="track" id={r.id} />} />
      </Section>
    );
  }
  if (at === "albums") {
    const why = new Map(d.artists.map((a) => [a.name, a.because]));
    return (
      <div className="recs four">
        {d.albums.map((x) => (
          <RecCard key={x.id} kind="album" item={x} because={why.get(x.artist)} />
        ))}
      </div>
    );
  }
  return (
    <div className="recs four">
      {d.artists.map((x) => (
        <RecCard key={x.id} kind="artist" item={x} because={x.because} />
      ))}
    </div>
  );
}

export function Recommended() {
  const q = useApi<RecommendedData>("/recommended");
  const show = useSearchParams()[0].get("show");
  const at: RecTab = show === "tracks" || show === "albums" || show === "events" ? show : "artists";
  useTitle(TITLES.recommended);
  return (
    <>
      <HomeTabs at={at} />
      <div className="wrap page home-page">
        <h1 className="page-title">{RECOMMENDED_TITLES[at]()}</h1>
        <Async q={q}>{(d) => <RecommendedBody d={d} at={at} />}</Async>
      </div>
    </>
  );
}
