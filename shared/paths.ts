export const enc = (s: string) => encodeURIComponent(s.replace(/[%+]/g, c => encodeURIComponent(c))).replace(/%20/g, "+");
export const dec = (s: string | undefined) => {
  const t = (s || "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};
export const artistUrl = (artist: string) => `/music/${enc(artist)}`;
export const albumUrl = (artist: string, album: string) => `/music/${enc(artist)}/${enc(album)}`;
export const trackUrl = (artist: string, track: string) => `/music/${enc(artist)}/_/${enc(track)}`;
export const userUrl = (name: string) => `/user/${encodeURIComponent(name)}`;
export const tagUrl = (tag: string) => `/tag/${enc(tag)}`;
