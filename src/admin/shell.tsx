// The staff portal at /admin. Moderators see reports, users, content and the audit log; admins also get account
// actions, the catalogue tools and site settings. The server enforces every rule; this page only hides what a role can't use.
import "../admin.css";
import { Suspense, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Ico } from "../icons";
import { useAuth, useTitle } from "../lib";
import { Empty } from "../ui/base";
import { ROLE, useRole } from "./common";
import { Dashboard } from "./dashboard";
import { Reports } from "./reports";
import { FlagCount, Messages, Transcript } from "./messages";
import { Users, UserDetail } from "./users";
import { Content } from "./content";
import { Catalogue } from "./catalogue";
import { Audit } from "./audit";
import { SiteSettings } from "./settings";

// ---------- shell ----------
const SECTIONS: [string, string, boolean][] = [
  ["/admin", "Dashboard", false], ["/admin/reports", "Reports", false], ["/admin/messages", "Messages", false], ["/admin/users", "Users", false], ["/admin/content", "Content", false],
  ["/admin/catalogue", "Catalogue", true], ["/admin/audit", "Audit log", false], ["/admin/settings", "Site settings", true],
];
export function AdminPage() {
  const { me } = useAuth(), role = useRole();
  useTitle("Admin");
  if (!me?.admin) return <div className="wrap page narrow"><h1 className="page-title">Admin</h1><Empty>This area is for moderators and admins.</Empty></div>;
  const adminOnly = (el: ReactNode) => (role === "admin" ? el : <Empty>Only admins can use this section.</Empty>);
  return (
    <div className="wrap page adm">
      <div className="adm-head">
        <h1 className="page-title">Admin</h1>
        <span className={`adm-role role-${role}`}><Ico.Shield /> Signed in as {ROLE[role].toLowerCase()}</span>
      </div>
      <div className="adm-layout">
        <nav className="adm-nav" aria-label="Admin sections">
          {SECTIONS.filter(([, , a]) => !a || role === "admin").map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"}>{label}{to === "/admin/reports" && me.openReports > 0 && <span className="adm-count">{me.openReports}</span>}
              {to === "/admin/messages" && <Suspense fallback={null}><FlagCount /></Suspense>}</NavLink>
          ))}
        </nav>
        <div className="adm-body">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:id" element={role === "admin" ? <Transcript /> : <Empty>Only admins can read conversations. Reported messages, with the messages around them, are in the reports queue.</Empty>} />
            <Route path="users" element={<Users />} />
            <Route path="users/:name" element={<UserDetail />} />
            <Route path="content" element={<Content />} />
            <Route path="catalogue" element={adminOnly(<Catalogue />)} />
            <Route path="audit" element={<Audit />} />
            <Route path="settings" element={adminOnly(<SiteSettings />)} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
