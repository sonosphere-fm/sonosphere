import { useParams } from "react-router-dom";
import { t } from "../../i18n";
import { dec, num, qs, tagTitle, tagUrl, useApi, useTitle } from "../../lib";
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
  useTitle(tagTitle(name, tab === "wiki"));
  return (
    <Async q={q}>
      {(tag) => (
        <>
          <Hero
            tabs={
              <Tabs
                items={[
                  [base, t("music.overview"), true],
                  [`${base}/+wiki`, t("music.wiki")],
                ]}
              />
            }
            kicker={t("music.tag")}
            title={tag.name}
            stats={
              <>
                <Stat label={t("music.timesUsed")} value={num(tag.taggings)} />
                <Stat label={t("music.taggers")} value={num(tag.taggers)} />
                <Stat label={t("music.artists")} value={num(tag.artists.length)} />
              </>
            }
            actions={
              <>
                <PlayButton queue={tag.tracks} label={t("music.playName", { name: tag.name })} />
                <StationButton type="tag" name={tag.name} label={t("music.tagRadio")} ghost />
              </>
            }
          />
          <div className="wrap page">
            <Pane>
              {tab === "wiki" ? (
                <WikiPage type="tag" id={tag.id} title={tag.name} />
              ) : (
                <div className="cols">
                  <div className="main">
                    <WikiSummary wiki={tag.wiki} to={`${base}/+wiki`} />
                    <Section title={t("music.topArtists")}>
                      <Grid
                        kind="artist"
                        items={tag.artists.slice(0, 12)}
                        sub={(a) => t("music.listenerCount", { count: a.listeners })}
                      />
                    </Section>
                    <Section title={t("music.topTracks")}>
                      <TrackList items={tag.tracks.slice(0, 15)} rank={1} count="listeners" />
                    </Section>
                    <Section title={t("music.topAlbums")}>
                      <Grid kind="album" items={tag.albums.slice(0, 12)} />
                    </Section>
                    <Section title={t("music.wall")}>
                      <Shoutbox type="tag" id={tag.id} limit={10} />
                    </Section>
                  </div>
                  <aside className="side">
                    <Section title={t("music.relatedTags")}>
                      {tag.related.length ? (
                        <TagChips tags={tag.related} />
                      ) : (
                        <p className="muted">{t("music.noneYet")}</p>
                      )}
                    </Section>
                  </aside>
                </div>
              )}
            </Pane>
          </div>
        </>
      )}
    </Async>
  );
}
