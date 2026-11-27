import { limit, missing, Router } from "../http";
import { need } from "../guards";
import { SECURE } from "../auth/session";
import { SITE_URL } from "../mail";
import { findByName, publicUser } from "../users/repo";
import * as repo from "./repo";
import type { InviteBoard, InviteFrom } from "../../shared/invites";

export const router = new Router();

const COOKIE = "invite";
const KEEP = 30 * 86_400;
const cookie = (value: string, maxAge: number) =>
  `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE}`;

export const inviteLink = (username: string) => `${SITE_URL}/invite/${encodeURIComponent(username)}`;

router.get<InviteBoard>("/api/invites", async (c) => {
  const items = await repo.leaders(50);
  const mine = c.user ? { link: inviteLink(c.user.username), invited: await repo.inviteCount(c.user.id) } : null;
  return { items, mine };
});

router.get<InviteFrom>("/api/invites/:name", async (c) => {
  const u = await findByName(c.params[0]!);
  if (!u || u.banned) return missing("userNotFound");
  if (!c.user) c.headers.append("Set-Cookie", cookie(String(u.id), KEEP));
  return { inviter: publicUser(u) };
});

// Called once an account exists, from every way of signing up.
export async function creditInvite(c: { req: Request; headers: Headers }, userId: number) {
  const id = Number(/(?:^|;\s*)invite=(\d+)/.exec(c.req.headers.get("cookie") || "")?.[1]);
  if (!id) return;
  c.headers.append("Set-Cookie", cookie("", 0));
  await repo.credit(userId, id);
}
