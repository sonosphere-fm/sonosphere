import { Link } from "react-router-dom";
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
          <div className="stats boxed adm-tiles">
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
          <div className="cols even adm-charts">
            <Section title="Scrobbles per day"><BarChart data={series(d.series.scrobbles)} height={110} every={5} /></Section>
            <Section title="Sign-ups per day"><BarChart data={series(d.series.signups)} height={110} every={5} unit="sign-ups" /></Section>
            <Section title="Reports per day"><BarChart data={series(d.series.reports)} height={110} every={5} unit="reports" /></Section>
            <Section title="Posts per day">
              <BarChart data={series(d.series.posts)} height={110} every={5} unit="wall posts, journal posts and wiki edits" />
            </Section>
          </div>
          <div className="cols adm-split">
            <Section title="Recent staff actions" more="/admin/audit" moreLabel="Audit log">
              <AuditList items={d.recentActions} empty="No staff actions yet." />
            </Section>
            <aside className="side">
              <Section title="Newest members" more="/admin/users">
                <ul className="adm-people">
                  {d.recentUsers.map(u => (
                    <li key={u.id}>
                      <Avatar user={u} size={32} />
                      <Link className="grow strong" to={adminUrl(u.username)}>{u.username}</Link>
                      <span className="muted small">{ago(u.registeredAt)}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="At a glance">
                <dl className="adm-facts">
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
