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
      <span className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
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
    const why = new Map(d.artists.map(a => [a.name, a.because]));
    return (
      <div className="gap-x-5 mb-9 max-sm:gap-x-2.5 min-[601px]:max-lg:columns-3 min-[601px]:max-lg:gap-x-4 columns-4 max-xl:columns-2 max-sm:columns-2">
        {d.albums.map(x => <RecCard key={x.id} kind="album" item={x} because={why.get(x.artist)} />)}
      </div>
    );
  }
  return (
    <div className="gap-x-5 mb-9 max-sm:gap-x-2.5 min-[601px]:max-lg:columns-3 min-[601px]:max-lg:gap-x-4 columns-4 max-xl:columns-2 max-sm:columns-2">
      {d.artists.map(x => <RecCard key={x.id} kind="artist" item={x} because={x.because} />)}
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
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 max-sm:pt-[18px] max-sm:pb-8 pt-0 pb-0 [&>.cols]:gap-0 [&>.cols]:items-stretch [&_.state+.cols]:gap-0 [&_.state+.cols]:items-stretch [&_.cols>.main]:py-7 [&_.cols>.main]:pr-8 [&_.cols>.main]:pb-12 [&_.cols>.main]:min-w-0 [&_.cols>.main]:border-t-0 [&_.cols>.main]:relative [&_.cols>.main::before]:content-[''] [&_.cols>.main::before]:absolute [&_.cols>.main::before]:top-0 [&_.cols>.main::before]:right-0 [&_.cols>.main::before]:w-screen [&_.cols>.main::before]:h-px [&_.cols>.main::before]:bg-line [&_.cols>.main::before]:pointer-events-none [&_.cols>.side]:bg-panel [&_.cols>.side]:border-l [&_.cols>.side]:border-line [&_.cols>.side]:py-7 [&_.cols>.side]:pl-6 [&_.cols>.side]:pb-12 [&_.cols>.side]:shadow-[100vw_0_0_100vw_var(--panel)] [&_.cols>.side]:[clip-path:inset(0_-100vw_0_0)] [&>.page-title]:mt-7 max-lg:[&_.cols>.main]:pr-0 max-lg:[&_.cols>.main]:pb-6 max-lg:[&_.cols>.side]:border-0 max-lg:[&_.cols>.side]:px-4 max-lg:[&_.cols>.side]:py-5 max-lg:[&_.cols>.side]:shadow-none max-lg:[&_.cols>.side]:[clip-path:none] max-lg:[&_.cols>.side]:-mx-4 max-lg:[&_.cols>.main::before]:hidden [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
        <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Recommended {at}</h1>
        <Async q={q}>{d => <RecommendedBody d={d} at={at} />}</Async>
      </div>
    </>
  );
}
