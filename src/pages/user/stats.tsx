import { Link } from "react-router-dom";
import { num, plural, userUrl } from "../../lib";
import { Empty, Section, Stat } from "../../ui/base";
import { BarChart } from "../../ui/charts";
import { Username } from "../../ui/username";
import { type DayCount, type ListeningStats, streaks } from "../../../shared/listening";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const longDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
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
        {MONTHS.map((m, i) => (
          <span
            key={m}
            className="pixels-month"
            style={{ gridColumn: 2 + Math.floor((lead + (Date.UTC(year, i, 1) - jan1) / 86400000) / 7) }}
          >
            {m}
          </span>
        ))}
        {DAYS.map((d, i) => (
          <span key={d} className="pixels-day" style={{ gridRow: 2 + i }}>
            {i % 2 ? "" : d}
          </span>
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = iso(jan1 + i * 86400000);
          const count = counts.get(date) ?? 0;
          const place = { gridRow: 2 + ((lead + i) % 7), gridColumn: 2 + Math.floor((lead + i) / 7) };
          if (date > today) return <span key={date} className="pixel future" style={place} />;
          const tip = `${longDate(date)}: ${count ? plural(count, "scrobble") : "no scrobbles"}`;
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
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="pixel" data-level={l || undefined} />
        ))}
        More
      </div>
    </div>
  );
}

export function StatsBody({ s, name }: { s: ListeningStats; name: string }) {
  const plays = s.days.reduce((sum, d) => sum + d.count, 0);
  const title = (
    <h2 className="report-title">
      <Username name={name} />
      's listening stats <span className="muted">· {s.year}</span>
    </h2>
  );
  if (!plays) {
    return (
      <>
        {title}
        <Empty>No scrobbles in {s.year}.</Empty>
      </>
    );
  }
  const yearStreak = streaks(s.days.map((d) => d.date)).longest;
  const busiest = s.days.reduce((a, b) => (b.count > a.count ? b : a));
  const byWeekday = DAYS.map((label) => ({ label, value: 0 }));
  for (const d of s.days) byWeekday[weekday(d.date)].value += d.count;
  const favourite = byWeekday.reduce((a, b) => (b.value > a.value ? b : a));
  return (
    <div className="report">
      {title}
      <Section title="Scrobbles by day">
        <PixelGrid name={name} year={s.year} today={s.today} days={s.days} />
      </Section>
      <div className="stats boxed">
        <Stat
          label="Days listened"
          value={num(s.days.length)}
          hint={`${num(Math.round(plays / s.days.length))} scrobbles a listening day`}
        />
        <Stat label="Busiest day" value={num(busiest.count)} hint={longDate(busiest.date)} />
        <Stat
          label={`Longest streak in ${s.year}`}
          value={plural(yearStreak.days, "day")}
          hint={yearStreak.end ? `ended ${longDate(yearStreak.end)}` : undefined}
        />
        <Stat
          label="Longest streak ever"
          value={plural(s.longestStreak.days, "day")}
          hint={s.currentStreak ? `${plural(s.currentStreak, "day")} running now` : "no streak running"}
        />
        <Stat label="Top 10 artists" value={`${Math.round(s.topShare * 100)}%`} hint={`of ${s.year}'s scrobbles`} />
      </div>
      <Section title="Scrobbles by weekday">
        <BarChart data={byWeekday} height={140} />
        <p className="muted small">
          Favourite: {favourite.label} · {num(s.activeDays)} listening days all time
        </p>
      </Section>
    </div>
  );
}
