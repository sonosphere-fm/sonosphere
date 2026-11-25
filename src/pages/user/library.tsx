import { Username } from "../../ui/username";
import { useEffect, useRef, useState } from "react";
import { Button, Input } from "../../kit";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api, artistUrl, date, invalidateAll, enc, num, qs, useApi, userUrl } from "../../lib";
import { t, tx } from "../../i18n";
import { Art, Async, DateRange, Empty, Pager, Section, Stat, useAction, useRange } from "../../ui/base";
import { BarChart, weekTrend } from "../../ui/charts";
import { Grid, RankList, TrackList, type TrackRow } from "../../ui/lists";
import { ScrobbleMenu } from "../../ui/scrobble-menu";
import type { RecentTrack, ScrobblesDeleted, TopAlbum, TopArtist, TopTrack } from "../../../shared/listening";
import type { UserArtistLibrary, UserRecent, UserTop } from "../../../shared/users";

// One cached path serves either /user/recent or /user/top (by `kind`), so rows are told apart by shape.
type LibraryRow = RecentTrack | TopArtist | TopAlbum | TopTrack;
const isRecent = (i: LibraryRow): i is RecentTrack => "playedAt" in i;
const isArtist = (i: LibraryRow): i is TopArtist => !("title" in i);
const isAlbum = (i: LibraryRow): i is TopAlbum => "title" in i && !("duration" in i);
const isTopTrack = (i: LibraryRow): i is TopTrack => "duration" in i && "listeners" in i;

/** Ids from anchor to target inclusive, in display order; empty when either end is off the page. */
export function rangeIds(ids: number[], anchor: number | null, target: number): number[] {
  const a = anchor === null ? -1 : ids.indexOf(anchor);
  const b = ids.indexOf(target);
  if (a < 0 || b < 0) return [];
  return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
}

const libraryTabs = () => [
  ["", t("user.statScrobbles")],
  ["/artists", t("user.statArtists")],
  ["/albums", t("user.statAlbums")],
  ["/tracks", t("user.statTracks")],
];

function kindCount(kind: string, count: number) {
  if (kind === "artists") return t("user.artistCount", { count });
  if (kind === "albums") return t("user.albumCount", { count });
  return t("user.trackCount", { count });
}

function summary(d: UserRecent | UserTop, kind: string) {
  if ("hidden" in d) return "";
  if (kind === "scrobbles") return t("user.scrobbleCount", { count: d.total });
  const total = kindCount(kind, d.total);
  if (!("counts" in d && d.counts)) return total;
  return `${total} · ${t("user.scrobbleCount", { count: d.counts.playcount })}`;
}

