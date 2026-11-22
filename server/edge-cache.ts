// Keep browser caching separate. Cloudflare only receives a public TTL after its request-side bypass rules are in place.
export function cacheAnonymousAtEdge(req: Request, headers: Headers, seconds: number) {
  if (
    process.env.CLOUDFLARE_CACHE_PUBLIC !== "1" ||
    req.method !== "GET" ||
    req.headers.has("Authorization") ||
    /(?:^|;\s*)(?:sid|act_as)=/.test(req.headers.get("Cookie") ?? "") ||
    headers.has("Set-Cookie")
  )
    return;

  headers.set("Cloudflare-CDN-Cache-Control", `public, max-age=${seconds}`);
}
