import { Suspense, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Ico } from "../icons";
import { useAuth, useTitle } from "../lib";
import { Empty, Pane } from "../ui/base";
import { COUNT, cx, useRole, type AdminKey, type Role } from "./common";
import { t } from "./i18n";
import { Dashboard } from "./dashboard";
import { Reports } from "./reports";
import { FlagCount, Messages, Transcript } from "./messages";
import { Users, UserDetail } from "./users";
import { Content } from "./content";
import { Catalogue } from "./catalogue";
import { Audit } from "./audit";
import { SiteSettings } from "./settings";
import { ChangelogEditor, ChangelogPosts } from "./changelog";

const SECTIONS: [string, AdminKey, boolean][] = [
  ["/admin", "admin.navDashboard", false],
  ["/admin/reports", "admin.navReports", false],
  ["/admin/messages", "admin.navMessages", false],
  ["/admin/users", "admin.navUsers", false],
  ["/admin/content", "admin.navContent", false],
  ["/admin/catalogue", "admin.navCatalogue", true],
  ["/admin/changelog", "admin.navChangelog", true],
  ["/admin/audit", "admin.navAudit", false],
  ["/admin/settings", "admin.navSettings", true],
];
const SIGNED_IN_AS: Record<Role, AdminKey> = {
  user: "admin.signedInAsUser",
  moderator: "admin.signedInAsModerator",
  admin: "admin.signedInAsAdmin",
};

const LAYOUT = cx(
  "grid grid-cols-[190px_minmax(0,1fr)] gap-9 [align-items:start] mt-[22px]",
  "max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:gap-4 max-[860px]:mt-[14px]"
);
const NAV = cx(
  "flex flex-col sticky top-4 border-r border-r-site-line",
  "max-[860px]:static max-[860px]:flex-row max-[860px]:overflow-x-auto max-[860px]:[border-right:0]",
  "max-[860px]:border-b max-[860px]:border-b-site-line max-[860px]:[scrollbar-width:none]"
);
const NAV_LINK = cx(
  "flex items-center justify-between gap-2 py-[9px] pr-[14px] pl-3 font-semibold",
  "border-l-[3px] max-[860px]:whitespace-nowrap max-[860px]:[border-left:0]",
  "max-[860px]:border-b-[3px] max-[860px]:py-[10px] max-[860px]:px-3"
);
const NAV_ACTIVE = cx(
  "text-site-ink bg-site-panel border-l-site-accent",
  "max-[860px]:border-b-site-accent max-[860px]:[background:none]"
);
const NAV_IDLE = cx(
  "text-site-ink-2 border-l-transparent max-[860px]:border-b-transparent",
  "hover:text-site-ink hover:bg-site-panel"
);
const navLink = ({ isActive }: { isActive: boolean }) => cx(NAV_LINK, isActive ? NAV_ACTIVE : NAV_IDLE);
const ROLE_TAG = "inline-flex items-center gap-1.5 text-[13px] font-semibold text-site-ink-2 [&_svg]:size-4";
const roleTag = (role: Role) => cx(ROLE_TAG, role === "admin" ? "[&_svg]:text-site-accent" : "");

export function AdminPage() {
  // main.tsx only renders the portal for signed-in staff
  const me = useAuth().me!;
  const role = useRole();
  useTitle(t("admin.title"));
  const adminOnly = (el: ReactNode) => (role === "admin" ? el : <Empty>{t("admin.adminsOnly")}</Empty>);
  const transcriptDenied = <Empty>{t("admin.transcriptDenied")}</Empty>;
  return (
    <div className="wrap page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="page-title mb-0">{t("admin.title")}</h1>
        <span className={roleTag(role)}>
          <Ico.Shield /> {t(SIGNED_IN_AS[role])}
        </span>
      </div>
      <div className={LAYOUT}>
        <nav className={NAV} aria-label={t("admin.sections")}>
          {SECTIONS.filter(([, , a]) => !a || role === "admin").map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} className={navLink}>
              {t(label)}
              {to === "/admin/reports" && me.openReports > 0 && <span className={COUNT}>{me.openReports}</span>}
              {to === "/admin/messages" && (
                <Suspense fallback={null}>
                  <FlagCount />
                </Suspense>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Pane>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="reports" element={<Reports />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:id" element={role === "admin" ? <Transcript /> : transcriptDenied} />
              <Route path="users" element={<Users />} />
              <Route path="users/:name" element={<UserDetail />} />
              <Route path="content" element={<Content />} />
              <Route path="catalogue" element={adminOnly(<Catalogue />)} />
              <Route path="audit" element={<Audit />} />
              <Route path="settings" element={adminOnly(<SiteSettings />)} />
              <Route path="changelog" element={adminOnly(<ChangelogPosts />)} />
              <Route path="changelog/new" element={adminOnly(<ChangelogEditor />)} />
              <Route path="changelog/:id/edit" element={adminOnly(<ChangelogEditor />)} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Pane>
        </div>
      </div>
    </div>
  );
}
