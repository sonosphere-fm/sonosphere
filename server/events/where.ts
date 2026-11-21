const names = new Intl.DisplayNames(["en"], { type: "region" });

type Place = { lat: number | null; lon: number | null; city: string; country: string };

export function whereFrom(h: Headers): Place | null {
  const code = (h.get("cf-ipcountry") || "").toUpperCase();
  // XX is unknown, T1 is Tor
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  let country = code;
  try {
    country = names.of(code) ?? code;
  } catch {}
  const lat = Number(h.get("cf-iplatitude"));
  const lon = Number(h.get("cf-iplongitude"));
  const known = h.has("cf-iplatitude") && Number.isFinite(lat) && Number.isFinite(lon);
  // header values are Latin-1 on the wire but Cloudflare sends UTF-8 bytes, so "Zürich" needs decoding
  const raw = h.get("cf-ipcity") || "";
  let city = raw;
  try {
    city = new TextDecoder().decode(Uint8Array.from(raw, ch => ch.charCodeAt(0) & 255));
  } catch {}
  return { lat: known ? lat : null, lon: known ? lon : null, city, country };
}
