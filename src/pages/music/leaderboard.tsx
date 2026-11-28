import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Ico } from "../../icons";
import { locale, t } from "../../i18n";
import { Button } from "../../kit";
import { artistUrl, num, qs, TITLES, useApi, useAuth, useParam, userUrl, useTitle } from "../../lib";
import { NotFound } from "../notfound";
import { Async, Avatar, Empty, Pager, Section } from "../../ui/base";
import { Username } from "../../ui/username";
import {
  LEADER_BOARDS,
  type Devotee,
  type Leader,
  type LeaderBoard,
  type Leaderboard as LeaderboardData,
  type LeaderPage,
  type LeaderPeriod,
} from "../../../shared/home";

const PAGE = 50;

const periods = (): [LeaderPeriod, string][] => [
  ["7day", t("music.thisWeek")],
  ["1month", t("music.thisMonth")],
  ["12month", t("music.thisYear")],
  ["overall", t("music.allTime")],
];

const boardTitle = (board: LeaderBoard) =>
  ({
    hours: t("music.leaderHours"),
    scrobbles: t("music.leaderScrobbles"),
    artists: t("music.leaderArtists"),
    fans: t("music.leaderDevoted"),
    loves: t("music.leaderLoves"),
  })[board];

const boardUrl = (board: LeaderBoard, period: LeaderPeriod) =>
  `/leaderboards/${board}${qs({ period: period === "7day" ? undefined : period })}`;

const hours = (seconds: number) =>
  t("music.hoursShort", {
    hours: (seconds / 3600).toLocaleString(locale(), { maximumFractionDigits: seconds < 36000 ? 1 : 0 }),
  });

const percent = (share: number) => share.toLocaleString(locale(), { style: "percent", maximumFractionDigits: 0 });

function Periods({ period, setPeriod }: { period: LeaderPeriod; setPeriod: (p: LeaderPeriod) => void }) {
  return (
    <nav className="tabs sub leader-periods">
      {periods().map(([k, label]) => (
        <Button key={k} kind={k === period ? "active" : ""} aria-pressed={k === period} onClick={() => setPeriod(k)}>
          {label}
        </Button>
      ))}
    </nav>
  );
}

