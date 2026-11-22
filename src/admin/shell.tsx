import { Suspense, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Ico } from "../icons";
import { useAuth, useTitle } from "../lib";
import { Empty } from "../ui/base";
import { ROLE, useRole } from "./common";
import { cn } from "../ui/tw";
import { Dashboard } from "./dashboard";
import { Reports } from "./reports";
import { FlagCount, Messages, Transcript } from "./messages";
import { Users, UserDetail } from "./users";
import { Content } from "./content";
import { Catalogue } from "./catalogue";
import { Audit } from "./audit";
import { SiteSettings } from "./settings";

const SECTIONS: [string, string, boolean][] = [
  ["/admin", "Dashboard", false],
  ["/admin/reports", "Reports", false],
  ["/admin/messages", "Messages", false],
  ["/admin/users", "Users", false],
  ["/admin/content", "Content", false],
  ["/admin/catalogue", "Catalogue", true],
  ["/admin/audit", "Audit log", false],
  ["/admin/settings", "Site settings", true],
];
export function AdminPage() {
  // main.tsx only renders the portal for signed-in staff
  const me = useAuth().me!;
  const role = useRole();
  useTitle("Admin");
  const adminOnly = (el: ReactNode) => (role === "admin" ? el : <Empty>Only admins can use this section.</Empty>);
  const transcriptDenied = (
    <Empty>Only admins can read conversations. Reported messages, with the messages around them, are in the reports queue.</Empty>
  );
  return (
    <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 adm [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
      <div className="flex items-center justify-between gap-3 flex-wrap [&_.page-title]:mb-0">
        <h1 className="page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] max-sm:text-[26px]">Admin</h1>
        <span className={cn("adm-role inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 [&_svg]:size-4", role === "admin" && "[&_svg]:text-accent")}><Ico.Shield /> Signed in as {ROLE[role].toLowerCase()}</span>
      </div>
      <div className="grid grid-cols-[190px_minmax(0,1fr)] gap-9 items-start mt-[22px] max-[861px]:grid-cols-[minmax(0,1fr)] max-[861px]:gap-4 max-[861px]:mt-3.5">
        <nav className="flex flex-col sticky top-4 border-r border-line max-[861px]:static max-[861px]:flex-row max-[861px]:overflow-x-auto max-[861px]:border-r-0 max-[861px]:border-b max-[861px]:border-line max-[861px]:[scrollbar-width:none] [&_a]:flex [&_a]:items-center [&_a]:justify-between [&_a]:gap-2 [&_a]:py-[9px] [&_a]:pr-3.5 [&_a]:pl-3 [&_a]:text-ink-2 [&_a]:font-semibold [&_a]:border-l-[3px] [&_a]:border-transparent [&_a:hover]:text-ink [&_a:hover]:bg-panel [&_a.active]:text-ink [&_a.active]:border-l-accent [&_a.active]:bg-panel max-[861px]:[&_a]:whitespace-nowrap max-[861px]:[&_a]:border-l-0 max-[861px]:[&_a]:border-b-[3px] max-[861px]:[&_a]:border-b-transparent max-[861px]:[&_a]:px-3 max-[861px]:[&_a]:py-2.5 max-[861px]:[&_a.active]:border-b-accent max-[861px]:[&_a.active]:bg-transparent" aria-label="Admin sections">
          {SECTIONS.filter(([, , a]) => !a || role === "admin").map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"}>
              {label}
              {to === "/admin/reports" && me.openReports > 0 && <span className="bg-accent text-on-accent text-[11px] font-bold leading-none px-1.5 py-[3px] rounded-[9px]">{me.openReports}</span>}
              {to === "/admin/messages" && <Suspense fallback={null}><FlagCount /></Suspense>}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 [&_.toolbar]:items-center [&_.toolbar_.astryx-selector]:min-h-10 [&_.toolbar_.astryx-selector]:text-[15px] [&_.toolbar_.astryx-selector]:font-normal">
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
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
