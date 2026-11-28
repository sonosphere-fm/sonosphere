import { useState } from "react";
import { Link } from "react-router-dom";
import { locale, t } from "../../i18n";
import { Button } from "../../kit";
import { artistUrl, num, qs, useApi, userUrl } from "../../lib";
import { Async, Avatar, Empty, Section } from "../../ui/base";
import { Username } from "../../ui/username";
import type { Devotee, Leader, Leaderboard as LeaderboardData, LeaderPeriod } from "../../../shared/home";

const periods = (): [LeaderPeriod, string][] => [
  ["7day", t("music.thisWeek")],
  ["1month", t("music.thisMonth")],
  ["12month", t("music.thisYear")],
  ["overall", t("music.allTime")],
];

const hours = (seconds: number) =>
  t("music.hoursShort", {
    hours: (seconds / 3600).toLocaleString(locale(), { maximumFractionDigits: seconds < 36000 ? 1 : 0 }),
  });

function Board({ title, items, value }: { title: string; items: (Leader | Devotee)[]; value: (n: number) => string }) {
  return (
    <Section title={title} sub>
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

export function Leaderboard() {
  const [period, setPeriod] = useState<LeaderPeriod>("7day");
  const q = useApi<LeaderboardData>(`/leaderboard${qs({ period })}`);
  return (
    <Section title={t("music.leaderboard")}>
      <nav className="tabs sub leader-periods">
        {periods().map(([k, label]) => (
          <Button key={k} kind={k === period ? "active" : ""} aria-pressed={k === period} onClick={() => setPeriod(k)}>
            {label}
          </Button>
        ))}
      </nav>
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
              <Board title={t("music.leaderHours")} items={d.seconds} value={hours} />
              <Board title={t("music.leaderScrobbles")} items={d.plays} value={num} />
              <Board title={t("music.leaderArtists")} items={d.artists} value={num} />
              <Board
                title={t("music.leaderDevoted")}
                items={d.devoted}
                value={(count) => t("user.scrobbleCount", { count })}
              />
              <Board title={t("music.leaderLoves")} items={d.loves} value={num} />
            </div>
          </>
        )}
      </Async>
    </Section>
  );
}