function Board({
  board,
  period,
  items,
  value,
}: {
  board: LeaderBoard;
  period: LeaderPeriod;
  items: (Leader | Devotee)[];
  value: (n: number) => string;
}) {
  return (
    <Section title={boardTitle(board)} more={boardUrl(board, period)} sub>
      {items.length ? (
        <ol className="userlist leaders">
          {items.map((u, i) => (
            <li key={u.id}>
              <span className="rank">{i + 1}</span>
              <Avatar user={u} size={32} />
              <span className="grow">
                <Link className="strong" to={userUrl(u.username)}>
                  <Username user={u} />
                </Link>
                {"artist" in u && (
                  <Link className="muted small" to={artistUrl(u.artist)}>
                    {u.artist}
                  </Link>
                )}
              </span>
              <b>{value(u.value)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>{t("music.leaderNobody")}</Empty>
      )}
    </Section>
  );
}

function Boards({ period }: { period: LeaderPeriod }) {
  const q = useApi<LeaderboardData>(`/leaderboard${qs({ period })}`);
  return (
    <Async q={q}>
      {(d) => (
        <>
          <div className="stats boxed">
            <div className="stat">
              <div className="stat-label">{t("music.leaderHours")}</div>
              <div className="stat-value">{num(Math.round(d.totals.seconds / 3600))}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t("music.scrobbles")}</div>
              <div className="stat-value">{num(d.totals.plays)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t("music.listeners")}</div>
              <div className="stat-value">{num(d.totals.listeners)}</div>
            </div>
          </div>
          <div className="leaderboards">
            <Board board="hours" period={period} items={d.seconds} value={hours} />
            <Board board="scrobbles" period={period} items={d.plays} value={num} />
            <Board board="artists" period={period} items={d.artists} value={num} />
            <Board
              board="fans"
              period={period}
              items={d.devoted}
              value={(count) => t("user.scrobbleCount", { count })}
            />
            <Board board="loves" period={period} items={d.loves} value={num} />
          </div>
        </>
      )}
    </Async>
  );
}

export function Leaderboard() {
  const [period, setPeriod] = useState<LeaderPeriod>("7day");
  return (
    <Section
      title={t("music.leaderboard")}
      more={`/leaderboards${qs({ period: period === "7day" ? undefined : period })}`}
    >
      <Periods period={period} setPeriod={setPeriod} />
      <Boards period={period} />
    </Section>
  );
}

function usePeriod(): [LeaderPeriod, (p: LeaderPeriod) => void] {
  const [period, setPeriod] = useParam("period", "7day");
  const known = periods().find(([k]) => k === period);
  return [known ? known[0] : "7day", setPeriod];
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="bar">
      <span style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      <b>{label}</b>
    </span>
  );
}

function BoardTable({ d, me }: { d: LeaderPage; me?: string }) {
  const from = d.offset + 1;
  const max = d.items[0]?.value ?? 0;
  const metric: Record<"hours" | "scrobbles" | "artists", (n: number) => string> = {
    hours,
    scrobbles: num,
    artists: num,
  };
  return (
    <div className="leader-scroll">
      <table className="chartlist leader-table">
        <thead>
          <tr>
            <th className="c-rank">#</th>
            <th>{t("music.leaderListener")}</th>
            {d.board === "fans" && (
              <>
                <th>{t("music.leaderTopArtist")}</th>
                <th>{t("music.scrobbles")}</th>
                <th className="c-num">{t("music.leaderShare")}</th>
              </>
            )}
            {d.board === "loves" && <th>{t("music.leaderLovesCol")}</th>}
            {d.board !== "fans" && d.board !== "loves" && (
              <>
                <th>{boardTitle(d.board)}</th>
                {d.board !== "hours" && <th className="c-num">{t("music.leaderHoursCol")}</th>}
                {d.board !== "scrobbles" && <th className="c-num">{t("music.scrobbles")}</th>}
                {d.board !== "artists" && <th className="c-num">{t("music.leaderArtistsCol")}</th>}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {d.items.map((u, i) => (
            <tr key={u.id} className={u.username === me ? "now" : undefined}>
              <td className="c-rank">{from + i}</td>
              <td className="c-user">
                <span className="leader-user">
                  <Avatar user={u} size={32} />
                  <Link className="strong" to={userUrl(u.username)}>
                    <Username user={u} />
                  </Link>
                </span>
              </td>
              {"share" in u && (
                <>
                  <td className="c-artist">
                    <Link to={artistUrl(u.artist)}>{u.artist}</Link>
                  </td>
                  <td className="c-bar">
                    <Bar value={u.value} max={max} label={num(u.value)} />
                  </td>
                  <td className="c-num">{percent(u.share)}</td>
                </>
              )}
              {d.board === "loves" && (
                <td className="c-bar">
                  <Bar value={u.value} max={max} label={num(u.value)} />
                </td>
              )}
              {"seconds" in u && d.board !== "fans" && d.board !== "loves" && (
                <>
                  <td className="c-bar">
                    <Bar value={u.value} max={max} label={metric[d.board](u.value)} />
                  </td>
                  {d.board !== "hours" && <td className="c-num">{hours(u.seconds)}</td>}
                  {d.board !== "scrobbles" && <td className="c-num">{num(u.plays)}</td>}
                  {d.board !== "artists" && <td className="c-num">{num(u.artists)}</td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardPage({ board }: { board: LeaderBoard }) {
  const [period, setPeriod] = usePeriod();
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const page = Number(sp.get("page")) || 1;
  const q = useApi<LeaderPage>(`/leaderboard/${board}${qs({ period, page, limit: PAGE })}`);
  useTitle(t("common.titleSubpage", { name: TITLES.leaderboards, tab: boardTitle(board) }));
  return (
    <div className="wrap page">
      <p className="small">
        <Link to={`/leaderboards${qs({ period: period === "7day" ? undefined : period })}`}>
          <Ico.Left /> {t("music.allLeaderboards")}
        </Link>
      </p>
      <h1 className="page-title">{boardTitle(board)}</h1>
      <nav className="tabs leader-boards-nav">
        {LEADER_BOARDS.map((b) => (
          <Button key={b} kind={b === board ? "active" : ""} href={boardUrl(b, period)}>
            {boardTitle(b)}
          </Button>
        ))}
      </nav>
      <Periods period={period} setPeriod={setPeriod} />
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <>
              <p className="muted small">{t("music.leaderRanked", { count: d.total })}</p>
              <BoardTable d={d} me={me?.username} />
              <Pager total={d.total} limit={PAGE} />
            </>
          ) : (
            <Empty>{t("music.leaderNobody")}</Empty>
          )
        }
      </Async>
    </div>
  );
}

export function LeaderboardsPage() {
  const { board } = useParams();
  const [period, setPeriod] = usePeriod();
  useTitle(board ? null : TITLES.leaderboards);
  if (board) {
    const known = LEADER_BOARDS.find((b) => b === board);
    return known ? <BoardPage key={known} board={known} /> : <NotFound />;
  }
  return (
    <div className="wrap page">
      <h1 className="page-title">{t("music.leaderboards")}</h1>
      <Periods period={period} setPeriod={setPeriod} />
      <Boards period={period} />
    </div>
  );
}
