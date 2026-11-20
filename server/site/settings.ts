// Site-wide settings an admin can change. Stored one row per setting as JSON; anything missing uses its default.
import { storedSettings, storeSettings } from "./repo";
import type { Settings } from "../../shared/site";
export type { Settings };

const DEFAULTS: Settings = { registrationsOpen: true, announcement: "", announcementTone: "info", announcementId: 0, maxShoutLength: 1000 };

export async function settings(): Promise<Settings> {
  const stored = new Map<string, unknown>();
  for (const r of await storedSettings()) { try { stored.set(r.key, JSON.parse(r.value)); } catch { /* unreadable: keep the default */ } }
  // a stored value of the wrong type is ignored
  const read = <K extends keyof Settings>(k: K, ok: (v: unknown) => v is Settings[K]): Settings[K] => { const v = stored.get(k); return ok(v) ? v : DEFAULTS[k]; };
  const bool = (v: unknown): v is boolean => typeof v === "boolean", text = (v: unknown): v is string => typeof v === "string", num = (v: unknown): v is number => typeof v === "number";
  return {
    registrationsOpen: read("registrationsOpen", bool), announcement: read("announcement", text),
    announcementTone: read("announcementTone", (v): v is Settings["announcementTone"] => v === "info" || v === "warning"),
    announcementId: read("announcementId", num), maxShoutLength: read("maxShoutLength", num),
  };
}
export const setting = async <K extends keyof Settings>(k: K): Promise<Settings[K]> => (await settings())[k];

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await storeSettings(Object.entries(patch).filter(([k, v]) => k in DEFAULTS && v !== undefined).map(([k, v]) => [k, JSON.stringify(v)]));
}
