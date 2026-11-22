import { useSearchParams } from "react-router-dom";
import { useApi, useTitle } from "../lib";
import { Async, Empty, Section } from "../ui/base";
import { EventList } from "../ui/events";
import { RecCard, TrackList } from "../ui/lists";
import { PlayButton, StationButton } from "../player";
import { HomeTabs, type HomeTab } from "./music/shared";
import type { Recommended as RecommendedData } from "../../shared/home";

function RecommendedBody({ d, at }: { d: RecommendedData; at: HomeTab }) {
  if (at === "events") {
    return d.events.length ? <EventList items={d.events} /> : <Empty>No upcoming events right now.</Empty>;
  }
  if (!d.artists.length) {
    return <Empty>You need to scrobble a few more tracks before we can recommend you anything.</Empty>;
  }
  if (at === "tracks") {
    const aside = (
      <span className="row">
        <PlayButton queue={d.tracks} label="Play all" />
        <StationButton type="recommended" label="Recommendations radio" ghost />
      </span>
    );
    return (
      <Section title="Tracks to try" aside={aside}>
        <TrackList items={d.tracks} count="listeners" />
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
  const at: HomeTab = show === "tracks" || show === "albums" || show === "events" ? show : "artists";
  useTitle("Recommended");
  return (
    <>
      <HomeTabs at={at} />
      <div className="wrap page home-page">
        <h1 className="page-title">Recommended {at}</h1>
        <Async q={q}>{(d) => <RecommendedBody d={d} at={at} />}</Async>
      </div>
    </>
  );
}
