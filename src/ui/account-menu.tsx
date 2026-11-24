import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { Ico } from "../icons";
import { api, useAuth, userUrl, type Me, type Ok } from "../lib";
import { t } from "../i18n";

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
      <DropdownMenuItem icon={<Ico.User />} label={t("common.profile")} href={userUrl(me.username)} />
      <DropdownMenuItem icon={<Ico.Library />} label={t("common.library")} href={`${userUrl(me.username)}/library`} />
      <DropdownMenuItem
        icon={<Ico.Reports />}
        label={t("common.listeningReports")}
        href={`${userUrl(me.username)}/listening-report/week`}
      />
      <DropdownMenuItem icon={<Ico.Recommended />} label={t("common.recommended")} href="/recommended" />
      <DropdownMenuItem
        icon={<Ico.Chat />}
        label={dmCount > 0 ? t("common.messagesCount", { count: dmCount }) : t("common.messages")}
        href={!me.dm.unread && me.dm.requests ? "/messages/requests" : "/messages"}
      />
      <DropdownMenuItem
        icon={<Ico.Inbox />}
        label={me.unread > 0 ? t("common.inboxCount", { count: me.unread }) : t("common.inbox")}
        href="/inbox"
      />
      <DropdownMenuItem icon={<Ico.Scrobble />} label={t("common.scrobble")} href="/scrobble" />
      <DropdownMenuItem icon={<Ico.Settings />} label={t("common.settings")} href="/settings" />
      {me.admin && (
        <DropdownMenuItem
          icon={<Ico.Shield />}
          label={me.openReports > 0 ? t("common.adminCount", { count: me.openReports }) : t("common.admin")}
          href={me.openReports > 0 ? "/admin/reports" : "/admin"}
        />
      )}
      <DropdownMenuItem icon={<Ico.Discord />} label={t("common.joinDiscord")} href="/discord" />
      <DropdownMenuItem icon={<Ico.LogOut />} label={t("common.logOut")} onClick={logout} />
    </DropdownMenu>
  );
}
