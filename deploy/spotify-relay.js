// A Cloudflare Worker that gives Spotify the https return address it insists on and forwards the browser to the
// site, which may still be plain http. Set SITE to the site's address, deploy the worker, then use the worker's
// URL as SPOTIFY_REDIRECT_URI in /opt/spin/spin.env. (A worker that proxies the whole site works too.)
const SITE = "http://OLD_VPS_IP";

export default {
  fetch(request) {
    const url = new URL(request.url);
    // only the sign-in reply is passed on: Spotify's one-time code and the state it was given
    const q = new URLSearchParams();
    for (const k of ["code", "state", "error"]) { const v = url.searchParams.get(k); if (v) q.set(k, v); }
    return Response.redirect(`${SITE}/api/spotify/callback?${q}`, 302);
  },
};
