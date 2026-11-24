import { Ico } from "../../icons";
import { useState, type FormEvent } from "react";
import { t } from "../../i18n";
import { Button, SearchField } from "../../kit";
import { useNavigate, useSearchParams } from "react-router-dom";
import { qs, searchTitle, useApi, useParam, useTitle } from "../../lib";
import { Async, Empty, Section } from "../../ui/base";
import { Grid, TrackList, UserList } from "../../ui/lists";
import { TagChips } from "../../ui/tags";
import type { SearchResults } from "../../../shared/search";
import { TopTabs } from "./shared";

const types = () => [
  ["all", t("music.topResults")],
  ["artists", t("music.artists")],
  ["albums", t("music.albums")],
  ["tracks", t("music.tracks")],
  ["tags", t("music.tags")],
  ["users", t("music.listeners")],
];

export function SearchPage() {
  const [sp] = useSearchParams();
  const term = sp.get("q") || "";
  const page = Number(sp.get("page")) || 1;
  const [type, setType] = useParam("type", "all");
  const q = useApi<SearchResults>(term ? `/search${qs({ q: term, type, page })}` : null);
  useTitle(searchTitle(term));
  const nav = useNavigate();
  const [box, setBox] = useState(term);

  const go = (e: FormEvent) => {
    e.preventDefault();
    if (box.trim()) nav(`/search?q=${encodeURIComponent(box.trim())}`);
  };

  const field = (className: string) => (
    <form className={className} onSubmit={go} role="search">
      <SearchField
        clearable
        value={box}
        onChange={setBox}
        placeholder={t("music.searchPlaceholder")}
        autoFocus={!term}
      />
    </form>
  );

  if (!term) {
    return (
      <div className="wrap page">
        <h1 className="page-title center">{t("music.searchHeading")}</h1>
        <div className="max-w-[640px] mx-auto">{field("max-w-[720px] mb-6")}</div>
      </div>
    );
  }

  const results = (d: SearchResults) => {
    const allType = type === "all";
    // An empty search comes back without paging.
    const limit = d.limit ?? Infinity;
    const more = (k: string, label: string, n: number) => {
      if (!allType || n < limit) return null;
      return (
        <p className="more-link">
          <Button kind="link" onClick={() => setType(k)}>
            {label} <Ico.Chevron />
          </Button>
        </p>
      );
    };
    const inMain = allType ? [d.artists, d.albums, d.tracks] : [d.artists, d.albums, d.tracks, d.tags, d.users];
    return (
      <>
        {inMain.every((x) => !x.length) && (
          <Empty>{allType ? t("music.noMusicFound", { term }) : t("music.noResultsFound", { term })}</Empty>
        )}
        {d.artists.length > 0 && (
          <Section title={t("music.artists")}>
            <Grid flush kind="artist" items={d.artists} />
            {more("artists", t("music.moreArtists"), d.artists.length)}
          </Section>
        )}
        {d.albums.length > 0 && (
          <Section title={t("music.albums")}>
            <Grid flush kind="album" items={d.albums} />
            {more("albums", t("music.moreAlbums"), d.albums.length)}
          </Section>
        )}
        {d.tracks.length > 0 && (
          <Section title={t("music.tracks")}>
            <TrackList items={d.tracks} showDuration />
            {more("tracks", t("music.moreTracks"), d.tracks.length)}
          </Section>
        )}
        {!allType && d.tags.length > 0 && (
          <Section title={t("music.tags")}>
            <TagChips tags={d.tags} />
          </Section>
        )}
        {!allType && d.users.length > 0 && (
          <Section title={t("music.listeners")}>
            <UserList items={d.users} />
          </Section>
        )}
        {!allType && (
          <div className="pager">
            <PagerSimple page={page} more={inMain.some((x) => x.length >= limit)} />
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className="wrap">
        <h1 className="page-title mt-7 mb-2">{t("music.searchResultsFor", { term })}</h1>
      </div>
      <TopTabs>
        {types().map(([k, l]) => (
          <Button key={k} kind={k === type ? "active" : ""} onClick={() => setType(k)}>
            {l}
          </Button>
        ))}
      </TopTabs>
      <div className="wrap search-page">
        <div className="cols">
          <div className="main">
            {field("mb-7")}
            <Async q={q}>{results}</Async>
          </div>
          <aside className="side">
            {type === "all" && q.data && q.data.tags.length > 0 && (
              <Section title={t("music.tags")}>
                <TagChips tags={q.data.tags} />
              </Section>
            )}
            {type === "all" && q.data && q.data.users.length > 0 && (
              <Section title={t("music.listeners")}>
                <UserList items={q.data.users.slice(0, 5)} />
              </Section>
            )}
            <Section title={t("music.cantFindIt")}>
              <p className="muted">{t("music.catalogueGrows")}</p>
              <Button kind="btn ghost" href="/scrobble">
                {t("music.scrobbleTrack")}
              </Button>
            </Section>
          </aside>
        </div>
      </div>
    </>
  );
}

function PagerSimple({ page, more }: { page: number; more: boolean }) {
  const [, setPage] = useParam("page", "1");
  return (
    <>
      <Button disabled={page <= 1} onClick={() => setPage(String(page - 1))}>
        <Ico.Left /> {t("music.previous")}
      </Button>
      <Button disabled={!more} onClick={() => setPage(String(page + 1))}>
        {t("music.next")} <Ico.Right />
      </Button>
    </>
  );
}
