import { useParams } from "react-router-dom";
import { dec, num, qs, tagUrl, useApi, useTitle } from "../../lib";
import { Async, Section, Stat, Tabs, Pane } from "../../ui/base";
import { Grid, TrackList } from "../../ui/lists";
import { Shoutbox } from "../../ui/shoutbox";
import { TagChips } from "../../ui/tags";
import { WikiPage, WikiSummary } from "../../ui/wiki";
import { PlayButton, StationButton } from "../../player";
import { Hero } from "./shared";
import type { TagPage as TagData } from "../../../shared/tags";

export function TagPage({ tab }: { tab: "overview" | "wiki" }) {
  const name = dec(useParams().tag);
  const base = tagUrl(name);
  const q = useApi<TagData>(`/tag${qs({ name })}`);
  useTitle(`${name} music`);
  return (
    <Async q={q}>{t => (
      <>
        <Hero
          tabs={<Tabs items={[[base, "Overview", true], [`${base}/+wiki`, "Wiki"]]} />}
          kicker="Tag"
          title={t.name}
          stats={
            <>
              <Stat label="Times used" value={num(t.taggings)} />
              <Stat label="Taggers" value={num(t.taggers)} />
              <Stat label="Artists" value={num(t.artists.length)} />
            </>
          }
          actions={
            <>
              <PlayButton queue={t.tracks} label={`Play ${t.name}`} />
              <StationButton type="tag" name={t.name} label="Tag radio" ghost />
            </>
          }
        />
        <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
          <Pane>
            {tab === "wiki" ? <WikiPage type="tag" id={t.id} title={t.name} /> : (
              <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
                <div className="main min-w-0">
                  <WikiSummary wiki={t.wiki} to={`${base}/+wiki`} />
                  <Section title="Top artists">
                    <Grid kind="artist" items={t.artists.slice(0, 12)} sub={a => `${num(a.listeners)} listeners`} />
                  </Section>
                  <Section title="Top tracks"><TrackList items={t.tracks.slice(0, 15)} rank={1} count="listeners" /></Section>
                  <Section title="Top albums"><Grid kind="album" items={t.albums.slice(0, 12)} /></Section>
                  <Section title="Wall"><Shoutbox type="tag" id={t.id} limit={10} /></Section>
                </div>
                <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
                  <Section title="Related tags">
                    {t.related.length ? <TagChips tags={t.related} /> : <p className="text-muted">None yet.</p>}
                  </Section>
                </aside>
              </div>
            )}
          </Pane>
        </div>
      </>
    )}</Async>
  );
}
