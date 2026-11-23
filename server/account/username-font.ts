import { Router } from "../http";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { appearanceCols } from "../users/appearance";
import { findByName } from "../users/repo";
import { userAppearance } from "../users/appearance";
import type { UserAppearance } from "../../shared/username-fonts";

export const router = new Router();

// Name-only references (wiki history, playlist owners) don't carry a full user payload.
router.get<UserAppearance>("/api/user/appearance", async (c) => {
  const u = await findByName(c.q.get("name") ?? "");
  if (!u || u.banned) return {};
  const [appearance] = await db.select(appearanceCols).from(users).where(eq(users.id, u.id));
  return userAppearance(appearance);
});
