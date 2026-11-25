// The bot's connection to Discord. Discord pushes every status change in the server down it.
const GATEWAY = "wss://gateway.discord.gg";
const GUILDS = 1 << 0;
const GUILD_PRESENCES = 1 << 8;
const HELLO_WITHIN = 30_000;
// a bad token or a presence permission that was never switched on in the developer portal; retrying cannot help
const FATAL = new Set([4004, 4010, 4011, 4012, 4013, 4014]);

export type Activity = {
  type: number;
  name: string;
  details?: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_text?: string };
};
export type Presence = { userId: string; activities: Activity[] };
export type Listener = { presence: (p: Presence) => void; everyone: (all: Presence[]) => void };

type Resume = { url: string; sessionId: string; seq: number | null };
type Ended = { code: number; ready: boolean; resume: Resume | null };

const presenceOf = (p: { user: { id: string }; activities?: Activity[] }): Presence => ({
  userId: p.user.id,
  activities: p.activities ?? [],
});

function session(token: string, guildId: string, on: Listener, resume: Resume | null): Promise<Ended> {
  return new Promise((done) => {
    const ws = new WebSocket(`${resume?.url ?? GATEWAY}/?v=10&encoding=json`);
    let seq = resume?.seq ?? null;
    let next = resume;
    let ready = false;
    let acked = true;
    let beat: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => ws.close(4000), HELLO_WITHIN);
    const send = (op: number, d: unknown) => ws.send(JSON.stringify({ op, d }));
    // a connection that stops acknowledging heartbeats is dead even if the socket looks open
    const heartbeat = () => {
      if (!acked) return ws.close(4000);
      acked = false;
      send(1, seq);
    };
    const dispatch = (t: string, d: Record<string, any>) => {
      if (t === "READY") {
        ready = true;
        next = { url: d.resume_gateway_url, sessionId: d.session_id, seq };
      } else if (t === "RESUMED") ready = true;
      else if (t === "GUILD_CREATE" && d.id === guildId) on.everyone((d.presences ?? []).map(presenceOf));
      else if (t === "PRESENCE_UPDATE" && d.guild_id === guildId) on.presence(presenceOf(d as never));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.s != null) {
        seq = m.s;
        if (next) next.seq = seq;
      }
      if (m.op === 10) {
        const every = m.d.heartbeat_interval;
        clearTimeout(first);
        setTimeout(() => {
          heartbeat();
          beat = setInterval(heartbeat, every);
        }, every * Math.random());
        if (resume) send(6, { token, session_id: resume.sessionId, seq: resume.seq });
        else
          send(2, {
            token,
            intents: GUILDS | GUILD_PRESENCES,
            properties: { os: "linux", browser: "sonosphere", device: "sonosphere" },
          });
      } else if (m.op === 11) acked = true;
      else if (m.op === 1) send(1, seq);
      else if (m.op === 7) ws.close(4000);
      else if (m.op === 9) {
        if (!m.d) next = null;
        ws.close(4000);
      } else if (m.op === 0) {
        try {
          dispatch(m.t, m.d);
        } catch (err) {
          console.error("Discord event:", err);
        }
      }
    };
    ws.onclose = (e) => {
      clearTimeout(first);
      clearInterval(beat);
      done({ code: e.code, ready, resume: next });
    };
  });
}

/** Stays connected, resuming where it can, until Discord refuses the bot outright. */
export async function watch(token: string, guildId: string, on: Listener): Promise<never> {
  let resume: Resume | null = null;
  let wait = 1000;
  for (;;) {
    const ended = await session(token, guildId, on, resume);
    if (FATAL.has(ended.code)) throw new Error(`Discord refused the bot connection (${ended.code})`);
    resume = ended.resume;
    if (ended.ready) wait = 1000;
    await Bun.sleep(wait + Math.random() * 1000);
    wait = Math.min(wait * 2, 60_000);
  }
}
