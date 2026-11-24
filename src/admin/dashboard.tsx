import { Link } from "react-router-dom";
import { ago, num, useApi, useTitle } from "../lib";
import { locale } from "../i18n";
import { Async, Avatar, Section, Stat } from "../ui/base";
import { BarChart } from "../ui/charts";
import { FACTS, PEOPLE, PERSON, TILES, adminUrl } from "./common";
import { AuditList } from "./audit";
import { t } from "./i18n";
import type { Dashboard as DashboardData, DayCount } from "../../shared/admin";

const series = (rows: DayCount[]) =>
  rows.map((r) => {
    const day = new Date(r.day * 1000);
    return {
      label: String(day.getUTCDate()),
      value: r.count,
      tip: day.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    };
  });
export function Dashboard() {
  const q = useApi<DashboardData>("/admin/dashboard");
  useTitle(t("admin.dashboardTitle"));
  return (
    <Async q={q}>
      {(d) => {
        const totals = d.totals;
        return (
          <>
            <div className={TILES}>
              <Stat
                label={t("admin.members")}
                value={num(totals.users)}
                hint={t("admin.newThisWeek", { count: totals.newUsers7 })}
              />
              <Stat label={t("admin.activeListeners")} value={num(totals.active7)} hint={t("admin.activeHint")} />
              <Stat
                label={t("admin.colScrobbles")}
                value={num(totals.scrobbles)}
                hint={t("admin.thisWeek", { count: totals.scrobbles7 })}
              />
              <Stat
                label={t("admin.openReportsLabel")}
                value={<Link to="/admin/reports">{num(totals.openReports)}</Link>}
                hint={t("admin.filedThisWeek", { count: totals.reports7 })}
              />
              <Stat
                label={t("admin.spamFlags")}
                value={<Link to="/admin/messages?tab=flags">{num(totals.openFlags)}</Link>}
                hint={t("admin.spamFlagsHint")}
              />
              <Stat
                label={t("admin.suspended")}
                value={<Link to="/admin/users?filter=suspended">{num(totals.suspended)}</Link>}
                hint={
                  <Link to="/admin/users?filter=banned">{t("admin.bannedAccounts", { count: totals.banned })}</Link>
                }
              />
            </div>
            <div className="cols even gap-x-8 gap-y-2 [&_.section]:mb-[18px]">
              <Section title={t("admin.scrobblesPerDay")}>
                <BarChart data={series(d.series.scrobbles)} height={110} every={5} />
              </Section>
              <Section title={t("admin.signupsPerDay")}>
                <BarChart data={series(d.series.signups)} height={110} every={5} unit={t("admin.unitSignups")} />
              </Section>
              <Section title={t("admin.reportsPerDay")}>
                <BarChart data={series(d.series.reports)} height={110} every={5} unit={t("admin.unitReports")} />
              </Section>
              <Section title={t("admin.postsPerDay")}>
                <BarChart data={series(d.series.posts)} height={110} every={5} unit={t("admin.unitPosts")} />
              </Section>
            </div>
            <div className="cols mt-2">
              <Section title={t("admin.recentStaffActions")} more="/admin/audit" moreLabel={t("admin.navAudit")}>
                <AuditList items={d.recentActions} empty={t("admin.noStaffActions")} />
              </Section>
              <aside className="side">
                <Section title={t("admin.newestMembers")} more="/admin/users">
                  <ul className={PEOPLE}>
                    {d.recentUsers.map((u) => (
                      <li key={u.id} className={PERSON}>
                        <Avatar user={u} size={32} />
                        <Link className="grow strong" to={adminUrl(u.username)}>
                          <Username user={u} />
                        </Link>
                        <span className="muted small">{ago(u.registeredAt)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
                <Section title={t("admin.atAGlance")}>
                  <dl className={FACTS}>
                    <dt>{t("admin.colStaff")}</dt>
                    <dd>
                      {t("admin.staffCounts", {
                        admins: t("admin.adminCount", { count: totals.admins }),
                        moderators: t("admin.moderatorCount", { count: totals.moderators }),
                      })}
                    </dd>
                    <dt>{t("admin.postsThisWeek")}</dt>
                    <dd>
                      {t("admin.postCounts", {
                        shouts: num(totals.shouts7),
                        journals: num(totals.journals7),
                        wikis: num(totals.wikis7),
                      })}
                    </dd>
                    <dt>{t("admin.navCatalogue")}</dt>
                    <dd>
                      {t("admin.catalogueCounts", {
                        artists: num(totals.artists),
                        albums: num(totals.albums),
                        tracks: num(totals.tracks),
                      })}
                    </dd>
                    <dt>{t("admin.lockedWikis")}</dt>
                    <dd>
                      <Link to="/admin/content?kind=wikis&locked=1">{num(totals.lockedWikis)}</Link>
                    </dd>
                    <dt>{t("admin.signups30")}</dt>
                    <dd>{num(totals.newUsers30)}</dd>
                    <dt>{t("admin.emails30")}</dt>
                    <dd>
                      {t("admin.mailCounts", {
                        sent: num(d.mail30.sent),
                        opened: num(d.mail30.opened),
                        clicked: num(d.mail30.clicked),
                      })}
                    </dd>
                  </dl>
                </Section>
              </aside>
            </div>
          </>
        );
      }}
    </Async>
  );
}
import { Username } from "../ui/username";
