import { Link } from "react-router-dom";
import { cn, colsEven } from "../ui/tw";
import { ago, num, plural, useApi, useTitle } from "../lib";
import { Async, Avatar, Section, Stat } from "../ui/base";
import { BarChart } from "../ui/charts";
import { adminUrl } from "./common";
import { AuditList } from "./audit";
import type { Dashboard as DashboardData, DayCount } from "../../shared/admin";

const series = (rows: DayCount[]) =>
  rows.map(r => {
    const day = new Date(r.day * 1000);
    return {
      label: String(day.getUTCDate()),
      value: r.count,
      tip: day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    };
  });
export function Dashboard() {
  const q = useApi<DashboardData>("/admin/dashboard");
  useTitle("Admin dashboard");
  return (
    <Async q={q}>{d => {
      const t = d.totals;
      return (
        <>
          <div className="stats boxed flex flex-wrap gap-0 mb-7 bg-panel *:flex-1 *:min-w-[140px] *:px-[18px] *:py-3.5 max-sm:*:min-w-1/2 max-sm:*:border-b max-sm:*:border-line [&_.stat-value]:text-[22px]">
            <Stat label="Members" value={num(t.users)} hint={`${num(t.newUsers7)} new this week`} />
            <Stat label="Active listeners" value={num(t.active7)} hint="scrobbled in the last 7 days" />
            <Stat label="Scrobbles" value={num(t.scrobbles)} hint={`${num(t.scrobbles7)} this week`} />
            <Stat label="Open reports" value={<Link to="/admin/reports">{num(t.openReports)}</Link>} hint={`${num(t.reports7)} filed this week`} />
            <Stat label="Spam flags" value={<Link to="/admin/messages?tab=flags">{num(t.openFlags)}</Link>} hint="raised by the message limits" />
            <Stat
              label="Suspended"
              value={<Link to="/admin/users?filter=suspended">{num(t.suspended)}</Link>}
              hint={<Link to="/admin/users?filter=banned">{plural(t.banned, "banned account")}</Link>}
            />
          </div>
          <div className={cn(colsEven, "[&_.section]:mb-[18px]")}>
            <Section title="Scrobbles per day"><BarChart data={series(d.series.scrobbles)} height={110} every={5} /></Section>
            <Section title="Sign-ups per day"><BarChart data={series(d.series.signups)} height={110} every={5} unit="sign-ups" /></Section>
            <Section title="Reports per day"><BarChart data={series(d.series.reports)} height={110} every={5} unit="reports" /></Section>
            <Section title="Posts per day">
              <BarChart data={series(d.series.posts)} height={110} every={5} unit="wall posts, journal posts and wiki edits" />
            </Section>
          </div>
          <div className="cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2 mt-2">
            <Section title="Recent staff actions" more="/admin/audit" moreLabel="Audit log">
              <AuditList items={d.recentActions} empty="No staff actions yet." />
            </Section>
            <aside className="side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block">
              <Section title="Newest members" more="/admin/users">
                <ul className="list-none m-0 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">
                  {d.recentUsers.map(u => (
                    <li key={u.id}>
                      <Avatar user={u} size={32} />
                      <Link className="flex-1 min-w-0 font-semibold" to={adminUrl(u.username)}>{u.username}</Link>
                      <span className="text-muted text-[13px]">{ago(u.registeredAt)}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="At a glance">
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 m-0 text-sm [&_dt]:text-muted [&_dt]:font-semibold [&_dd]:m-0">
                  <dt>Staff</dt><dd>{plural(t.admins, "admin")}, {plural(t.moderators, "moderator")}</dd>
                  <dt>Posts this week</dt><dd>{num(t.shouts7)} wall posts, {num(t.journals7)} journal posts, {num(t.wikis7)} wiki edits</dd>
                  <dt>Catalogue</dt><dd>{num(t.artists)} artists, {num(t.albums)} albums, {num(t.tracks)} tracks</dd>
                  <dt>Locked wikis</dt><dd><Link to="/admin/content?kind=wikis&locked=1">{num(t.lockedWikis)}</Link></dd>
                  <dt>Sign-ups, 30 days</dt><dd>{num(t.newUsers30)}</dd>
                </dl>
              </Section>
            </aside>
          </div>
        </>
      );
    }}</Async>
  );
}
