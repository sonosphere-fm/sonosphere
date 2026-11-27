// Members of the Sonosphere Discord get a role for linking their account, and one for how many people they invited.
import { exclusive } from "../kv";
import { inviteCounts } from "../invites/repo";
import * as repo from "./repo";
import { API, GUILD_ID, TOKEN } from "./service";
import { INVITE_TIERS, LINKED_ROLE } from "../../shared/invites";

type Member = { user: { id: string; bot?: boolean }; roles: string[] };

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  for (;;) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`Discord ${method} ${path.split("?")[0]} answered ${res.status}`);
      return res;
    }
    const { retry_after } = (await res.json()) as { retry_after: number };
    await Bun.sleep(Math.ceil(retry_after * 1000));
  }
}

// Roles are kept by id, so staff can rename or recolour them in Discord; a deleted one is made again.
async function ensureRoles(): Promise<repo.RoleIds> {
  const existing = new Set(
    ((await (await call("GET", `/guilds/${GUILD_ID}/roles`)).json()) as { id: string }[]).map((r) => r.id)
  );
  const stored = await repo.roleIds();
  const make = async (id: string | undefined, name: string) => {
    if (id && existing.has(id)) return id;
    const res = await call("POST", `/guilds/${GUILD_ID}/roles`, { name, mentionable: false });
    return ((await res.json()) as { id: string }).id;
  };
  const ids = {
    linked: await make(stored?.linked, LINKED_ROLE),
    tiers: [] as string[],
  };
  for (const [i, t] of INVITE_TIERS.entries()) ids.tiers.push(await make(stored?.tiers[i], t.role));
  if (JSON.stringify(ids) !== JSON.stringify(stored)) await repo.saveRoleIds(ids);
  return ids;
}

async function members(): Promise<Member[]> {
  const all: Member[] = [];
  let after = "0";
  for (;;) {
    const page = (await (
      await call("GET", `/guilds/${GUILD_ID}/members?limit=1000&after=${after}`)
    ).json()) as Member[];
    all.push(...page);
    if (page.length < 1000) return all;
    after = page[page.length - 1]!.user.id;
  }
}

function wanted(ids: repo.RoleIds, userId: number | undefined, counts: Map<number, number>): Set<string> {
  if (!userId) return new Set();
  const invited = counts.get(userId) ?? 0;
  const tier = INVITE_TIERS.filter((t) => invited >= t.invited).length - 1;
  return new Set(tier < 0 ? [ids.linked] : [ids.linked, ids.tiers[tier]!]);
}

export async function syncRoles() {
  if (!TOKEN) return;
  await exclusive("discord-roles", 5 * 60_000, async () => {
    const ids = await ensureRoles();
    const managed = [ids.linked, ...ids.tiers];
    const [linked, counts, everyone] = await Promise.all([repo.linkedAccounts(), inviteCounts(), members()]);
    for (const m of everyone) {
      if (m.user.bot) continue;
      const want = wanted(ids, linked.get(m.user.id), counts);
      for (const role of managed) {
        const path = `/guilds/${GUILD_ID}/members/${m.user.id}/roles/${role}`;
        if (want.has(role) && !m.roles.includes(role)) await call("PUT", path);
        else if (!want.has(role) && m.roles.includes(role)) await call("DELETE", path);
      }
    }
  });
}
