// Admin routes for the site-wide settings: registrations, the announcement banner and the shout length limit.
import { Router, bad } from "../http";
import { adminOnly } from "../guards";
import { audit } from "../site/audit";
import { saveSettings, settings, type Settings } from "../site/settings";
import { now } from "../util";
import { note } from "./common";
import type { AdminSettings } from "../../shared/admin-content";

export const router = new Router({ jsonOnly: true });

router.get<AdminSettings>("/api/admin/settings", c => { adminOnly(c); return settings(); });

router.post<AdminSettings>("/api/admin/settings", async c => {
  const me = adminOnly(c), b = c.body, cur = await settings(), next: Partial<Settings> = {};
  if (b.registrationsOpen !== undefined) next.registrationsOpen = !!b.registrationsOpen;
  if (b.announcement !== undefined) next.announcement = String(b.announcement).trim().replace(/\s+/g, " ").slice(0, 500);
  if (b.announcementTone !== undefined) next.announcementTone = b.announcementTone === "warning" ? "warning" : "info";
  if (b.maxShoutLength !== undefined) {
    const n = Math.round(Number(b.maxShoutLength));
    if (!Number.isFinite(n) || n < 50 || n > 1000) bad("Wall post length must be between 50 and 1000 characters");
    next.maxShoutLength = n;
  }
  // what actually differs from the stored settings, as { from, to } for the audit log
  const KEYS = ["registrationsOpen", "announcement", "announcementTone", "maxShoutLength"] as const;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of KEYS) if (next[k] !== undefined && next[k] !== cur[k]) changes[k] = { from: cur[k], to: next[k] };
  if (!Object.keys(changes).length) return settings();
  // a new or reworded announcement shows again for people who dismissed the last one
  if (changes.announcement || changes.announcementTone) next.announcementId = now();
  await saveSettings(next);
  await audit(me, { action: "settings.update", targetType: "site", label: Object.keys(changes).join(", "), note: note(c), data: changes });
  return settings();
});
