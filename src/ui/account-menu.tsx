import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { Ico } from "../icons";
import { api, useAuth, userUrl, type Me, type Ok } from "../lib";

export default function AccountMenu({
  viewer: me,
  button,
}: {
  viewer: Me;
  button: ComponentProps<typeof DropdownMenu>["button"];
}) {
  const nav = useNavigate();
  const { setMe } = useAuth();
  const dmCount = me.dm.unread + me.dm.requests;
  const logout = () =>
    api<Ok>("/auth/logout", { body: {} }).then(() => {
      setMe(null);
      nav("/");
    });
  return (
    <DropdownMenu
      placement="below"
      alignment="end"
      hasChevron={false}
      menuWidth={200}
      menuMaxHeight={480}
      button={button}
    >
      <DropdownMenuItem icon={<Ico.User />} label="Profile" href={userUrl(me.username)} />
      <DropdownMenuItem icon={<Ico.Library />} label="Library" href={`${userUrl(me.username)}/library`} />
      <DropdownMenuItem
        icon={<Ico.Reports />}
        label="Listening reports"
        href={`${userUrl(me.username)}/listening-report/week`}
      />
      <DropdownMenuItem icon={<Ico.Recommended />} label="Recommended" href="/recommended" />
      <DropdownMenuItem
        icon={<Ico.Chat />}
        label={dmCount > 0 ? `Messages (${dmCount})` : "Messages"}
        href={!me.dm.unread && me.dm.requests ? "/messages/requests" : "/messages"}
      />
      <DropdownMenuItem icon={<Ico.Inbox />} label={me.unread > 0 ? `Inbox (${me.unread})` : "Inbox"} href="/inbox" />
      <DropdownMenuItem icon={<Ico.Scrobble />} label="Scrobble" href="/scrobble" />
      <DropdownMenuItem icon={<Ico.Library />} label="Import listening history" href="/import" />
      <DropdownMenuItem icon={<Ico.Settings />} label="Settings" href="/settings" />
      {me.admin && (
        <DropdownMenuItem
          icon={<Ico.Shield />}
          label={me.openReports > 0 ? `Admin (${me.openReports})` : "Admin"}
          href={me.openReports > 0 ? "/admin/reports" : "/admin"}
        />
      )}
      <DropdownMenuItem icon={<Ico.Discord />} label="Join our Discord" href="/discord" />
      <DropdownMenuItem icon={<Ico.LogOut />} label="Log out" onClick={logout} />
    </DropdownMenu>
  );
}
