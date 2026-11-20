// The public route about the site itself: what every page needs to know before it draws.
import { Router } from "../http";
import { settings } from "./settings";
import type { SiteInfo } from "../../shared/admin";

export const router = new Router();

router.get<SiteInfo>("/api/site", async () => {
  const s = await settings();
  return { registrationsOpen: s.registrationsOpen, maxShoutLength: s.maxShoutLength,
    announcement: s.announcement ? { id: s.announcementId, text: s.announcement, tone: s.announcementTone } : null };
});
