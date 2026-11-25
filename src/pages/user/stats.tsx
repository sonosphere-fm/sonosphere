import { Suspense } from "react";
import { Link } from "react-router-dom";
import { artistUrl, date, num, qs, trackUrl, useApi, userUrl } from "../../lib";
import { locale, t, tx } from "../../i18n";
import { Button } from "../../kit";
import { Art, Empty, Section, Stat } from "../../ui/base";
import { BarChart } from "../../ui/charts";
import { Username } from "../../ui/username";
import { type DayCount, type ListeningStats, type Milestones, streaks } from "../../../shared/listening";

const weekdayNames = () =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" })
  );
const monthNames = () =>
  Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(2024, i, 1)).toLocaleDateString(locale(), { month: "short", timeZone: "UTC" })
  );

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const longDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(locale(), { day: "numeric", month: "long", timeZone: "UTC" });
const weekday = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;

// Thresholds split the year's listening days into four equal-sized shades.
function levels(days: DayCount[]) {
  const counts = days.map((d) => d.count).sort((a, b) => a - b);
  const at = (q: number) => counts[Math.floor((counts.length - 1) * q)] ?? 0;
  const cuts = [at(0.25), at(0.5), at(0.75)];
  return (count: number) => (count ? 1 + cuts.filter((c) => count > c).length : 0);
}

function PixelGrid({ name, year, today, days }: { name: string; year: number; today: string; days: DayCount[] }) {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const level = levels(days);
  const jan1 = Date.UTC(year, 0, 1);
  const lead = weekday(iso(jan1));
  const total = Math.round((Date.UTC(year + 1, 0, 1) - jan1) / 86400000);
  const weeks = Math.ceil((lead + total) / 7);
  const library = `${userUrl(name)}/library`;
  return (
    <div className="pixels-wrap">
      <div className="pixels" style={{ gridTemplateColumns: `2.25rem repeat(${weeks}, minmax(0, 1fr))` }}>
        {monthNames().map((m, i) => (
          <span
            key={m}
            className="pixels-month"
            style={{ gridColumn: 2 + Math.floor((lead + (Date.UTC(year, i, 1) - jan1) / 86400000) / 7) }}
          >
            {m}
          </span>
        ))}
        {weekdayNames().map((d, i) => (
          <span key={d} className="pixels-day" style={{ gridRow: 2 + i }}>
            {i % 2 ? "" : d}
          </span>
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = iso(jan1 + i * 86400000);
          const count = counts.get(date) ?? 0;
          const place = { gridRow: 2 + ((lead + i) % 7), gridColumn: 2 + Math.floor((lead + i) / 7) };
          if (date > today) return <span key={date} className="pixel future" style={place} />;
          const tip = count
            ? t("user.pixelTip", { date: longDate(date), count })
            : t("user.pixelTipNone", { date: longDate(date) });
          if (!count) return <span key={date} className="pixel" style={place} title={tip} />;
          return (
            <Link
              key={date}
              className="pixel"
              data-level={level(count)}
              style={place}
              title={tip}
              aria-label={tip}
              to={`${library}?from=${date}&to=${date}`}
            />
          );
        })}
      </div>
      <div className="pixels-legend muted small">
        {t("user.less")}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="pixel" data-level={l || undefined} />
        ))}
        {t("user.more")}
      </div>
    </div>
  );
}

function MilestoneList({ name }: { name: string }) {
  const { data } = useApi<Milestones>(`/user/milestones${qs({ name })}`);
  if (!data?.items.length) return null;
  return (
    <Section title={t("user.milestones")}>
      <ul className="feed milestones">
        {data.items.map(({ n, track }) => (
          <li key={n}>
            <Art image={track.image} />
            <div className="grow">
              <span className="strong">
                {n === 1 ? t("user.firstScrobble") : t("user.scrobbleNumber", { n: num(n) })}
              </span>
              <span className="muted">
                {tx("music.trackByArtist", {
                  track: <Link to={trackUrl(track.artist, track.title)}>{track.title}</Link>,
                  artist: <Link to={artistUrl(track.artist)}>{track.artist}</Link>,
                })}
              </span>
            </div>
            <span className="muted small">{date(track.playedAt)}</span>
          </li>
        ))}
      </ul>
      {data.next && (
        <p className="muted small">
          {t("user.nextMilestone", { n: num(data.next), left: num(data.next - data.total) })}
        </p>
      )}
    </Section>
  );
}

export function StatsBody({ s, name }: { s: ListeningStats; name: string }) {
  const plays = s.days.reduce((sum, d) => sum + d.count, 0);
  const title = (
    <h2 className="report-title">
      {tx("user.statsTitle", { name: <Username name={name} /> })} <span className="muted">· {s.year}</span>
    </h2>
  );
  if (!plays) {
    return (
      <>
        {title}
        <Empty>{t("user.noScrobblesIn", { year: s.year })}</Empty>
      </>
    );
  }
  const yearStreak = streaks(s.days.map((d) => d.date)).longest;
  const busiest = s.days.reduce((a, b) => (b.count > a.count ? b : a));
  const byWeekday = weekdayNames().map((label) => ({ label, value: 0 }));
  for (const d of s.days) byWeekday[weekday(d.date)].value += d.count;
  const favourite = byWeekday.reduce((a, b) => (b.value > a.value ? b : a));
  const card = `/api/user/year-card${qs({ name, year: s.year, tz: -new Date().getTimezoneOffset() })}`;
  return (
    <div className="report">
      <div className="report-head">
        {title}
        <Button kind="btn ghost small" href={card} download>
          {t("user.yearCard")}
        </Button>
      </div>
      <Section title={t("user.scrobblesByDay")}>
        <PixelGrid name={name} year={s.year} today={s.today} days={s.days} />
      </Section>
      <div className="stats boxed">
        <Stat
          label={t("user.daysListened")}
          value={num(s.days.length)}
          hint={t("user.scrobblesPerDay", { count: Math.round(plays / s.days.length) })}
        />
        <Stat label={t("user.busiestDay")} value={num(busiest.count)} hint={longDate(busiest.date)} />
        <Stat
          label={t("user.longestStreakIn", { year: s.year })}
          value={t("user.dayCount", { count: yearStreak.days })}
          hint={yearStreak.end ? t("user.streakEnded", { date: longDate(yearStreak.end) }) : undefined}
        />
        <Stat
          label={t("user.longestStreakEver")}
          value={t("user.dayCount", { count: s.longestStreak.days })}
          hint={s.currentStreak ? t("user.streakRunning", { count: s.currentStreak }) : t("user.noStreak")}
        />
        <Stat
          label={t("user.top10Artists")}
          value={s.topShare.toLocaleString(locale(), { style: "percent", maximumFractionDigits: 0 })}
          hint={t("user.ofYearScrobbles", { year: s.year })}
        />
      </div>
      <Section title={t("user.scrobblesByWeekday")}>
        <BarChart data={byWeekday} height={140} />
        <p className="muted small">
          {t("user.favouriteWeekday", { day: favourite.label })} ·{" "}
          {t("user.listeningDaysAllTime", { count: s.activeDays })}
        </p>
      </Section>
      <Suspense fallback={null}>
        <MilestoneList name={name} />
      </Suspense>
    </div>
  );
}
