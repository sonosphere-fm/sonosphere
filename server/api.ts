import { Router } from "./http";
import { router as activeSessions } from "./account/sessions";
import { router as feeds } from "./feeds/routes";
import { router as totp } from "./auth/totp-routes";
import { router as cosmetics } from "./cosmetics/routes";
import { router as userLabels } from "./users/labels";
import { router as account } from "./account/routes";
import { router as usernameFont } from "./account/username-font";
import { router as apps } from "./apps/routes";
import { router as auth } from "./auth/routes";
import { router as oauth } from "./auth/oauth/routes";
import { router as blocks } from "./blocks/routes";
import { router as catalog } from "./catalog/routes";
import { router as changelog } from "./changelog/routes";
import { router as charts } from "./charts/routes";
import { router as dm } from "./dm/routes";
import { router as spotify } from "./spotify/routes";
import { router as music } from "./music/routes";
import { router as discord } from "./discord/routes";
import { router as events } from "./events/routes";
import { router as home } from "./home/routes";
import { router as images } from "./images/routes";
import { router as journals } from "./journals/routes";
import { router as listening } from "./listening/routes";
import { router as imports } from "./listening/imports";
import { router as notifications } from "./notifications/routes";
import { router as obsessions } from "./obsessions/routes";
import { router as playlists } from "./playlists/routes";
import { router as reports } from "./reports/routes";
import { router as search } from "./search/routes";
import { router as shouts } from "./shouts/routes";
import { router as site } from "./site/routes";
import { router as short } from "./site/short";
import { router as mail } from "./mail/routes";
import { router as stations } from "./stations/routes";
import { router as tags } from "./tags/routes";
import { router as users } from "./users/routes";
import { router as video } from "./video/routes";
import { router as wiki } from "./wiki/routes";
import { router as adminAudit } from "./admin/audit";
import { router as adminCatalogue } from "./admin/catalogue";
import { router as adminContent } from "./admin/content";
import { router as adminDashboard } from "./admin/dashboard";
import { router as adminReports } from "./admin/reports";
import { router as adminMessages } from "./admin/messages";
import { router as adminSettings } from "./admin/settings";
import { router as adminUsers } from "./admin/users";

export const api = new Router().include(
  activeSessions,
  feeds,
  cosmetics,
  userLabels,
  auth,
  totp,
  oauth,
  account,
  usernameFont,
  images,
  site,
  short,
  mail,
  changelog,
  charts,
  home,
  search,
  catalog,
  tags,
  wiki,
  shouts,
  video,
  stations,
  listening,
  imports,
  users,
  obsessions,
  playlists,
  events,
  journals,
  notifications,
  blocks,
  apps,
  reports,
  dm,
  spotify,
  music,
  discord,
  adminDashboard,
  adminUsers,
  adminReports,
  adminMessages,
  adminContent,
  adminCatalogue,
  adminAudit,
  adminSettings
);
