import { Ico } from "../../icons";
import { useState, type FormEvent } from "react";
import { Button, SearchField } from "../../kit";
import { useNavigate, useSearchParams } from "react-router-dom";
import { qs, useApi, useParam, useTitle } from "../../lib";
import { Async, Empty, Section } from "../../ui/base";
import { Grid, TrackList, UserList } from "../../ui/lists";
import { TagChips } from "../../ui/tags";
import type { SearchResults } from "../../../shared/search";

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

  const field = (
    <form className="search-big max-w-[720px] mb-6 [&.center]:mx-auto [&.center]:mb-10" onSubmit={go} role="search">
      <SearchField clearable value={box} onChange={setBox} placeholder="Search for an artist, album, track, tag or listener…" autoFocus={!term} />
    </form>
  );

  if (!term) {
    return (
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
        <h1 className="page-title mt-7 mb-[22px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px] text-center">Search for music, tags and listeners</h1>
        <div className="max-w-[640px] mx-auto">{field}</div>
      </div>
    );
  }

  const results = (d: SearchResults) => {
    const allType = type === "all";
    // An empty search comes back without paging.
    const limit = d.limit ?? Infinity;
    const more = (k: string, label: string, n: number) => {
      if (!allType || n < limit) return null;
      return <p className="text-right mt-3 [&_.astryx-button]:font-medium [&_.astryx-button]:normal-case [&_.astryx-button]:tracking-normal [&_.astryx-button]:text-link [&_svg]:size-3.5"><Button className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" onClick={() => setType(k)}>More {label} <Ico.Chevron /></Button></p>;
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
        {!allType && <div className="flex justify-center items-center gap-1 mt-[22px] flex-wrap"><PagerSimple page={page} more={inMain.some(x => x.length >= limit)} /></div>}
      </>
    );
  };

  return (
    <>
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 [&_.page-title]:mt-7 [&_.page-title]:mb-2"><h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Search results for “{term}”</h1></div>
      <div className="py-3 bg-panel [&_.tabs]:flex-nowrap [&_.tabs]:overflow-x-auto [&_.tabs]:[scrollbar-width:none] [&_.tabs]:mb-0 [&_.tabs]:gap-0.5 [&_.tabs]:pb-0 [&_.tabs_a]:whitespace-nowrap [&_.tabs_a]:flex-none [&_.tabs_a]:current:bg-sun [&_.tabs_a]:current:text-on-sun [&_.tabs_a]:current:font-bold">
        <nav className="tabs w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 flex flex-wrap gap-0.5 mb-6 *:h-auto *:rounded-none *:m-0 *:border-0 *:bg-transparent *:px-2.5 *:py-1.5 *:text-base *:font-medium *:text-ink-2 *:hover:bg-tint *:hover:text-ink *:hover:no-underline *:current:bg-sun *:current:text-on-sun *:current:font-bold max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:gap-x-[22px] max-md:gap-y-0 max-md:[&::-webkit-scrollbar]:hidden max-md:*:flex-none max-md:*:whitespace-nowrap">
          {TYPES.map(([k, l]) => <Button key={k} kind={k === type ? "active" : ""} onClick={() => setType(k)}>{l}</Button>)}
        </nav>
      </div>
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-0 pb-0 [&>.cols]:gap-0 [&>.cols]:items-stretch [&_.cols>.main]:py-7 [&_.cols>.main]:pr-8 [&_.cols>.main]:pb-12 [&_.cols>.main]:min-w-0 [&_.cols>.main]:border-t-0 [&_.cols>.main]:relative [&_.cols>.main::before]:content-[''] [&_.cols>.main::before]:absolute [&_.cols>.main::before]:top-0 [&_.cols>.main::before]:right-0 [&_.cols>.main::before]:w-screen [&_.cols>.main::before]:h-px [&_.cols>.main::before]:bg-line [&_.cols>.main::before]:pointer-events-none [&_.cols>.side]:bg-panel [&_.cols>.side]:border-l [&_.cols>.side]:border-line [&_.cols>.side]:py-7 [&_.cols>.side]:pl-6 [&_.cols>.side]:pb-12 [&_.cols>.side]:shadow-[100vw_0_0_100vw_var(--panel)] [&_.cols>.side]:[clip-path:inset(0_-100vw_0_0)] [&_.search-big]:mb-7 [&_.search-big]:max-w-none max-lg:[&_.cols>.main]:pr-0 max-lg:[&_.cols>.main]:pb-6 max-lg:[&_.cols>.side]:border-0 max-lg:[&_.cols>.side]:px-4 max-lg:[&_.cols>.side]:py-5 max-lg:[&_.cols>.side]:shadow-none max-lg:[&_.cols>.side]:[clip-path:none] max-lg:[&_.cols>.side]:-mx-4 max-lg:[&_.cols>.main::before]:hidden">
        <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2">
          <div className="main min-w-0">
            {field}
            <Async q={q}>{results}</Async>
          </div>
          <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
            {type === "all" && q.data && q.data.tags.length > 0 && <Section title="Tags"><TagChips tags={q.data.tags} /></Section>}
            {type === "all" && q.data && q.data.users.length > 0 && (
              <Section title="Listeners"><UserList items={q.data.users.slice(0, 5)} /></Section>
            )}
            <Section title="Can't find it?">
              <p className="text-muted">
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
