import { Ico } from "../../icons";
import { useState, type FormEvent } from "react";
import { Button, SearchField } from "../../kit";
import { useNavigate, useSearchParams } from "react-router-dom";
import { qs, useApi, useParam, useTitle } from "../../lib";
import { Async, Empty, Section } from "../../ui/base";
import { Grid, TrackList, UserList } from "../../ui/lists";
import { TagChips } from "../../ui/tags";
import type { SearchResults } from "../../../shared/search";
import { TopTabs } from "./shared";

const TYPES = [
  ["all", "Top results"],
  ["artists", "Artists"],
  ["albums", "Albums"],
  ["tracks", "Tracks"],
  ["tags", "Tags"],
  ["users", "Listeners"],
];

export function SearchPage() {
  const [sp] = useSearchParams();
  const term = sp.get("q") || "";
  const page = Number(sp.get("page")) || 1;
  const [type, setType] = useParam("type", "all");
  const q = useApi<SearchResults>(term ? `/search${qs({ q: term, type, page })}` : null);
  useTitle(term ? `Search: ${term}` : "Search");
  const nav = useNavigate();
  const [box, setBox] = useState(term);

  const go = (e: FormEvent) => {
    e.preventDefault();
    if (box.trim()) nav(`/search?q=${encodeURIComponent(box.trim())}`);
  };

  const field = (className: string) => (
    <form className={className} onSubmit={go} role="search">
      <SearchField clearable value={box} onChange={setBox} placeholder="Search for an artist, album, track, tag or listener…" autoFocus={!term} />
    </form>
  );

  if (!term) {
    return (
      <div className="wrap page">
        <h1 className="page-title center">Search for music, tags and listeners</h1>
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
      return <p className="more-link"><Button kind="link" onClick={() => setType(k)}>More {label} <Ico.Chevron /></Button></p>;
    };
    const inMain = allType ? [d.artists, d.albums, d.tracks] : [d.artists, d.albums, d.tracks, d.tags, d.users];
    return (
      <>
        {inMain.every(x => !x.length) && (
          <Empty>No {allType ? "music" : "results"} found for “{term}”. Anything you scrobble gets added to the catalogue automatically.</Empty>
        )}
        {d.artists.length > 0 && (
          <Section title="Artists"><Grid flush kind="artist" items={d.artists} />{more("artists", "artists", d.artists.length)}</Section>
        )}
        {d.albums.length > 0 && (
          <Section title="Albums"><Grid flush kind="album" items={d.albums} />{more("albums", "albums", d.albums.length)}</Section>
        )}
        {d.tracks.length > 0 && (
          <Section title="Tracks"><TrackList items={d.tracks} showDuration />{more("tracks", "tracks", d.tracks.length)}</Section>
        )}
        {!allType && d.tags.length > 0 && <Section title="Tags"><TagChips tags={d.tags} /></Section>}
        {!allType && d.users.length > 0 && <Section title="Listeners"><UserList items={d.users} /></Section>}
        {!allType && <div className="pager"><PagerSimple page={page} more={inMain.some(x => x.length >= limit)} /></div>}
      </>
    );
  };

  return (
    <>
      <div className="wrap"><h1 className="page-title mt-7 mb-2">Search results for “{term}”</h1></div>
      <TopTabs>
        {TYPES.map(([k, l]) => <Button key={k} kind={k === type ? "active" : ""} onClick={() => setType(k)}>{l}</Button>)}
      </TopTabs>
      <div className="wrap search-page">
        <div className="cols">
          <div className="main">
            {field("mb-7")}
            <Async q={q}>{results}</Async>
          </div>
          <aside className="side">
            {type === "all" && q.data && q.data.tags.length > 0 && <Section title="Tags"><TagChips tags={q.data.tags} /></Section>}
            {type === "all" && q.data && q.data.users.length > 0 && (
              <Section title="Listeners"><UserList items={q.data.users.slice(0, 5)} /></Section>
            )}
            <Section title="Can't find it?">
              <p className="muted">
                Sonosphere's catalogue grows as people listen. Scrobble a track and its artist and album pages appear straight away.
              </p>
              <Button kind="btn ghost" href="/scrobble">Scrobble a track</Button>
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
      <Button disabled={page <= 1} onClick={() => setPage(String(page - 1))}><Ico.Left /> Previous</Button>
      <Button disabled={!more} onClick={() => setPage(String(page + 1))}>Next <Ico.Right /></Button>
    </>
  );
}
