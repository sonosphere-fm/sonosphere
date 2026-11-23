const HOST = "rustrak.edideaur.works";
const PROJECT = "2";
const MAX_BYTES = 4 * 1024 * 1024;

// Browser error reports post here so visitors only ever talk to our own origin.
export async function sentryTunnel(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 413 });
  const end = body.indexOf(10);
  const header = new TextDecoder().decode(end === -1 ? body : body.subarray(0, end));
  let dsn: URL;
  try {
    dsn = new URL(JSON.parse(header).dsn);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (dsn.hostname !== HOST || dsn.pathname !== `/${PROJECT}`) return new Response(null, { status: 400 });
  const auth = new URLSearchParams({ sentry_key: dsn.username, sentry_version: "7" });
  const upstream = await fetch(`https://${HOST}/api/${PROJECT}/envelope/?${auth}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return new Response(null, { status: upstream?.status ?? 502 });
}
