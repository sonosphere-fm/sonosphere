// Roughly where someone is, from the location Cloudflare works out for each visitor's connection (its "visitor
// location headers"). Used only to show events nearby; never stored.
const names = new Intl.DisplayNames(["en"], { type: "region" });

export type Place = { lat: number | null; lon: number | null; city: string; country: string };

export function whereFrom(h: Headers): Place | null {
  const code = (h.get("cf-ipcountry") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null; // unknown, or Tor
  let country = code;
  try { country = names.of(code) ?? code; } catch { /* keep the code */ }
  const lat = Number(h.get("cf-iplatitude")), lon = Number(h.get("cf-iplongitude")), known = h.has("cf-iplatitude") && Number.isFinite(lat) && Number.isFinite(lon);
  // header values are Latin-1 on the wire; Cloudflare sends UTF-8 bytes, so a city like "Zürich" needs reading back
  const raw = h.get("cf-ipcity") || "";
  let city = raw;
  try { city = new TextDecoder().decode(Uint8Array.from(raw, ch => ch.charCodeAt(0) & 255)); } catch { /* as sent */ }
  return { lat: known ? lat : null, lon: known ? lon : null, city, country };
}