export function Library({ name, mine }: { name: string; mine: boolean }) {
  const kind = useParams().kind || "scrobbles";
  const selectedScrobble = useLocation().state?.selectedScrobble;
  const base = `${userUrl(name)}/library`;
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const params = { name, page, limit: 50, ...useRange() };
  const q = useApi<UserRecent | UserTop>(
    kind === "scrobbles" ? `/user/recent${qs(params)}` : `/user/top${qs({ ...params, kind })}`
  );
  // Scrobbles picked for bulk delete; null when not in select mode.
  const [picked, setPicked] = useState<Set<number> | null>(null);
  // Origin of the next shift-range: the last row clicked, plain or shift.
  const anchor = useRef<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const bulk = useAction();

  const stopPicking = () => {
    anchor.current = null;
    setPicked(null);
    setConfirm(false);
  };

  useEffect(() => {
    stopPicking();
    if (
      mine &&
      kind === "scrobbles" &&
      page === 1 &&
      typeof selectedScrobble === "number" &&
      Number.isSafeInteger(selectedScrobble) &&
      selectedScrobble > 0
    ) {
      setPicked(new Set([selectedScrobble]));
      anchor.current = selectedScrobble;
      // The seed rides in the history entry, so a refresh would reopen select mode. Consume it once;
      // keep the router's key/idx and leave its in-memory location alone so this visit keeps the seed.
      window.history.replaceState({ ...window.history.state, usr: null }, "");
    }
  }, [name, mine, kind, page, selectedScrobble]);

  const pick = (id: number, on: boolean) => {
    anchor.current = id;
    setConfirm(false);
    setPicked((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  // Shift-click gives every row between the anchor and this one the state this click produces,
  // so shift-unchecking deselects a range too. The anchor then moves to this row, so the next
  // shift-click ranges from here (select Xtal…Karma Police, then shift-uncheck back to Hyperballad).
  const pickRange = (id: number, on: boolean) => {
    const ids = rangeIds(
      (q.data?.items.filter(isRecent) ?? []).map((r) => r.id),
      anchor.current,
      id
    );
    if (!ids.length) return pick(id, on);
    anchor.current = id;
    setConfirm(false);
    setPicked((prev) => {
      const n = new Set(prev);
      for (const x of ids) {
        if (on) n.add(x);
        else n.delete(x);
      }
      return n;
    });
  };

  const removePicked = () =>
    bulk.run(async () => {
      await api<ScrobblesDeleted>("/scrobbles/delete", { body: { ids: [...picked!] } });
      stopPicking();
      invalidateAll();
    });

  const search = sp.toString() ? `?${new URLSearchParams([...sp].filter(([k]) => k !== "page"))}` : "";
  const rank = (page - 1) * 50 + 1;

  const bulkBar = (d: UserRecent | UserTop) => {
    if (!picked) {
      return (
        <Button kind="btn ghost small" type="button" onClick={() => setPicked(new Set())}>
          {t("user.selectScrobbles")}
        </Button>
      );
    }
    const all = picked.size === d.items.length;
    const toggleAll = () => {
      anchor.current = null;
      setConfirm(false);
      setPicked(new Set(all ? [] : d.items.map((r: LibraryRow) => r.id)));
    };
    return (
      <>
        <b>{t("user.selectedCount", { count: picked.size })}</b>
        <Button kind="link small" type="button" onClick={toggleAll}>
          {all ? t("user.selectNone") : t("user.selectAllOnPage")}
        </Button>
        {confirm ? (
          <Button kind="btn danger small" type="button" loading={bulk.busy} onClick={removePicked}>
            {t("user.confirmDeleteScrobbles", { count: picked.size })}
          </Button>
        ) : (
          <Button kind="btn ghost small" type="button" disabled={!picked.size} onClick={() => setConfirm(true)}>
            {t("user.deleteSelected")}
          </Button>
        )}
        <Button kind="link small" type="button" onClick={stopPicking}>
          {t("user.cancel")}
        </Button>
        {bulk.note}
      </>
    );
  };

  const rowActions = (r: TrackRow<RecentTrack>) => {
    if (r._np || !picked) return null;
    return (
      <Input
        type="checkbox"
        aria-label={t("user.selectTrack", { title: r.title })}
        checked={picked.has(r.id)}
        onChange={(e) => {
          // React derives a checkbox's change from the click, so the native event carries shiftKey.
          const shift = e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey;
          if (shift) pickRange(r.id, e.target.checked);
          else pick(r.id, e.target.checked);
        }}
      />
    );
  };

  const list = (d: UserRecent | UserTop) => {
    if ("hidden" in d) return <Empty>{tx("user.historyPrivate", { name: <Username name={name} /> })}</Empty>;
    if (kind === "scrobbles") {
      return (
        <TrackList
          items={d.items.filter(isRecent)}
          nowPlaying={"nowPlaying" in d ? d.nowPlaying : null}
          time
          actions={mine && picked ? rowActions : undefined}
          onSelect={
            mine && picked
              ? (r, e) => {
                  const on = !picked.has(r.id);
                  if (e.shiftKey) pickRange(r.id, on);
                  else pick(r.id, on);
                }
              : undefined
          }
          timeActions={mine && !picked ? (r) => <ScrobbleMenu row={r} onSelect={() => pick(r.id, true)} /> : undefined}
        />
      );
    }
    if (kind === "artists") return <LibraryArtists items={d.items.filter(isArtist)} name={name} rank={rank} />;
    if (kind === "albums") return <RankList kind="album" items={d.items.filter(isAlbum)} rank={rank} />;
    return <TrackList items={d.items.filter(isTopTrack)} rank={rank} count="playcount" />;
  };

  return (
    <>
      <div className="toolbar">
        <nav className="tabs sub">
          {libraryTabs().map(([p, l]) => (
            <Link key={p} className={(p.slice(1) || "scrobbles") === kind ? "active" : ""} to={base + p + search}>
              {l}
            </Link>
          ))}
        </nav>
        <DateRange />
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted">{summary(d, kind)}</p>
            {mine && kind === "scrobbles" && d.items.length > 0 && <div className="bulk-bar">{bulkBar(d)}</div>}
            {list(d)}
            <Pager total={d.total} limit={50} />
          </>
        )}
      </Async>
    </>
  );
}

function LibraryArtists({ items, name, rank }: { items: TopArtist[]; name: string; rank: number }) {
  const max = Math.max(1, ...items.map((i) => i.playcount));
  if (!items.length) return <Empty>{t("user.nothingForPeriod")}</Empty>;
  return (
    <table className="chartlist">
      <tbody>
        {items.map((a, i) => (
          <tr key={a.id}>
            <td className="c-rank">{rank + i}</td>
            <td className="c-art">
              <Link to={artistUrl(a.name)} tabIndex={-1}>
                <Art image={a.image} kind="artist" />
              </Link>
            </td>
            <td className="c-name">
              <Link className="strong" to={artistUrl(a.name)}>
                {a.name}
              </Link>
            </td>
            <td className="c-bar">
              <Link className="bar" to={`${userUrl(name)}/library/music/${enc(a.name)}`}>
                <span style={{ width: `${(a.playcount / max) * 100}%` }} />
                <b>{num(a.playcount)}</b> <em>{t("user.scrobblesWord", { count: a.playcount })}</em>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LibraryArtist({ name, artist }: { name: string; artist: string }) {
  const q = useApi<UserArtistLibrary>(`/user/library/artist${qs({ name, artist })}`);
  return (
    <Async q={q}>
      {(d) => (
        <>
          <div className="toolbar">
            <h2>
              <Link to={`${userUrl(name)}/library/artists`}>{t("user.library")}</Link> /{" "}
              <Link to={artistUrl(d.artist.name)}>{d.artist.name}</Link>
            </h2>
          </div>
          {d.counts.playcount === 0 ? (
            <Empty>{tx("user.notScrobbledArtist", { name: <Username name={name} />, artist: d.artist.name })}</Empty>
          ) : (
            <>
              <div className="stats boxed">
                <Stat label={t("user.statScrobbles")} value={num(d.counts.playcount)} />
                <Stat label={t("user.statAlbums")} value={num(d.counts.albums)} />
                <Stat label={t("user.statTracks")} value={num(d.counts.tracks)} />
                <Stat label={t("user.firstScrobbled")} value={date(d.first ?? 0)} />
              </div>
              <Section title={t("user.scrobblesLastYear")}>
                <BarChart data={weekTrend(d.trend)} height={120} every={8} />
              </Section>
              <div className="cols">
                <div className="main">
                  <Section title={t("user.statTracks")}>
                    <TrackList items={d.tracks} rank={1} count="playcount" showArtist={false} />
                  </Section>
                </div>
                <aside className="side">
                  <Section title={t("user.statAlbums")}>
                    <Grid
                      kind="album"
                      cols={2}
                      items={d.albums}
                      sub={(a) => t("user.scrobbleCount", { count: a.playcount })}
                    />
                  </Section>
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </Async>
  );
}
