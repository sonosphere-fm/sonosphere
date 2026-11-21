import { useSearchParams } from "react-router-dom";
import { useApi, useTitle } from "../lib";
import { Async, Empty, Section } from "../ui/base";
import { EventList } from "../ui/events";
import { RecCard, TrackList } from "../ui/lists";
import { PlayButton, StationButton } from "../player";
import { HomeTabs, type HomeTab } from "./music/shared";
import type { Recommended as RecommendedData } from "../../shared/home";

// ---------- recommendations ----------
export function Recommended() {
  const q = useApi<RecommendedData>("/recommended");
  const show = useSearchParams()[0].get("show"), at: HomeTab = show === "tracks" || show === "albums" || show === "events" ? show : "artists";
  useTitle("Recommended");
  return (
    <>
      <HomeTabs at={at} />
      <div className="wrap page home-page">
        <h1 className="page-title">Recommended {at}</h1>
        <Async q={q}>{d => {
          const why = new Map(d.artists.map(a => [a.name, a.because]));
          if (at === "events") return d.events.length ? <EventList items={d.events} /> : <Empty>No upcoming events right now.</Empty>;
          if (!d.artists.length) return <Empty>You need to scrobble a few more tracks before we can recommend you anything.</Empty>;
          if (at === "tracks") return <Section title="Tracks to try" aside={<span className="row"><PlayButton queue={d.tracks} label="Play all" /><StationButton type="recommended" label="Recommendations radio" ghost /></span>}><TrackList items={d.tracks} count="listeners" /></Section>;
          return <div className="recs four">{at === "albums"
            ? d.albums.map(x => <RecCard key={x.id} kind="album" item={x} because={why.get(x.artist)} />)
            : d.artists.map(x => <RecCard key={x.id} kind="artist" item={x} because={x.because} />)}</div>;
        }}</Async>
      </div>
    </>
  );
}
